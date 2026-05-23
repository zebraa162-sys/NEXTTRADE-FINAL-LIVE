'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import QuotexLogo from '@/components/QuotexLogo';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, KeyRound, ArrowLeft, Mail } from 'lucide-react';

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [step, setStep] = useState(email ? 2 : 1); // 1: request, 2: verify+set
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const request = async (e) => {
    e?.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await api.passwordRequest(email);
      toast.success('If that email is registered, a reset code is on its way.');
      setStep(2);
      setResendCooldown(45);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const reset = async (e) => {
    e?.preventDefault();
    const clean = String(code).replace(/\D/g, '');
    if (clean.length !== 6) { toast.error('Enter the 6-digit code from your email.'); return; }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await api.passwordReset(email, clean, newPassword);
      toast.success('Password updated. Please log in with your new password.');
      router.push('/login');
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  return (
    <div className="min-h-screen bg-[#0c1015] grid md:grid-cols-2" data-testid="reset-page">
      <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-[#0a1d18] to-[#0c1015] relative overflow-hidden">
        <div className="absolute inset-0 qx-bg-grid opacity-30" />
        <Link href="/" className="relative" data-testid="reset-logo-home"><QuotexLogo /></Link>
        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight mb-4">Reset your<br/><span className="text-[#00b97a]">Password</span></h1>
          <p className="text-white/60 max-w-md">Enter your email and we'll send you a 6-digit code to reset your password securely.</p>
        </div>
        <div className="relative text-white/40 text-xs">© {new Date().getFullYear()} NEXT-TRADEX. All rights reserved.</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-[#11161e] border-white/5">
          {step === 1 ? (
            <>
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-[#00b97a]/15 flex items-center justify-center mb-2">
                  <Mail className="w-6 h-6 text-[#00b97a]" />
                </div>
                <CardTitle className="text-2xl">Forgot password?</CardTitle>
                <p className="text-sm text-white/50">Enter the email tied to your account.</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={request} className="space-y-4" data-testid="reset-request-form">
                  <div>
                    <Label className="text-white/70">Email</Label>
                    <Input
                      data-testid="reset-email-input"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="bg-[#0c1015] border-white/10 mt-1.5 h-11"
                      type="email"
                      required
                      placeholder="you@example.com"
                    />
                  </div>
                  <Button data-testid="reset-request-btn" disabled={loading} className="w-full bg-[#00b97a] hover:bg-[#00a86d] h-11 font-semibold">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Send reset code'}
                  </Button>
                </form>
                <div className="mt-4 text-sm text-white/50 text-center">
                  <Link href="/login" className="text-[#00b97a] hover:underline font-semibold inline-flex items-center gap-1" data-testid="reset-goto-login">
                    <ArrowLeft className="w-3 h-3" /> Back to login
                  </Link>
                </div>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <button onClick={() => setStep(1)} className="text-white/50 hover:text-white text-xs flex items-center gap-1 mb-2" data-testid="reset-back-btn"><ArrowLeft className="w-3 h-3" /> Back</button>
                <div className="w-12 h-12 rounded-xl bg-[#00b97a]/15 flex items-center justify-center mb-2">
                  <KeyRound className="w-6 h-6 text-[#00b97a]" />
                </div>
                <CardTitle className="text-2xl">Set new password</CardTitle>
                <p className="text-sm text-white/50">Enter the 6-digit code we emailed you and choose a new password.</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={reset} className="space-y-4" data-testid="reset-form">
                  <div>
                    <Label className="text-white/70">Code</Label>
                    <Input
                      data-testid="reset-code-input"
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
                  <div>
                    <Label className="text-white/70">New password</Label>
                    <Input
                      data-testid="reset-new-password-input"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="bg-[#0c1015] border-white/10 mt-1.5 h-11"
                      type="password"
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                  <div>
                    <Label className="text-white/70">Confirm new password</Label>
                    <Input
                      data-testid="reset-confirm-password-input"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className={`bg-[#0c1015] mt-1.5 h-11 ${mismatch ? 'border-[#ff5555]' : 'border-white/10'}`}
                      type="password"
                      required
                      minLength={6}
                      placeholder="Re-enter your password"
                    />
                    {mismatch && <p className="text-[11px] text-[#ff5555] mt-1">Passwords do not match.</p>}
                  </div>
                  <Button data-testid="reset-submit-btn" disabled={loading || mismatch} className="w-full bg-[#00b97a] hover:bg-[#00a86d] h-11 font-semibold">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Reset password'}
                  </Button>
                  <button
                    type="button"
                    onClick={request}
                    disabled={resendCooldown > 0 || loading}
                    className="w-full text-sm text-white/60 hover:text-[#00b97a] disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="reset-resend-btn"
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                  </button>
                </form>
                <div className="mt-4 text-xs text-white/40 text-center">
                  Code expires in 30 minutes. Check spam if it doesn't arrive within 60 seconds.
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

import { Suspense } from 'react';
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0c1015]" />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
