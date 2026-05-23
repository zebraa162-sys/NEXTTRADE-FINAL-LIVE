'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare, Plus, ArrowLeft, Send, X, Loader2, CheckCircle2, Clock, Sparkles,
  AlertCircle, Inbox
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, getStoredUser, setStoredUser, setToken } from '@/lib/api';
import { toast } from 'sonner';
import TradingLiteLogo from '@/components/TradingLiteLogo';

function fmtTime(d) {
  const t = new Date(d);
  const now = new Date();
  const sameDay = t.toDateString() === now.toDateString();
  return sameDay ? t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : t.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SupportPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [active, setActive] = useState(null); // full ticket with messages
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const u = getStoredUser();
    if (!u) { router.push('/login'); return; }
    setUser(u);
  }, [router]);

  const loadTickets = async () => {
    try {
      const r = await api.listMyTickets();
      setTickets(r.tickets || []);
    } catch (e) { /* silent */ }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    loadTickets();
    const id = setInterval(loadTickets, 5000);
    return () => clearInterval(id);
  }, [user]);

  // Poll active ticket every 3s to receive admin replies
  useEffect(() => {
    if (!active?.id) return;
    let stop = false;
    const poll = async () => {
      if (stop) return;
      try {
        const r = await api.getTicket(active.id);
        if (!stop && r.ticket) setActive(r.ticket);
      } catch {}
    };
    const id = setInterval(poll, 3000);
    return () => { stop = true; clearInterval(id); };
  }, [active?.id]);

  // Auto scroll to latest message
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [active?.messages?.length]);

  const openTicket = async (id) => {
    try {
      const r = await api.getTicket(id);
      setActive(r.ticket);
      // Refresh list to update unread badges
      loadTickets();
    } catch (e) { toast.error(e.message); }
  };

  const submitNew = async () => {
    const s = subject.trim();
    const m = message.trim();
    if (!s || !m) { toast.error('Please fill both fields'); return; }
    setSending(true);
    try {
      const r = await api.createTicket(s, m);
      toast.success('Ticket created');
      setSubject(''); setMessage('');
      setNewOpen(false);
      loadTickets();
      if (r.ticket) openTicket(r.ticket.id);
    } catch (e) { toast.error(e.message); }
    setSending(false);
  };

  const submitReply = async () => {
    const t = reply.trim();
    if (!t || !active) return;
    setSending(true);
    try {
      const r = await api.postTicketMessage(active.id, t);
      setActive(r.ticket);
      setReply('');
      loadTickets();
    } catch (e) { toast.error(e.message); }
    setSending(false);
  };

  return (
    <div className="min-h-[100dvh] bg-[#0c1015] text-white flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-white/5 bg-[#0a0d12] flex items-center justify-between px-3 sm:px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/trade')} className="w-9 h-9 rounded-md hover:bg-white/5 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="hidden sm:block">
            <TradingLiteLogo compact />
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#1a8eff]" />
            <h1 className="text-base sm:text-lg font-bold">Live Support</h1>
          </div>
        </div>
        <Button onClick={() => setNewOpen(true)} size="sm" className="bg-[#1a8eff] hover:bg-[#1278e6] h-9">
          <Plus className="w-4 h-4 mr-1" /> <span className="hidden xs:inline sm:inline">New Ticket</span><span className="xs:hidden sm:hidden">New</span>
        </Button>
      </header>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Ticket list */}
        <aside className={`${active ? 'hidden md:flex' : 'flex'} w-full md:w-[340px] border-r border-white/5 bg-[#0a0d12] flex-col shrink-0`}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-white/40 text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading tickets...
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <Inbox className="w-10 h-10 text-white/20 mb-3" />
              <div className="text-sm font-semibold text-white/60">No tickets yet</div>
              <div className="text-xs text-white/40 mt-1">Start a conversation with our support team.</div>
              <Button onClick={() => setNewOpen(true)} size="sm" className="mt-4 bg-[#1a8eff] hover:bg-[#1278e6]">
                <Plus className="w-4 h-4 mr-1" /> Create Ticket
              </Button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {tickets.map(t => (
                <button
                  key={t.id}
                  onClick={() => openTicket(t.id)}
                  className={`w-full text-left px-3 py-3 border-b border-white/[0.04] hover:bg-white/5 transition ${active?.id === t.id ? 'bg-[#1a8eff]/10' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{t.subject}</div>
                      <div className="text-xs text-white/50 truncate mt-0.5">
                        {t.lastSender === 'admin' ? '💬 Support: ' : 'You: '}{t.lastMessage}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-white/40">{fmtTime(t.lastMessageAt)}</span>
                      {t.unreadForUser > 0 ? (
                        <span className="px-1.5 h-4 min-w-[16px] rounded-full bg-[#ff5555] text-white text-[10px] font-bold flex items-center justify-center">{t.unreadForUser}</span>
                      ) : t.status === 'closed' ? (
                        <span className="px-1.5 h-4 rounded-full bg-white/10 text-white/60 text-[9px] font-bold flex items-center">CLOSED</span>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Conversation */}
        <section className={`${active ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 flex-col bg-[#0c1015]`}>
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <Sparkles className="w-10 h-10 text-[#1a8eff]/60 mb-3" />
              <div className="text-base font-semibold">Select a ticket</div>
              <div className="text-xs text-white/40 mt-1">Choose a conversation from the list or start a new one.</div>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="h-14 border-b border-white/5 bg-[#0a0d12] flex items-center justify-between px-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setActive(null)} className="md:hidden w-8 h-8 rounded-md hover:bg-white/5 flex items-center justify-center">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{active.subject}</div>
                    <div className="flex items-center gap-2 text-[10px] text-white/40 mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{fmtTime(active.createdAt)}</span>
                      {active.status === 'closed' ? (
                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-semibold">CLOSED</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-[#00b97a]/15 text-[#00b97a] font-semibold">OPEN</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-3 sm:p-4 space-y-2">
                {(active.messages || []).map(m => (
                  <MessageBubble key={m.id} msg={m} isMine={m.sender === 'user'} />
                ))}
              </div>

              {/* Reply box */}
              <div className="border-t border-white/5 bg-[#0a0d12] p-2 sm:p-3 shrink-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}>
                {active.status === 'closed' ? (
                  <div className="flex items-center gap-2 text-xs text-white/50 bg-white/5 rounded-md p-3 justify-center">
                    <AlertCircle className="w-4 h-4" />
                    This ticket is closed. Create a new ticket to continue.
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <textarea
                      rows={1}
                      placeholder="Type your message..."
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply(); } }}
                      className="flex-1 resize-none bg-[#11161e] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#1a8eff]/50 max-h-32 min-h-[38px]"
                    />
                    <Button onClick={submitReply} disabled={sending || !reply.trim()} className="bg-[#1a8eff] hover:bg-[#1278e6] h-10 px-4">
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {/* New ticket modal */}
      {newOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setNewOpen(false)}>
          <div className="bg-[#0a0d12] border border-white/10 rounded-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="h-1 bg-gradient-to-r from-[#1a8eff] via-[#22d3ee] to-[#00b97a] animate-pulse" />
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#1a8eff]" /> New Support Ticket
                </h2>
                <button onClick={() => setNewOpen(false)} className="w-8 h-8 rounded-md hover:bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/50">Subject</label>
                  <Input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="What's your issue about?"
                    className="bg-[#11161e] border-white/10 mt-1"
                    maxLength={150}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/50">Message</label>
                  <textarea
                    rows={5}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Describe your issue in detail..."
                    className="mt-1 w-full resize-none bg-[#11161e] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#1a8eff]/50"
                    maxLength={4000}
                  />
                </div>
                <Button onClick={submitNew} disabled={sending} className="w-full bg-[#1a8eff] hover:bg-[#1278e6] font-bold">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Create Ticket
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, isMine }) {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] sm:max-w-[75%] rounded-lg px-3 py-2 ${
        isMine ? 'bg-[#1a8eff]/20 border border-[#1a8eff]/30' : 'bg-[#11161e] border border-white/10'
      }`}>
        <div className={`text-[10px] uppercase tracking-wider mb-0.5 font-semibold ${isMine ? 'text-[#1a8eff]' : 'text-[#00b97a]'}`}>
          {isMine ? 'You' : 'Support'}
        </div>
        <div className="text-sm whitespace-pre-wrap break-words">{msg.text}</div>
        <div className="text-[10px] text-white/40 mt-1 flex items-center gap-1 justify-end">
          <CheckCircle2 className="w-3 h-3" />
          {fmtTime(msg.createdAt)}
        </div>
      </div>
    </div>
  );
}
