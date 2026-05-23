'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User as UserIcon, Mail, Shield, Wallet, KeyRound, ArrowLeft, Loader2,
  CheckCircle2, LogOut, Pencil
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import QuotexLogo from '@/components/QuotexLogo';
import { api, getStoredUser, setStoredUser, setToken } from '@/lib/api';
import { toast } from 'sonner';

function Stat({ label, value, accent }) {
  return (
    <div className="bg-[#0c1015] border border-white/5 rounded-xl p-4" data-testid={`account-stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="text-[11px] uppercase tracking-wide text-white/40">{label}</div>
      <div className={`mt-1 text-lg font-bold ${accent || 'text-white'}`}>{value}</div>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Profile form
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [editingName, setEditingName] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = getStoredUser();
      if (!stored) {
        router.push('/login');
        return;
      }
      try {
        const r = await api.me();
        const fresh = r.user || r;
        setUser(fresh);
        setName(fresh.name || '');
        setStoredUser(fresh);
      } catch (e) {
        // token likely expired
        setToken(null);
        setStoredUser(null);
        router.push('/login');
      } finally {
        setLoaded(true);
      }
    })();
  }, [router]);

  const handleUpdateName = async (e) => {
    e?.preventDefault();
    if (!name.trim()) { toast.error('Name cannot be empty.'); return; }
    setSavingName(true);
    try {
      const r = await api.updateProfile(name.trim());
      setUser(r.user);
      setStoredUser(r.user);
      toast.success('Profile updated.');
      setEditingName(false);
    } catch (err) {
      toast.error(err.message || 'Failed to update profile.');
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e) => {
    e?.preventDefault();
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      toast.error('New password must be different from the current one.');
      return;
    }
    setSavingPass(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      toast.success('Password updated. Please use it next time you log in.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      toast.error(err.message || 'Failed to change password.');
    } finally {
      setSavingPass(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setStoredUser(null);
    toast.success('Logged out.');
    router.push('/login');
  };

  if (!loaded || !user) {
    return (
      <div className="min-h-screen bg-[#0c1015] flex items-center justify-center text-white/60">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading your account...
      </div>
    );
  }

  const newPassMismatch = confirmNewPassword.length > 0 && newPassword !== confirmNewPassword;

  return (
    <div className="min-h-screen bg-[#0c1015] text-white" data-testid="account-page">
      <header className="border-b border-white/5 bg-[#0c1015]/90 sticky top-0 z-10 backdrop-blur">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/trade" data-testid="account-back-to-trade" className="flex items-center gap-2 text-white/70 hover:text-white text-sm">
              <ArrowLeft className="w-4 h-4" /> Back to trade
            </Link>
            <div className="hidden md:block h-5 w-px bg-white/10" />
            <Link href="/" className="hidden md:block"><QuotexLogo compact /></Link>
          </div>
          <Button
            onClick={handleLogout}
            data-testid="account-logout-btn"
            variant="ghost"
            className="text-white/70 hover:text-[#ff5555]"
          >
            <LogOut className="w-4 h-4 mr-2" /> Log out
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        {/* Profile header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00b97a]/30 to-[#22d3ee]/20 border border-[#00b97a]/40 flex items-center justify-center text-2xl font-extrabold">
            {(user.name || user.email || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold" data-testid="account-display-name">{user.name || '—'}</h1>
              {user.role === 'admin' && (
                <span className="px-2 py-0.5 bg-[#f0b90b]/15 text-[#f0b90b] text-[10px] font-bold rounded uppercase" data-testid="account-admin-badge">Admin</span>
              )}
            </div>
            <div className="text-sm text-white/50 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> {user.email}
            </div>
          </div>
        </div>

        {/* Balances */}
        <div className="grid md:grid-cols-3 gap-3 mb-8">
          <Stat label="Demo balance" value={`$${Number(user.demoBalance || 0).toFixed(2)}`} accent="text-[#00b97a]" />
          <Stat label="Live balance" value={`$${Number(user.liveBalance || 0).toFixed(2)}`} accent="text-white" />
          <Stat label="Active account" value={(user.activeAccount || 'demo').toUpperCase()} accent="text-[#22d3ee]" />
        </div>

        {/* Profile card */}
        <Card className="bg-[#11161e] border-white/5 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserIcon className="w-4 h-4 text-[#00b97a]" /> Profile information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white/60 text-xs">Full name</Label>
                {editingName ? (
                  <form onSubmit={handleUpdateName} className="flex items-center gap-2 mt-1">
                    <Input
                      data-testid="account-name-input"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="bg-[#0c1015] border-white/10 h-10 flex-1"
                      maxLength={60}
                    />
                    <Button type="submit" size="sm" disabled={savingName} data-testid="account-name-save-btn" className="bg-[#00b97a] hover:bg-[#00a86d] h-10">
                      {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => { setEditingName(false); setName(user.name || ''); }} data-testid="account-name-cancel-btn" className="text-white/60 h-10">
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between mt-1 bg-[#0c1015] border border-white/10 rounded-md h-10 px-3">
                    <span className="text-sm">{user.name || '—'}</span>
                    <button
                      type="button"
                      onClick={() => setEditingName(true)}
                      className="text-[#00b97a] hover:text-[#00d488] text-xs font-semibold flex items-center gap-1"
                      data-testid="account-name-edit-btn"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-white/60 text-xs">Email</Label>
                <div className="mt-1 bg-[#0c1015] border border-white/10 rounded-md h-10 px-3 flex items-center text-sm text-white/70">
                  {user.email}
                </div>
                <div className="text-[11px] text-white/30 mt-1">Email cannot be changed. Contact support to update.</div>
              </div>

              <div>
                <Label className="text-white/60 text-xs">Role</Label>
                <div className="mt-1 bg-[#0c1015] border border-white/10 rounded-md h-10 px-3 flex items-center text-sm">
                  <Shield className="w-3.5 h-3.5 mr-2 text-white/40" />
                  <span className="capitalize">{user.role}</span>
                </div>
              </div>

              <div>
                <Label className="text-white/60 text-xs">User ID</Label>
                <div className="mt-1 bg-[#0c1015] border border-white/10 rounded-md h-10 px-3 flex items-center text-[11px] font-mono text-white/50 truncate" data-testid="account-user-id">
                  {user.id}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change password card */}
        <Card className="bg-[#11161e] border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="w-4 h-4 text-[#00b97a]" /> Change password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md" data-testid="change-password-form">
              <div>
                <Label className="text-white/60 text-xs">Current password</Label>
                <Input
                  data-testid="account-current-password-input"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="bg-[#0c1015] border-white/10 mt-1 h-10"
                  required
                  autoComplete="current-password"
                />
              </div>
              <div>
                <Label className="text-white/60 text-xs">New password</Label>
                <Input
                  data-testid="account-new-password-input"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="bg-[#0c1015] border-white/10 mt-1 h-10"
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label className="text-white/60 text-xs">Confirm new password</Label>
                <Input
                  data-testid="account-confirm-new-password-input"
                  type="password"
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  className={`bg-[#0c1015] mt-1 h-10 ${newPassMismatch ? 'border-[#ff5555]' : 'border-white/10'}`}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                {newPassMismatch && (
                  <p className="text-[11px] text-[#ff5555] mt-1" data-testid="account-new-password-mismatch">Passwords do not match.</p>
                )}
              </div>
              <Button
                type="submit"
                data-testid="account-change-password-btn"
                disabled={savingPass || newPassMismatch}
                className="bg-[#00b97a] hover:bg-[#00a86d] font-semibold"
              >
                {savingPass ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
                Update password
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-white/30 text-[11px] mt-10">
          © {new Date().getFullYear()} NEXT-TRADEX. All rights reserved.
        </div>
      </div>
    </div>
  );
}
