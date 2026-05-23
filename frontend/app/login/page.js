'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import QuotexLogo from '@/components/QuotexLogo';
import { api, setToken, setStoredUser } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const r = await api.login(email, password);
      setToken(r.token); setStoredUser(r.user);
      toast.success(`Welcome back, ${r.user.name}`);
      router.push(r.user.role === 'admin' ? '/admin' : '/trade');
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0c1015] grid md:grid-cols-2" data-testid="login-page">
      <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-[#0a1d18] to-[#0c1015] relative overflow-hidden">
        <div className="absolute inset-0 qx-bg-grid opacity-30" />
        <Link href="/" className="relative" data-testid="login-logo-home"><QuotexLogo /></Link>
        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight mb-4">Trade Smarter,<br/><span className="text-[#00b97a]">Profit Faster.</span></h1>
          <p className="text-white/60 max-w-md">Access 400+ assets with our cutting-edge OTC trading engine. Live or demo — start in seconds.</p>
        </div>
        <div className="relative text-white/40 text-xs">© {new Date().getFullYear()} NEXT-TRADEX. All rights reserved.</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-[#11161e] border-white/5">
          <CardHeader>
            <CardTitle className="text-2xl">Log in</CardTitle>
            <p className="text-sm text-white/50">Welcome back. Enter your details to continue.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4" data-testid="login-form">
              <div>
                <Label className="text-white/70">Email</Label>
                <Input data-testid="login-email-input" value={email} onChange={e => setEmail(e.target.value)} className="bg-[#0c1015] border-white/10 mt-1.5 h-11" type="email" required placeholder="you@example.com"/>
              </div>
              <div>
                <Label className="text-white/70">Password</Label>
                <Input data-testid="login-password-input" value={password} onChange={e => setPassword(e.target.value)} className="bg-[#0c1015] border-white/10 mt-1.5 h-11" type="password" required placeholder="••••••••"/>
              </div>
              <Button data-testid="login-submit-btn" disabled={loading} className="w-full bg-[#00b97a] hover:bg-[#00a86d] h-11 font-semibold">
                {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Log in'}
              </Button>
            </form>
            <div className="mt-6 text-sm text-white/50 text-center">
              No account? <Link href="/signup" className="text-[#00b97a] hover:underline font-semibold" data-testid="login-goto-signup">Sign up</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
