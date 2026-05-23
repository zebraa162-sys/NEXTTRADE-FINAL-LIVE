'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover';
import { ChevronDown, Wallet, RefreshCw, Send, ArrowDownToLine, Receipt, Activity, User, LogOut, Check, Edit2 } from 'lucide-react';
import { api, setStoredUser, setToken } from '@/lib/api';
import { toast } from 'sonner';

export default function AccountSwitcher({ user, onUserUpdate, onOpenDeposit, onOpenWithdrawal, compact = false }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const isLive = user.activeAccount === 'live';
  const balance = isLive ? user.liveBalance : user.demoBalance;

  const switchTo = async (account) => {
    try {
      const r = await api.switchAccount(account);
      onUserUpdate?.(r.user);
      toast.success(`Switched to ${account.toUpperCase()}`);
    } catch (e) { toast.error(e.message); }
  };

  const resetDemo = async (e) => {
    e?.stopPropagation();
    try {
      const r = await api.resetDemo();
      onUserUpdate?.(r.user);
      toast.success('Demo balance reset to $10,000');
    } catch (e) { toast.error(e.message); }
  };

  const logout = () => { setToken(null); setStoredUser(null); router.push('/login'); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={`flex items-center ${compact ? 'gap-1.5 px-2 py-1' : 'gap-3 px-3 py-1.5'} bg-[#11161e] hover:bg-[#161c26] border border-white/5 rounded-lg`}>
          <div className={`${compact ? 'w-5 h-5' : 'w-7 h-7'} rounded-full ${isLive ? 'bg-[#00b97a]/20' : 'bg-white/5'} flex items-center justify-center`}>
            <Send className={`${compact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} ${isLive ? 'text-[#00b97a]' : 'text-white/60'}`} />
          </div>
          <div className="text-left">
            <div className={`${compact ? 'text-[8px]' : 'text-[10px]'} text-[#00b97a] uppercase font-bold tracking-wider leading-none`}>{user.activeAccount} ACCT</div>
            <div className={`${compact ? 'text-xs' : 'text-sm'} font-bold leading-tight`}>${Number(balance || 0).toFixed(2)}</div>
          </div>
          <ChevronDown className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-white/40`} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[92vw] max-w-[440px] p-0 bg-[#0a0d12] border-white/10" align={compact ? 'center' : 'end'}>
        <div className="flex flex-col sm:flex-row">
          {/* LEFT: Account picker */}
          <div className="flex-1 p-4 border-b sm:border-b-0 sm:border-r border-white/5">
            {/* Profit header */}
            <div className="bg-[#11161e] rounded-lg p-3 mb-3 flex items-center justify-between border border-white/5">
              <div>
                <div className="text-[10px] uppercase text-white/40 font-bold tracking-wider">STANDARD:</div>
                <div className="text-[#00b97a] text-sm font-bold flex items-center gap-1">
                  <Send className="w-3 h-3" /> +0% profit
                </div>
              </div>
              <Edit2 className="w-4 h-4 text-white/30 hover:text-white/60 cursor-pointer" />
            </div>

            <div className="text-sm font-medium text-white mb-1">{user.email}</div>
            <div className="text-xs text-white/40 mb-3">ID: {user.id?.slice(0, 8).toUpperCase()}</div>

            <div className="flex items-center gap-2 mb-4 text-xs">
              <span className="text-white/50">Currency:</span>
              <span className="font-bold">USD</span>
              <button className="px-2 py-0.5 bg-[#1a8eff] text-white text-[10px] rounded font-bold">CHANGE</button>
            </div>

            <div className="h-px bg-white/5 my-3" />

            {/* Live Account row */}
            <div
              onClick={() => switchTo('live')}
              className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1 shrink-0 ${isLive ? 'border-[#1a8eff] bg-[#1a8eff]' : 'border-white/30'}`}>
                {isLive && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">Live Account</div>
                <div className="text-xl font-bold mt-0.5">${Number(user.liveBalance || 0).toFixed(2)}</div>
                <div className="text-xs text-white/40 mt-0.5">The daily limit is not set</div>
                <div className="text-xs text-[#1a8eff] font-bold mt-0.5 cursor-pointer hover:underline">SET LIMIT</div>
              </div>
            </div>

            <div className="h-px bg-white/5 my-3" />

            {/* Demo Account row */}
            <div
              onClick={() => switchTo('demo')}
              className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1 shrink-0 ${!isLive ? 'border-[#1a8eff] bg-[#1a8eff]' : 'border-white/30'}`}>
                {!isLive && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </div>
              <div className="flex-1 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Demo Account</div>
                  <div className="text-xl font-bold mt-0.5">${Number(user.demoBalance || 0).toFixed(2)}</div>
                </div>
                <button onClick={resetDemo} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center" title="Reset to $10,000">
                  <RefreshCw className="w-4 h-4 text-[#00b97a]" />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Action menu */}
          <div className="w-full sm:w-44 p-3 flex flex-col text-sm">
            <NavBtn onClick={() => { setOpen(false); router.push('/transactions'); }} data-testid="acct-nav-transactions"><Receipt className="w-4 h-4" /> Transactions</NavBtn>
            <NavBtn onClick={() => { setOpen(false); router.push('/trades-history'); }} data-testid="acct-nav-trades"><Activity className="w-4 h-4" /> Trades</NavBtn>
            <NavBtn onClick={() => { setOpen(false); router.push('/account'); }} data-testid="acct-nav-account"><User className="w-4 h-4" /> My account</NavBtn>
            {user.role === 'admin' && (
              <NavBtn onClick={() => { setOpen(false); router.push('/admin'); }} className="text-[#00b97a]" data-testid="acct-nav-admin">
                <Activity className="w-4 h-4" /> Admin
              </NavBtn>
            )}
            <div className="flex-1" />
            <div className="h-px bg-white/5 my-2" />
            <NavBtn onClick={logout} className="text-[#ff5555]" data-testid="acct-nav-logout"><LogOut className="w-4 h-4" /> Logout</NavBtn>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NavBtn({ children, className = '', onClick, 'data-testid': testId }) {
  return (
    <button onClick={onClick} data-testid={testId} className={`flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/5 text-left text-white/80 ${className}`}>
      {children}
    </button>
  );
}
