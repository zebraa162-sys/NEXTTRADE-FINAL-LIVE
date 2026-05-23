'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight, Smartphone, BarChart3, Zap, Shield, Headphones, Award,
  TrendingUp, ChevronRight, CheckCircle2, Star, Globe, Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import QuotexLogo from '@/components/QuotexLogo';

const Feature = ({ icon: Icon, title, desc }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="bg-[#11161e] border border-white/5 rounded-2xl p-6 hover:border-[#00b97a]/40 transition-all hover:-translate-y-1"
  >
    <div className="w-12 h-12 rounded-xl bg-[#00b97a]/10 border border-[#00b97a]/20 flex items-center justify-center mb-4">
      <Icon className="w-6 h-6 text-[#00b97a]" />
    </div>
    <h3 className="text-white text-lg font-semibold mb-2">{title}</h3>
    <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
  </motion.div>
);

export default function LandingPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-[#0c1015] text-white">
      {/* Navbar */}
      <header className="border-b border-white/5 bg-[#0c1015]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/"><QuotexLogo /></Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/70">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
            <a href="#about" className="hover:text-white">About</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="text-white/80 hover:text-white" onClick={() => router.push('/login')}>Log in</Button>
            <Button className="bg-[#00b97a] hover:bg-[#00a86d] text-white font-semibold" onClick={() => router.push('/signup')}>Sign Up</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 qx-bg-grid opacity-30" />
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-[#00b97a]/10 rounded-full blur-3xl" />
        <div className="absolute top-32 -right-32 w-[500px] h-[500px] bg-[#1a8eff]/10 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center relative">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
            <div className="inline-flex items-center gap-2 bg-[#00b97a]/10 border border-[#00b97a]/30 text-[#00b97a] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <Zap className="w-3.5 h-3.5" />
              400+ ASSETS • $1 MIN TRADE • 24/7 OTC
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.1] mb-6">
              Your go-to platform for <span className="text-[#00b97a]">online trading</span> in financial markets
            </h1>
            <p className="text-white/60 text-lg mb-8 max-w-xl">
              The most user friendly interface is at your fingertips, granting you access to trade more than 400+ diverse global trading assets.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="bg-[#00b97a] hover:bg-[#00a86d] text-white font-bold text-base px-8 h-14" onClick={() => router.push('/signup')}>
                Registration <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="bg-white text-[#0c1015] hover:bg-white/90 border-0 font-bold text-base px-8 h-14" onClick={() => router.push('/trade')}>
                Open demo account
              </Button>
            </div>
            <div className="flex items-center gap-6 mt-10 text-sm text-white/50">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#00b97a]"/> $10 min deposit</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#00b97a]"/> 0% fees</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#00b97a]"/> Demo $10,000</div>
            </div>
          </motion.div>

          {/* Hero illustration: live mini chart */}
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="relative">
            <div className="aspect-[4/3] rounded-3xl bg-gradient-to-br from-[#11161e] to-[#0a0d12] border border-white/10 p-4 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 qx-bg-grid opacity-20" />
              <div className="flex items-center justify-between mb-3 relative">
                <div>
                  <div className="text-xs text-white/50">XAU/USD (OTC)</div>
                  <div className="text-2xl font-bold text-white">2,350.<span className="text-[#00b97a]">128</span></div>
                </div>
                <div className="px-2.5 py-1 rounded-md bg-[#00b97a]/15 text-[#00b97a] text-xs font-bold">+0.42%</div>
              </div>
              <svg viewBox="0 0 400 220" className="w-full h-full relative">
                <defs>
                  <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#00b97a" stopOpacity="0.4"/>
                    <stop offset="100%" stopColor="#00b97a" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path d="M0 160 L40 140 L80 150 L120 110 L160 130 L200 90 L240 100 L280 70 L320 85 L360 50 L400 65 L400 220 L0 220 Z" fill="url(#g1)"/>
                <path d="M0 160 L40 140 L80 150 L120 110 L160 130 L200 90 L240 100 L280 70 L320 85 L360 50 L400 65" fill="none" stroke="#00b97a" strokeWidth="2.5"/>
                {[40,80,120,160,200,240,280,320,360].map((x,i) => (
                  <circle key={i} cx={x} cy={[140,150,110,130,90,100,70,85,50][i]} r="3" fill="#00b97a" />
                ))}
              </svg>
              <div className="absolute right-6 bottom-6 flex flex-col gap-2 w-40">
                <div className="bg-[#00b97a] text-white text-sm font-bold py-3 rounded-lg text-center">UP ↑</div>
                <div className="bg-[#ff5555] text-white text-sm font-bold py-3 rounded-lg text-center">DOWN ↓</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature strip */}
      <section id="features" className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-4 gap-4">
          <Feature icon={BarChart3} title="Convenient trading interface" desc="We created the most minimalist and convenient interface so nothing distracts from the main thing — trading." />
          <Feature icon={Zap} title="Integrated signals" desc="Approach the strategy thoughtfully. The most precise and resourceful signals will help create an effective strategy." />
          <Feature icon={TrendingUp} title="Trading indicators" desc="We have gathered the most popular trading indicators to boost your account balance." />
          <Feature icon={Globe} title="Perfect speed" desc="Our platform runs on the most modern technology and delivers incredible speed." />
        </div>
      </section>

      {/* Three cards */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Wallet, t: '$1 minimum trade amount', d: 'Start trading with a minimum investment of $1. Investments of up to $1,000.' },
            { icon: Award, t: '50% Bonus on first deposit', d: 'Get a 50% bonus to your first deposit when you make a deposit of $50 or more.' },
            { icon: Shield, t: 'Risk-free trading', d: 'Unlimited trading on a demo account with $10,000 on the balance.' },
            { icon: CheckCircle2, t: '0% fee', d: 'No fees on deposits or withdrawals — completely transparent platform.' },
            { icon: Headphones, t: '24/7 Online Support', d: 'You can always get in touch with us — our team is available 24/7.' },
            { icon: TrendingUp, t: 'Account level Raise', d: 'Increase your account level for exclusive promo codes and benefits.' },
          ].map((it) => (
            <Feature key={it.t} icon={it.icon} title={it.t} desc={it.d} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="container mx-auto px-4 py-16">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-2">Start trading with NEXT-TRADEX</h2>
        <p className="text-white/50 text-center mb-12">in 3 simple steps</p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { n: '01', t: 'Sign up', d: 'Open an account for free. Just takes a few minutes.' },
            { n: '02', t: 'Practice', d: 'Sharpen your skills with a $10,000 demo account.' },
            { n: '03', t: 'Deposit and trade', d: 'Use 100+ payment methods. Minimum deposit just $10.' },
          ].map(s => (
            <div key={s.n} className="bg-[#11161e] border border-white/5 rounded-2xl p-8">
              <div className="text-5xl font-extrabold text-[#00b97a]/30 mb-2">{s.n}</div>
              <h3 className="text-xl font-semibold mb-2">{s.t}</h3>
              <p className="text-white/60 text-sm">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Reviews */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl md:text-4xl font-bold mb-8">Trader opinions</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { n: 'Ashok Kumar', s: 5, q: 'NEXT-TRADEX is really a good platform for trading. Charts are fast in terms of response.' },
            { n: 'Maria Lopes', s: 5, q: 'Withdrawals are fast and the platform is highly customizable for my strategies.' },
            { n: 'David Chen', s: 5, q: 'Best UX I have used in binary options. Demo account is very generous.' },
          ].map(r => (
            <div key={r.n} className="bg-[#11161e] border border-white/5 rounded-2xl p-6">
              <div className="flex gap-0.5 text-[#00b97a] mb-3">{Array.from({ length: r.s }).map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}</div>
              <p className="text-white/80 mb-4 text-sm leading-relaxed">“{r.q}”</p>
              <div className="text-sm font-semibold">{r.n}</div>
              <div className="text-xs text-white/40">Verified trader</div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container mx-auto px-4 py-16">
        <h2 className="text-3xl md:text-4xl font-bold mb-8">Frequently asked questions</h2>
        <Accordion type="single" collapsible className="max-w-3xl bg-[#11161e] border border-white/5 rounded-2xl px-6">
          {[
            { q: 'How to learn?', a: 'Open a free demo account with $10,000 virtual funds and practice without any risk before going live.' },
            { q: 'How long does it take to withdraw funds?', a: 'Withdrawals are processed within 3 business days for crypto and most local payment methods.' },
            { q: 'What is a trading platform and why is it needed?', a: 'A trading platform is software that lets you analyze the market and place trades. It is essential for participating in financial markets.' },
            { q: 'Can I trade with the phone?', a: 'Yes — our web platform is fully responsive and works perfectly on mobile.' },
            { q: 'What is the minimum deposit amount?', a: 'The minimum deposit is just $10, and the minimum trade is $1.' },
            { q: 'Is there any fee for depositing or withdrawing funds?', a: 'No — we charge 0% fees on deposits and withdrawals.' },
          ].map((it, i) => (
            <AccordionItem key={i} value={`f${i}`} className="border-white/5">
              <AccordionTrigger className="text-left text-white hover:text-[#00b97a]">{it.q}</AccordionTrigger>
              <AccordionContent className="text-white/60">{it.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="rounded-3xl bg-gradient-to-r from-[#11161e] to-[#0a0d12] border border-white/5 p-10 md:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 qx-bg-grid opacity-20" />
          <h2 className="text-3xl md:text-5xl font-extrabold mb-4 relative">NEXT-TRADEX: Innovation Broker Platform</h2>
          <p className="text-white/60 mb-8 relative">Digital Asset Trading — start with as little as $1.</p>
          <div className="flex flex-wrap gap-3 justify-center relative">
            <Button size="lg" className="bg-[#00b97a] hover:bg-[#00a86d] text-white font-bold text-base px-8 h-14" onClick={() => router.push('/signup')}>
              Open real account
            </Button>
            <Button size="lg" variant="outline" className="bg-white text-[#0c1015] hover:bg-white/90 border-0 font-bold text-base px-8 h-14" onClick={() => router.push('/trade')}>
              Demo account
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-10 mt-10">
        <div className="container mx-auto px-4 grid md:grid-cols-4 gap-8 text-sm">
          <div>
            <QuotexLogo />
            <p className="text-white/40 mt-4 text-xs leading-relaxed">Risk Warning: Trading carries a high level of risk and may not be suitable for all investors.</p>
          </div>
          <div>
            <div className="font-semibold mb-3">Affiliates</div>
            <ul className="space-y-2 text-white/50"><li>Sign up</li><li>Login</li></ul>
          </div>
          <div>
            <div className="font-semibold mb-3">FAQ</div>
            <ul className="space-y-2 text-white/50"><li>Trading questions</li><li>Verification</li></ul>
          </div>
          <div id="about">
            <div className="font-semibold mb-3">Regulations</div>
            <ul className="space-y-2 text-white/50"><li>Terms & conditions</li><li>Privacy Policy</li></ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
