'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Custom HTML5 Canvas chart engine for Quotex clone.
 * Renders OHLC candles, support/resistance, live price marker, active trade overlays
 * (entry line, expiry marker, P/L bubble), crosshair, price/time axes, and user-drawn
 * shapes (trendlines + rectangles).
 *
 * Coordinates: shapes are stored in (time, price) pairs so they remain anchored to
 * data when the chart pans/scales, just like real charting platforms.
 */
const PRICE_AXIS_W = 70;
const TIME_AXIS_H = 26;
const VISIBLE_CANDLES = 60;
const RIGHT_PADDING_CANDLES = 10;

export default function OTCChart({
  symbol = '',                 // current asset symbol (so we can reset pan on asset switch)
  candles = [],
  livePrice = null,
  support = null,
  resistance = null,
  activeTrades = [],
  decimals = 4,
  intervalSec = 5,
  payoutPct = 0.85,
  tool = 'cursor',           // 'cursor' | 'trendline' | 'rectangle' | 'eraser'
  shapes = [],               // [{id, type, from:{time,price}, to:{time,price}}]
  onShapeAdd,
  onShapeRemove,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [drawing, setDrawing] = useState(null);
  const [panStart, setPanStart] = useState(null);    // {x, offset} when starting to pan
  const [pinchStart, setPinchStart] = useState(null); // {distance, count} 2-finger pinch
  // Zoom + pan state. count = visible candles, offset = candles back from latest.
  const [view, setView] = useState({ count: 60, offset: 0 });

  // Reset zoom + pan whenever user switches asset OR timeframe so the chart
  // always snaps to the latest 60 bars on the newly-selected (asset, interval).
  // Without this, panning back on 5s and then clicking 1m or a new currency
  // pair would leave `offset` pointing into the wrong slice → looks like
  // candles "broke" and started again.
  useEffect(() => {
    setView({ count: 60, offset: 0 });
  }, [symbol, intervalSec]);

  const stateRef = useRef({});
  stateRef.current = { candles, livePrice, support, resistance, activeTrades, decimals, intervalSec, payoutPct, hover, tool, shapes, drawing, view };

  const fmt = (p) => (p === null || p === undefined || isNaN(p)) ? '--' : Number(p).toFixed(decimals);

  // Translation helpers between pixel ↔ (time, price) — exposed via ref so mouse
  // handlers and renderer share the same projection.
  const projRef = useRef({});

  function recomputeProjection() {
    const cv = canvasRef.current;
    const ct = containerRef.current;
    if (!cv || !ct) return null;
    const w = ct.clientWidth, h = ct.clientHeight;
    const chartW = w - PRICE_AXIS_W;
    const chartH = h - TIME_AXIS_H;
    const s = stateRef.current;
    if (!s.candles?.length) return null;
    const v = s.view || { count: 60, offset: 0 };
    // Slice based on zoom/pan: latest candle minus offset, count back from there.
    const total = s.candles.length;
    const end = Math.max(v.count, total - v.offset);
    const start = Math.max(0, end - v.count);
    const visible = s.candles.slice(start, end);
    const lastCandleTime = visible[visible.length - 1]?.time || 0;
    // Dynamic right padding: if there are active trades, extend forward slots
    // so the END marker is always visible on the chart alongside BEGIN.
    let forwardCandles = RIGHT_PADDING_CANDLES;
    if (s.activeTrades?.length && v.offset === 0) {
      const maxExp = Math.max(...s.activeTrades.map(t => Math.floor(new Date(t.expiresAt).getTime() / 1000)));
      const neededForward = Math.ceil((maxExp - lastCandleTime) / s.intervalSec) + 4;
      if (neededForward > forwardCandles) forwardCandles = Math.max(forwardCandles, neededForward);
    }
    const totalSlots = v.count + forwardCandles;
    const candleSpacing = chartW / totalSlots;
    let lo = Infinity, hi = -Infinity;
    for (const c of visible) { if (c.low < lo) lo = c.low; if (c.high > hi) hi = c.high; }
    if (s.livePrice != null && s.livePrice > 0 && v.offset === 0) { if (s.livePrice < lo) lo = s.livePrice; if (s.livePrice > hi) hi = s.livePrice; }
    for (const t of s.activeTrades || []) { if (t.entryPrice < lo) lo = t.entryPrice; if (t.entryPrice > hi) hi = t.entryPrice; }
    if (!isFinite(lo) || !isFinite(hi) || lo === hi) {
      const center = lo === hi ? lo : 1; lo = center * 0.99; hi = center * 1.01;
    }
    const pad = (hi - lo) * 0.18;
    lo -= pad; hi += pad;
    const priceRange = hi - lo;
    const lastCandleSlot = visible.length - 1;
    const proj = {
      w, h, chartW, chartH, lo, hi, priceRange,
      candleSpacing, lastCandleTime, lastCandleSlot, visible,
      slotToX: (i) => i * candleSpacing + candleSpacing / 2,
      priceToY: (p) => chartH - ((p - lo) / priceRange) * chartH,
      timeToX: (sec) => ((visible.length - 1) + (sec - lastCandleTime) / s.intervalSec) * candleSpacing + candleSpacing / 2,
      xToTime: (x) => {
        const slot = (x - candleSpacing / 2) / candleSpacing;
        return lastCandleTime + (slot - lastCandleSlot) * s.intervalSec;
      },
      yToPrice: (y) => lo + (1 - y / chartH) * priceRange,
    };
    projRef.current = proj;
    return proj;
  }

  function draw() {
    const cv = canvasRef.current;
    const ct = containerRef.current;
    if (!cv || !ct) return;
    const dpr = window.devicePixelRatio || 1;
    const w = ct.clientWidth, h = ct.clientHeight;
    if (w <= 0 || h <= 0) return;
    if (cv.width !== Math.floor(w * dpr) || cv.height !== Math.floor(h * dpr)) {
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0c1015'; ctx.fillRect(0, 0, w, h);

    const s = stateRef.current;
    const chartW = w - PRICE_AXIS_W;
    const chartH = h - TIME_AXIS_H;
    if (!s.candles?.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '12px Inter';
      ctx.fillText('Waiting for data…', chartW / 2 - 40, chartH / 2);
      return;
    }
    const proj = recomputeProjection();
    if (!proj) return;
    const { priceToY, timeToX, slotToX, lo, hi, priceRange, visible } = proj;

    // Grid + price labels
    ctx.font = '10px Inter, ui-sans-serif, system-ui';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (let i = 0; i <= 6; i++) {
      const y = (chartH / 6) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartW, y); ctx.stroke();
      const p = hi - (priceRange / 6) * i;
      ctx.fillText(fmt(p), chartW + 6, y);
    }
    // Vertical grid + time labels
    const xStep = Math.max(8, Math.floor(visible.length / 8));
    ctx.textBaseline = 'top';
    for (let i = 0; i < visible.length; i += xStep) {
      const x = slotToX(i);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, chartH); ctx.stroke();
      const c = visible[i];
      if (c) {
        const d = new Date(c.time * 1000);
        const tt = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0') + ':' + d.getSeconds().toString().padStart(2, '0');
        const tw = ctx.measureText(tt).width;
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillText(tt, x - tw / 2, chartH + 6);
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath(); ctx.moveTo(chartW, 0); ctx.lineTo(chartW, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, chartH); ctx.lineTo(w, chartH); ctx.stroke();

    // Support / resistance — bold, prominent
    if (s.support && s.support > lo && s.support < hi) {
      const y = priceToY(s.support);
      ctx.strokeStyle = 'rgba(0,185,122,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([8, 5]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartW, y); ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth = 1;
      // Pill label
      ctx.font = 'bold 10px Inter';
      const lbl = 'SUPPORT  ' + fmt(s.support);
      const lw = ctx.measureText(lbl).width + 14;
      ctx.fillStyle = '#00b97a';
      roundRect(ctx, 4, y - 9, lw, 18, 3); ctx.fill();
      ctx.fillStyle = 'white'; ctx.textBaseline = 'middle';
      ctx.fillText(lbl, 11, y);
    }
    if (s.resistance && s.resistance > lo && s.resistance < hi) {
      const y = priceToY(s.resistance);
      ctx.strokeStyle = 'rgba(255,85,85,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([8, 5]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartW, y); ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth = 1;
      ctx.font = 'bold 10px Inter';
      const lbl = 'RESISTANCE  ' + fmt(s.resistance);
      const lw = ctx.measureText(lbl).width + 14;
      ctx.fillStyle = '#ff5555';
      roundRect(ctx, 4, y - 9, lw, 18, 3); ctx.fill();
      ctx.fillStyle = 'white'; ctx.textBaseline = 'middle';
      ctx.fillText(lbl, 11, y);
    }

    // Candles
    const candleWidth = Math.max(2, proj.candleSpacing * 0.65);
    visible.forEach((c, i) => {
      const x = slotToX(i);
      const isUp = c.close >= c.open;
      const color = isUp ? '#00b97a' : '#ff5555';
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1;
      const xw = Math.round(x) + 0.5;
      ctx.beginPath(); ctx.moveTo(xw, priceToY(c.high)); ctx.lineTo(xw, priceToY(c.low)); ctx.stroke();
      const yo = priceToY(c.open), yc = priceToY(c.close);
      const top = Math.min(yo, yc), bodyH = Math.max(1, Math.abs(yc - yo));
      ctx.fillRect(Math.round(x - candleWidth / 2), Math.round(top), Math.round(candleWidth), Math.round(bodyH));
    });

    // Live price line + label + pulsing dot
    if (s.livePrice != null && s.livePrice > 0) {
      const y = priceToY(s.livePrice);
      const last = visible[visible.length - 1];
      const isUp = last ? s.livePrice >= last.open : true;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartW, y); ctx.stroke();
      ctx.setLineDash([]);
      const lastX = slotToX(proj.lastCandleSlot);
      ctx.beginPath(); ctx.arc(lastX, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = isUp ? '#00b97a' : '#ff5555'; ctx.fill();
      ctx.beginPath(); ctx.arc(lastX, y, 9, 0, Math.PI * 2);
      ctx.strokeStyle = isUp ? 'rgba(0,185,122,0.4)' : 'rgba(255,85,85,0.4)';
      ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;

      // Countdown badge: seconds remaining until the current candle closes.
      // We derive `remaining` directly from the last candle's bucket-start
      // time (so the countdown is GUARANTEED to be in sync with the bar that
      // is actually drawn on the chart, regardless of any tick-cadence jitter
      // between server and client). When the last bar's bucket boundary
      // passes, the countdown rolls over to the new interval at the exact
      // moment the new candle appears.
      const ivl = Math.max(1, s.intervalSec || 5);
      const lastBar = s.candles && s.candles.length ? s.candles[s.candles.length - 1] : null;
      const nowSec = Math.floor(Date.now() / 1000);
      let remaining;
      if (lastBar && typeof lastBar.time === 'number') {
        const endSec = lastBar.time + ivl;
        remaining = Math.max(0, endSec - nowSec);
        // If we've already crossed the boundary but the server hasn't pushed
        // the new bar yet, show the FULL interval (it's the same as saying
        // "a brand-new candle is starting right now"). Avoids the brief 00:00
        // freeze the user reported.
        if (remaining === 0) remaining = ivl;
      } else {
        remaining = ivl - (nowSec % ivl);
      }
      const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
      const ss = String(remaining % 60).padStart(2, '0');
      const cdLabel = `${mm}:${ss}`;
      ctx.font = 'bold 10px Inter';
      const cdW = Math.ceil(ctx.measureText(cdLabel).width) + 12;
      const cdH = 18;
      const cdX = chartW - cdW - 4;
      const cdY = y - cdH / 2;
      ctx.fillStyle = 'rgba(15,20,28,0.92)';
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(cdX, cdY, cdW, cdH, 4);
      } else {
        ctx.rect(cdX, cdY, cdW, cdH);
      }
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cdLabel, cdX + cdW / 2, y);
      ctx.textAlign = 'start';

      ctx.fillStyle = isUp ? '#00b97a' : '#ff5555';
      ctx.fillRect(chartW + 1, y - 9, PRICE_AXIS_W - 2, 18);
      ctx.fillStyle = 'white'; ctx.font = 'bold 10px Inter'; ctx.textBaseline = 'middle';
      ctx.fillText(fmt(s.livePrice), chartW + 6, y);
    }

    // Active trade overlays — multiple trades on the same asset can collide
    // visually (same entry price or overlapping expiry windows). To keep them
    // legible we:
    //   - draw a small numbered badge at the entry dot matching the sidebar
    //     card #1, #2, ... (uses t._idx threaded through from the parent)
    //   - stagger PnL pills vertically per trade so they don't sit on top of
    //     each other
    //   - use a small index-based label offset for BEGIN/END so they don't
    //     stack at the same Y when several trades start within the same bar
    let _tradeRowIdx = 0;
    for (const t of s.activeTrades || []) {
      _tradeRowIdx += 1;
      const stackOffset = (_tradeRowIdx - 1) * 26; // px between PnL pills
      const labelStaggerY = ((_tradeRowIdx - 1) % 3) * 18; // 0/18/36 px down
      const tradeIdx = t._idx ?? _tradeRowIdx;

      const entrySec = Math.floor(new Date(t.openedAt).getTime() / 1000);
      const expSec = Math.floor(new Date(t.expiresAt).getTime() / 1000);
      const xEntry = timeToX(entrySec), xExp = timeToX(expSec);
      const yEntry = priceToY(t.entryPrice);
      const live = s.livePrice ?? t.entryPrice;
      const winning = (t.direction === 'up' && live > t.entryPrice) || (t.direction === 'down' && live < t.entryPrice);
      const dirColor = t.direction === 'up' ? '#00b97a' : '#ff5555';

      // Dotted vertical line @ entry (BEGIN)
      if (xEntry > 0 && xEntry < chartW) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([1, 4]);
        ctx.beginPath(); ctx.moveTo(xEntry, 0); ctx.lineTo(xEntry, chartH); ctx.stroke();
      }
      // Dotted vertical line @ expiry (END) — yellow
      if (xExp > 0 && xExp < chartW) {
        ctx.strokeStyle = '#f0b90b'; ctx.lineWidth = 1.5; ctx.setLineDash([1, 4]);
        ctx.beginPath(); ctx.moveTo(xExp, 0); ctx.lineTo(xExp, chartH); ctx.stroke();
      }

      // Dotted horizontal segment FROM entry TO expiry at the entry-price level (direction color)
      const xFrom = Math.max(0, Math.min(chartW, xEntry));
      const xTo = Math.max(0, Math.min(chartW, xExp));
      ctx.strokeStyle = dirColor; ctx.lineWidth = 1.8; ctx.setLineDash([1, 4]);
      ctx.beginPath(); ctx.moveTo(xFrom, yEntry); ctx.lineTo(xTo, yEntry); ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth = 1;

      // Small filled dot at entry point + numbered badge above-right
      if (xEntry > 0 && xEntry < chartW) {
        ctx.fillStyle = dirColor;
        ctx.beginPath(); ctx.arc(xEntry, yEntry, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#0c1015'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(xEntry, yEntry, 5, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;

        // #N badge — links chart trade to sidebar card #N
        const idxTxt = `#${tradeIdx}`;
        ctx.font = 'bold 10px Inter';
        const idxW = ctx.measureText(idxTxt).width + 8;
        ctx.fillStyle = '#f0b90b';
        roundRect(ctx, xEntry + 8, yEntry - 22, idxW, 14, 3); ctx.fill();
        ctx.fillStyle = '#0c1015'; ctx.textBaseline = 'middle';
        ctx.fillText(idxTxt, xEntry + 12, yEntry - 15);
      }
      // Small filled dot at expiry point (outline only — hollow)
      if (xExp > 0 && xExp < chartW) {
        ctx.fillStyle = '#0c1015';
        ctx.beginPath(); ctx.arc(xExp, yEntry, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = dirColor; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(xExp, yEntry, 5, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
      }

      // Section labels with backdrop pills (staggered vertically per trade)
      ctx.font = 'bold 9px Inter';
      ctx.textBaseline = 'middle';
      if (xEntry > 4 && xEntry < chartW - 4) {
        const txt = `BEGIN #${tradeIdx}`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        roundRect(ctx, xEntry + 4, 6 + labelStaggerY, ctx.measureText(txt).width + 10, 16, 3); ctx.fill();
        ctx.fillStyle = '#0c1015'; ctx.fillText(txt, xEntry + 9, 14 + labelStaggerY);
      }
      if (xExp > 4 && xExp < chartW - 4) {
        const txt = `END #${tradeIdx}`;
        ctx.fillStyle = '#f0b90b';
        roundRect(ctx, xExp + 4, 6 + labelStaggerY, ctx.measureText(txt).width + 10, 16, 3); ctx.fill();
        ctx.fillStyle = '#0c1015'; ctx.fillText(txt, xExp + 9, 14 + labelStaggerY);
      }
      // Entry price right-axis tag
      ctx.fillStyle = 'white'; ctx.fillRect(chartW + 1, yEntry - 8, PRICE_AXIS_W - 2, 16);
      ctx.fillStyle = '#0c1015'; ctx.font = 'bold 9px Inter';
      ctx.fillText(fmt(t.entryPrice), chartW + 6, yEntry);

      const pnl = winning ? +(t.amount * s.payoutPct).toFixed(2) : -t.amount;
      const remaining = Math.max(0, Math.ceil((new Date(t.expiresAt).getTime() - Date.now()) / 1000));
      const arrow = t.direction === 'up' ? '▲' : '▼';
      const txt = `#${tradeIdx} ${arrow} ${winning ? '+' : ''}${pnl.toFixed(2)}$`;
      ctx.font = 'bold 11px Inter';
      const tw = ctx.measureText(txt).width + 16;
      const bx = Math.min(chartW - tw - 2, Math.max(2, xExp - tw - 6));
      // Stagger the PnL pill so multiple simultaneous trades don't draw on top
      // of each other — distribute upward from the entry line.
      const by = Math.max(2, Math.min(chartH - 26, yEntry - 12 - stackOffset));
      ctx.fillStyle = winning ? '#00b97a' : '#ff5555';
      ctx.shadowColor = winning ? 'rgba(0,185,122,0.5)' : 'rgba(255,85,85,0.5)';
      ctx.shadowBlur = 12;
      roundRect(ctx, bx, by, tw, 22, 4); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = 'white'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, bx + 8, by + 11);
      if (xExp > 0 && xExp < chartW) {
        const cdTxt = `${remaining}s`;
        ctx.font = 'bold 10px Inter';
        const cdW = ctx.measureText(cdTxt).width + 14;
        const cdY = Math.max(40, Math.min(chartH - 30, yEntry + 24));
        const cdX = Math.max(2, xExp - cdW / 2);
        ctx.fillStyle = '#11161e'; ctx.strokeStyle = '#f0b90b'; ctx.lineWidth = 1;
        roundRect(ctx, cdX, cdY, cdW, 18, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f0b90b'; ctx.textBaseline = 'middle';
        ctx.fillText(cdTxt, cdX + 7, cdY + 9);
      }
    }

    // ---- User drawn shapes ----
    drawShapes(ctx, s.shapes || [], proj, chartW, chartH, false);
    if (s.drawing) drawShapes(ctx, [s.drawing], proj, chartW, chartH, true);

    // Crosshair on hover
    if (s.hover && s.hover.x < chartW && s.hover.y < chartH) {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, s.hover.y); ctx.lineTo(chartW, s.hover.y);
      ctx.moveTo(s.hover.x, 0); ctx.lineTo(s.hover.x, chartH); ctx.stroke();
      ctx.setLineDash([]);
      const p = lo + (1 - s.hover.y / chartH) * priceRange;
      ctx.fillStyle = '#11161e'; ctx.fillRect(chartW + 1, s.hover.y - 8, PRICE_AXIS_W - 2, 16);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.strokeRect(chartW + 1, s.hover.y - 8, PRICE_AXIS_W - 2, 16);
      ctx.fillStyle = 'white'; ctx.font = 'bold 10px Inter'; ctx.textBaseline = 'middle';
      ctx.fillText(fmt(p), chartW + 6, s.hover.y);
    }
  }

  function drawShapes(ctx, list, proj, chartW, chartH, isPreview) {
    for (const sh of list) {
      const x1 = proj.timeToX(sh.from.t);
      const y1 = proj.priceToY(sh.from.p);
      const x2 = proj.timeToX(sh.to.t);
      const y2 = proj.priceToY(sh.to.p);
      ctx.lineWidth = 2;
      ctx.strokeStyle = isPreview ? 'rgba(26,142,255,0.9)' : '#1a8eff';
      ctx.setLineDash(isPreview ? [4, 3] : []);
      if (sh.type === 'trendline') {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        if (!isPreview) {
          // small handles
          ctx.fillStyle = '#1a8eff';
          ctx.beginPath(); ctx.arc(x1, y1, 3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x2, y2, 3, 0, Math.PI * 2); ctx.fill();
        }
      } else if (sh.type === 'rectangle') {
        ctx.fillStyle = 'rgba(26,142,255,0.10)';
        const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
        const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);
      }
      ctx.setLineDash([]); ctx.lineWidth = 1;
    }
  }

  // ---- Mouse interactions ----
  function onMouseDown(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const proj = recomputeProjection(); if (!proj) return;
    if (x > proj.chartW || y > proj.chartH) return;
    const t = proj.xToTime(x), p = proj.yToPrice(y);
    if (tool === 'trendline' || tool === 'rectangle') {
      setDrawing({ id: `tmp-${Date.now()}`, type: tool, from: { t, p }, to: { t, p } });
    } else if (tool === 'eraser') {
      const hit = findShapeAt(x, y, proj);
      if (hit && onShapeRemove) onShapeRemove(hit.id);
    } else if (tool === 'cursor') {
      // Start drag-pan
      setPanStart({ x: e.clientX, offset: view.offset });
    }
  }
  function onMouseMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    setHover({ x, y });
    if (drawing) {
      const proj = recomputeProjection(); if (!proj) return;
      const t = proj.xToTime(x), p = proj.yToPrice(y);
      setDrawing(d => d ? { ...d, to: { t, p } } : null);
    } else if (panStart) {
      // Convert pixel delta to candle-count delta. Pan right -> show older.
      const proj = projRef.current;
      if (proj) {
        const dx = e.clientX - panStart.x;
        const candleDelta = Math.round(dx / proj.candleSpacing);
        const maxOffset = Math.max(0, candles.length - view.count);
        setView(v => ({ ...v, offset: Math.max(0, Math.min(maxOffset, panStart.offset + candleDelta)) }));
      }
    }
  }
  function onMouseUp() {
    if (drawing && onShapeAdd) {
      const dt = Math.abs(drawing.to.t - drawing.from.t);
      const dp = Math.abs(drawing.to.p - drawing.from.p);
      if (dt > 0.001 || dp > 0.000001) {
        onShapeAdd({ ...drawing, id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
      }
    }
    setDrawing(null);
    setPanStart(null);
  }
  function onMouseLeave() { setHover(null); setDrawing(null); setPanStart(null); }

  function onWheel(e) {
    e.preventDefault();
    // Zoom in/out by adjusting visible candle count. Negative deltaY = zoom in.
    const direction = e.deltaY > 0 ? 1 : -1;
    const step = Math.max(2, Math.floor(view.count * 0.1));
    setView(v => {
      const max = Math.max(20, candles.length); // can zoom out up to all available candles
      const next = Math.max(15, Math.min(Math.min(250, max), v.count + direction * step));
      // Clamp offset so we don't try to view beyond available data
      const maxOffset = Math.max(0, candles.length - next);
      const offset = Math.min(v.offset, maxOffset);
      return { count: next, offset };
    });
  }

  // ---- Touch / Pinch handlers (mobile chart zoom) ----
  function touchDist(t) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.hypot(dx, dy);
  }
  function onTouchStart(e) {
    if (e.touches.length === 2) {
      // Start 2-finger pinch
      setPinchStart({ distance: touchDist(e.touches), count: view.count, offset: view.offset });
      setPanStart(null);
      setDrawing(null);
      e.preventDefault();
    } else if (e.touches.length === 1 && tool === 'cursor') {
      // Single-finger pan
      setPanStart({ x: e.touches[0].clientX, offset: view.offset });
    }
  }
  function onTouchMove(e) {
    if (e.touches.length === 2 && pinchStart) {
      const d = touchDist(e.touches);
      const ratio = pinchStart.distance / d; // >1 = fingers got closer -> zoom out
      let next = Math.round(pinchStart.count * ratio);
      next = Math.max(15, Math.min(250, next));
      const maxOffset = Math.max(0, candles.length - next);
      const offset = Math.min(pinchStart.offset, maxOffset);
      setView({ count: next, offset });
      e.preventDefault();
    } else if (e.touches.length === 1 && panStart) {
      const proj = projRef.current;
      if (proj) {
        const dx = e.touches[0].clientX - panStart.x;
        const candleDelta = Math.round(dx / proj.candleSpacing);
        const maxOffset = Math.max(0, candles.length - view.count);
        setView(v => ({ ...v, offset: Math.max(0, Math.min(maxOffset, panStart.offset + candleDelta)) }));
      }
      e.preventDefault();
    }
  }
  function onTouchEnd(e) {
    if (e.touches.length < 2) setPinchStart(null);
    if (e.touches.length === 0) setPanStart(null);
  }

  const resetView = () => setView({ count: 60, offset: 0 });
  const isCustomView = view.count !== 60 || view.offset !== 0;

  function findShapeAt(x, y, proj) {
    const TOL = 6;
    for (let i = (shapes || []).length - 1; i >= 0; i--) {
      const sh = shapes[i];
      const x1 = proj.timeToX(sh.from.t), y1 = proj.priceToY(sh.from.p);
      const x2 = proj.timeToX(sh.to.t), y2 = proj.priceToY(sh.to.p);
      if (sh.type === 'trendline') {
        // distance from point to segment
        const A = x - x1, B = y - y1, C = x2 - x1, D = y2 - y1;
        const dot = A * C + B * D, lenSq = C * C + D * D;
        let t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, dot / lenSq));
        const px = x1 + t * C, py = y1 + t * D;
        if (Math.hypot(x - px, y - py) <= TOL) return sh;
      } else if (sh.type === 'rectangle') {
        const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
        const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);
        // hit test on border
        const onLeft = Math.abs(x - rx) <= TOL && y >= ry - TOL && y <= ry + rh + TOL;
        const onRight = Math.abs(x - (rx + rw)) <= TOL && y >= ry - TOL && y <= ry + rh + TOL;
        const onTop = Math.abs(y - ry) <= TOL && x >= rx - TOL && x <= rx + rw + TOL;
        const onBot = Math.abs(y - (ry + rh)) <= TOL && x >= rx - TOL && x <= rx + rw + TOL;
        if (onLeft || onRight || onTop || onBot) return sh;
        // also inside (filled area click)
        if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) return sh;
      }
    }
    return null;
  }

  // RAF loop
  useEffect(() => {
    let raf;
    const loop = () => { draw(); raf = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const ro = new ResizeObserver(() => draw());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cursor = panStart ? 'grabbing' : tool === 'cursor' ? 'grab' : tool === 'eraser' ? 'not-allowed' : 'cell';

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#0c1015]">
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        className="absolute inset-0"
        style={{ cursor, touchAction: 'none' }}
      />
      {/* Zoom indicator + reset button (top-right of chart, left of price axis) */}
      <div className="absolute top-2 right-[80px] flex items-center gap-1 text-[10px] text-white/40 pointer-events-none">
        <span className="font-mono">{view.count} bars{view.offset > 0 ? ` · -${view.offset}` : ''}</span>
      </div>
      {isCustomView && (
        <button
          onClick={resetView}
          className="absolute bottom-9 right-[78px] z-20 bg-[#11161e] hover:bg-[#1a8eff] hover:text-white text-white/70 border border-white/10 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase shadow-lg flex items-center gap-1 transition"
          title="Reset zoom · jump to latest"
        >
          ↻ Live
        </button>
      )}
    </div>
  );
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
