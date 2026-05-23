"""
FastAPI reverse proxy that forwards /api/* requests to the Next.js app
running on http://localhost:3000/api/*.

The Next.js project (in /app/frontend) owns all backend logic — MongoDB
models, JWT auth, trading engine, etc. This proxy exists only because the
Emergent ingress routes all `/api/*` traffic to port 8001 (this service),
while the Next.js server listens on port 3000.
"""

import os
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import Response, StreamingResponse

NEXT_ORIGIN = os.environ.get("NEXT_ORIGIN", "http://localhost:3000")
HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "transfer-encoding", "upgrade", "content-length",
    "content-encoding", "host",
}

app = FastAPI(title="Trading Lite Proxy")

# Shared HTTP client (no hard timeout so SSE streams stay open)
_client: httpx.AsyncClient | None = None


@app.on_event("startup")
async def _startup():
    global _client
    _client = httpx.AsyncClient(timeout=None, follow_redirects=False)


@app.on_event("shutdown")
async def _shutdown():
    if _client:
        await _client.aclose()


@app.get("/healthz")
async def healthz():
    return {"ok": True, "proxy_target": NEXT_ORIGIN}


async def _proxy(request: Request, path: str):
    url = f"{NEXT_ORIGIN}/api/{path}"
    if request.url.query:
        url += f"?{request.url.query}"

    # Forward headers, dropping hop-by-hop ones
    fwd_headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in HOP_BY_HOP
    }
    fwd_headers["host"] = "localhost:3000"

    body = await request.body()

    req = _client.build_request(
        method=request.method,
        url=url,
        headers=fwd_headers,
        content=body if body else None,
    )
    upstream = await _client.send(req, stream=True)

    # Copy safe headers through
    resp_headers = {
        k: v for k, v in upstream.headers.items()
        if k.lower() not in HOP_BY_HOP
    }

    content_type = upstream.headers.get("content-type", "")
    is_stream = "text/event-stream" in content_type or "stream" in content_type.lower()

    if is_stream:
        async def gen():
            try:
                async for chunk in upstream.aiter_raw():
                    yield chunk
            finally:
                await upstream.aclose()
        return StreamingResponse(
            gen(),
            status_code=upstream.status_code,
            headers=resp_headers,
            media_type=content_type or None,
        )

    content = await upstream.aread()
    await upstream.aclose()
    return Response(
        content=content,
        status_code=upstream.status_code,
        headers=resp_headers,
        media_type=content_type or None,
    )


@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy_api(path: str, request: Request):
    return await _proxy(request, path)


@app.api_route("/api", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy_api_root(request: Request):
    return await _proxy(request, "")
