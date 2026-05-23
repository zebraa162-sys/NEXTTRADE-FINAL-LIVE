'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import QuotexLogo from '@/components/QuotexLogo';
import { api, setToken, setStoredUser } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1 = details, 2 = verify code
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const submitDetails = async (e) => {
    e?.preventDefault();
    if (password.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { toast.error('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await api.signupRequest(email, password, name);
      toast.success(`We sent a 6-digit code to ${email}`);
      setStep(2);
      setResendCooldown(45);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const submitCode = async (e) => {
    e?.preventDefault();
    const clean = String(code).replace(/\D/g, '');
    if (clean.length !== 6) { toast.error('Enter the 6-digit code from your email.'); return; }
    setLoading(true);
    try {
      const r = await api.signupVerify(email, clean);
      setToken(r.token); setStoredUser(r.user);
      toast.success('Email verified — welcome!');
      router.push('/trade');
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const resend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      await api.signupRequest(email, password, name);
      toast.success('New code sent.');
      setResendCooldown(45);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="min-h-screen bg-[#0c1015] grid md:grid-cols-2" data-testid="signup-page">
      <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-[#0a1d18] to-[#0c1015] relative overflow-hidden">
        <div className="absolute inset-0 qx-bg-grid opacity-30" />
        <Link href="/" className="relative" data-testid="signup-logo-home"><QuotexLogo /></Link>
        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight mb-4">$10,000 Demo<br/><span className="text-[#00b97a]">Free — No Deposit Required</span></h1>
          <p className="text-white/60 max-w-md">Sign up takes 30 seconds. Start practicing or switch to live in one click.</p>
        </div>
        <div className="relative text-white/40 text-xs">© {new Date().getFullYear()} NEXT-TRADEX. All rights reserved.</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-[#11161e] border-white/5">
          {step === 1 ? (
            <>
              <CardHeader>
                <CardTitle className="text-2xl">Sign up</CardTitle>
                <p className="text-sm text-white/50">Create your free trading account.</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitDetails} className="space-y-4" data-testid="signup-form">
                  <div>
                    <Label className="text-white/70">Name</Label>
                    <Input data-testid="signup-name-input" value={name} onChange={e => setName(e.target.value)} className="bg-[#0c1015] border-white/10 mt-1.5 h-11" placeholder="Your full name" />
                  </div>
                  <div>
                    <Label className="text-white/70">Email</Label>
                    <Input data-testid="signup-email-input" value={email} onChange={e => setEmail(e.target.value)} className="bg-[#0c1015] border-white/10 mt-1.5 h-11" type="email" required placeholder="you@example.com"/>
                  </div>
                  <div>
                    <Label className="text-white/70">Password</Label>
                    <Input data-testid="signup-password-input" value={password} onChange={e => setPassword(e.target.value)} className="bg-[#0c1015] border-white/10 mt-1.5 h-11" type="password" required minLength={6} placeholder="Minimum 6 characters"/>
                  </div>
                  <div>
                    <Label className="text-white/70">Confirm password</Label>
                    <Input
                      data-testid="signup-confirm-password-input"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className={`bg-[#0c1015] mt-1.5 h-11 ${mismatch ? 'border-[#ff5555]' : 'border-white/10'}`}
                      type="password"
                      required
                      minLength={6}
                      placeholder="Re-enter your password"
                    />
                    {mismatch && (
                      <p className="text-[11px] text-[#ff5555] mt-1" data-testid="signup-password-mismatch">Passwords do not match.</p>
                    )}
                  </div>
                  <Button data-testid="signup-submit-btn" disabled={loading || mismatch} className="w-full bg-[#00b97a] hover:bg-[#00a86d] h-11 font-semibold">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Continue'}
                  </Button>
                  <p className="text-[11px] text-white/40 text-center pt-1">
                    We'll send a 6-digit verification code to your email.
                  </p>
                </form>
                <div className="mt-4 text-sm text-white/50 text-center">
                  Already have an account? <Link href="/login" className="text-[#00b97a] hover:underline font-semibold" data-testid="signup-goto-login">Log in</Link>
                </div>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <button onClick={() => setStep(1)} className="text-white/50 hover:text-white text-xs flex items-center gap-1 mb-2" data-testid="signup-back-btn"><ArrowLeft className="w-3 h-3" /> Back</button>
                <div className="w-12 h-12 rounded-xl bg-[#00b97a]/15 flex items-center justify-center mb-2">
                  <Mail className="w-6 h-6 text-[#00b97a]" />
                </div>
                <CardTitle className="text-2xl">Check your email</CardTitle>
                <p className="text-sm text-white/50">Enter the 6-digit code we sent to <span className="text-white font-medium">{email}</span>.</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitCode} className="space-y-4" data-testid="signup-verify-form">
                  <div>
                    <Label className="text-white/70">Verification code</Label>
                    <Input
                      data-testid="signup-otp-input"
                      value={code}
                      onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="bg-[#0c1015] border-white/10 mt-1.5 h-14 text-center text-2xl font-bold tracking-[0.4em]"
                      placeholder="000000"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                    />
                  </div>
                  <Button data-testid="signup-verify-btn" disabled={loading || code.length !== 6} className="w-full bg-[#00b97a] hover:bg-[#00a86d] h-11 font-semibold">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Verify & create account'}
                  </Button>
                  <button
                    type="button"
                    onClick={resend}
                    disabled={resendCooldown > 0 || loading}
                    className="w-full text-sm text-white/60 hover:text-[#00b97a] disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="signup-resend-btn"
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                  </button>
                </form>
                <div className="mt-4 text-xs text-white/40 text-center">
                  Code expires in 10 minutes. Check spam if it doesn't arrive within 60 seconds.
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
