'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Loader2, CheckCircle2, AlertTriangle, Wallet, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// Withdrawal channel mirrors deposits: Binance only. The user supplies the
// Binance ID + recipient name where they want funds sent. Admin reviews and
// pays out manually.
export default function WithdrawalModal({ open, onClose, user, onUserUpdate, onSuccess }) {
  const [binanceId, setBinanceId] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [minAmount, setMinAmount] = useState(10);

  // Pull global min withdrawal from public settings
  useEffect(() => {
    if (!open) return;
    api.publicSettings().then(r => {
      const m = Number(r?.settings?.minWithdrawal);
      if (m > 0) setMinAmount(m);
    }).catch(() => {});
  }, [open]);

  const liveBal = user?.liveBalance || 0;

  const reset = () => { setBinanceId(''); setRecipient(''); setAmount(''); setDone(false); };
  const handleClose = () => { onClose(); reset(); };

  const submit = async () => {
    const amt = Number(amount);
    if (!binanceId.trim() || binanceId.trim().length < 4) { toast.error('Binance ID is required'); return; }
    if (!recipient.trim()) { toast.error('Recipient name is required'); return; }
    if (!(amt >= minAmount)) { toast.error(`Minimum withdrawal is $${minAmount}`); return; }
    if (amt > liveBal) { toast.error(`Insufficient live balance (max $${liveBal.toFixed(2)})`); return; }
    setSubmitting(true);
    try {
      const r = await api.createWithdrawal({
        amount: amt,
        method: 'binance',
        methodData: {
          binance_id: binanceId.trim(),
          recipient: recipient.trim(),
        },
      });
      toast.success('Withdrawal request submitted — pending admin approval');
      if (r.user) onUserUpdate?.(r.user);
      setDone(true);
      onSuccess?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg w-[96vw] sm:w-full bg-[#0a0d12] border-white/10 p-0 overflow-hidden max-h-[94vh] flex flex-col">
        <DialogTitle className="sr-only">Withdraw via Binance</DialogTitle>

        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#ff5555]/15 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-[#ff5555]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Withdraw · Binance</h2>
              <div className="text-[10px] text-white/50">Manual payout · approved by admin</div>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-md hover:bg-white/5 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-[#00b97a]/20 mx-auto flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8 text-[#00b97a]" />
            </div>
            <div className="text-lg font-bold mb-1">Request Submitted</div>
            <div className="text-sm text-white/60 mb-4">The admin will review and process your withdrawal shortly. Funds were placed on hold from your Live balance.</div>
            <Button onClick={handleClose} className="bg-[#00b97a] hover:bg-[#00a86d] font-bold">Done</Button>
          </div>
        ) : (
          <div className="overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Live balance summary */}
            <div className="bg-gradient-to-br from-[#1a8eff]/10 to-transparent border border-[#1a8eff]/30 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Available (Live)</div>
                <div className="text-2xl font-extrabold text-white mt-0.5">${liveBal.toFixed(2)}</div>
              </div>
              <ShieldCheck className="w-7 h-7 text-[#1a8eff]" />
            </div>

            {/* Binance ID */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-[#f0b90b] text-black text-xs font-bold flex items-center justify-center">1</div>
                <div className="text-sm font-bold">Your Binance ID</div>
              </div>
              <Input
                value={binanceId}
                onChange={(e) => setBinanceId(e.target.value)}
                placeholder="e.g. 123456789"
                className="bg-[#11161e] border-white/10 h-10 text-sm font-mono"
              />
              <div className="text-[10px] text-white/40 mt-1">Funds will be sent to this Binance ID.</div>
            </div>

            {/* Recipient name */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-[#1a8eff] text-white text-xs font-bold flex items-center justify-center">2</div>
                <div className="text-sm font-bold">Recipient name</div>
              </div>
              <Input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Full name registered on Binance"
                className="bg-[#11161e] border-white/10 h-10 text-sm"
              />
            </div>

            {/* Amount */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-[#1a8eff] text-white text-xs font-bold flex items-center justify-center">3</div>
                <div className="text-sm font-bold">Amount to withdraw (USD)</div>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                <Input
                  type="number"
                  min={minAmount}
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Minimum $${minAmount}`}
                  className="bg-[#11161e] border-white/10 pl-7 h-11 text-base font-bold"
                />
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <button onClick={() => setAmount(String(minAmount))} className="px-2 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-white/70">Min</button>
                <button onClick={() => setAmount(String(Math.floor(liveBal * 0.25)))} className="px-2 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-white/70">25%</button>
                <button onClick={() => setAmount(String(Math.floor(liveBal * 0.5)))} className="px-2 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-white/70">50%</button>
                <button onClick={() => setAmount(String(Math.floor(liveBal * 0.75)))} className="px-2 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-white/70">75%</button>
                <button onClick={() => setAmount(String(Math.floor(liveBal)))} className="px-2 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-[#00b97a] font-bold">Max</button>
              </div>
            </div>

            <div className="flex items-start gap-2 text-[11px] text-white/50 bg-[#11161e] border border-white/5 rounded-lg p-3">
              <AlertTriangle className="w-3.5 h-3.5 text-[#f0b90b] shrink-0 mt-0.5" />
              <span>The amount is held from your Live balance immediately. If the admin rejects the request, funds are refunded.</span>
            </div>

            <Button
              onClick={submit}
              disabled={submitting || liveBal <= 0}
              className="w-full h-11 bg-[#ff5555] hover:bg-[#ee4444] font-bold text-sm"
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {submitting ? 'Submitting…' : 'Submit Withdrawal Request'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
