import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, KeyRound, AlertCircle, ArrowLeft, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { EKGLine } from '../components/EKGLine';
import { Button } from '../components/Button';

type Step = 'email' | 'code';

// Auto-focus the email field only on desktop. On phones it pops the keyboard
// the moment the page loads, covering the title and disorienting first-time visitors.
const SHOULD_AUTO_FOCUS_EMAIL =
  typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

export default function LoginPage() {
  const navigate              = useNavigate();
  const [step, setStep]       = useState<Step>('email');
  const [email, setEmail]     = useState('');
  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [resent, setResent]   = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => codeRef.current?.focus(), 150);
    }
  }, [step]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
    });
    setLoading(false);
    if (err) { setError(err.message); }
    else     { setStep('code'); setResent(false); }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.replace(/\s/g, '');
    if (trimmed.length !== 8) return;
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: trimmed,
      type: 'email',
    });
    setLoading(false);
    if (err) { setError('Invalid or expired code. Try again.'); }
    else     { navigate('/', { replace: true }); }
  };

  const handleResend = async () => {
    setError('');
    setCode('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
    });
    if (!err) setResent(true);
  };

  const handleCodeChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 8);
    setCode(digits);
    setError('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 60%, rgba(198,40,40,0.12) 0%, transparent 65%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="text-6xl mb-4"
          >
            🎱
          </motion.div>
          <h1
            className="font-[Bebas_Neue] text-6xl tracking-widest leading-none"
            style={{
              color: '#E8E2D6',
              textShadow: '0 0 40px rgba(198,40,40,0.4), 0 2px 8px rgba(0,0,0,0.6)',
            }}
          >
            TOP OF THE<br />CAPITAL
          </h1>
          <p className="text-[#9CA3AF] font-[Barlow] text-sm mt-2 tracking-[0.2em] uppercase">
            Helena Pool League
          </p>
          <EKGLine className="mx-auto mt-3" />
          {/* Tagline gives first-time visitors a one-line answer to "what is this?" */}
          <p className="text-[#A1A1AA] font-[Barlow] text-base mt-5 leading-relaxed">
            Track your matches. Climb the ladder.{' '}
            <span className="text-[#E8E2D6] font-semibold">Defend your spot.</span>
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'email' ? (
            <motion.form
              key="email-step"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleSendCode}
              className="glass-card p-6 space-y-4"
            >
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-[#9CA3AF] text-sm font-[Barlow] mb-2"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    placeholder="your@email.com"
                    autoFocus={SHOULD_AUTO_FOCUS_EMAIL}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] font-[Barlow] text-base placeholder-[#6B7280] focus:outline-none focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828]/30 transition-colors"
                  />
                </div>
                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-1.5 text-[#EF4444] text-sm mt-2 font-[Barlow]"
                  >
                    <AlertCircle size={14} /> {error}
                  </motion.p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                loading={loading}
                disabled={!email.trim()}
              >
                <Mail size={16} /> Send Sign-In Code
              </Button>

              {/* Helper bumped from text-xs (12px) to text-sm (14px) for legibility.
                  Fixed: was "6-digit", actual code is 8 digits. */}
              <p className="text-center text-[#A1A1AA] text-sm font-[Barlow] leading-relaxed">
                We'll email you an 8-digit code. No password needed.
              </p>
            </motion.form>
          ) : (
            <motion.form
              key="code-step"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleVerifyCode}
              className="glass-card p-6 space-y-5"
            >
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setCode(''); setError(''); }}
                  aria-label="Back to email step"
                  className="text-[#9CA3AF] hover:text-[#E8E2D6] transition-colors"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <div className="font-[Barlow] font-semibold text-[#E8E2D6] text-sm">
                    Check your email
                  </div>
                  <div className="text-[#A1A1AA] text-sm font-[Barlow]">
                    Code sent to {email}
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-code"
                  className="flex items-center gap-1.5 text-[#9CA3AF] text-sm font-[Barlow] mb-3"
                >
                  <KeyRound size={14} /> 8-Digit Code
                </label>
                <input
                  id="login-code"
                  name="otp"
                  ref={codeRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="00000000"
                  maxLength={8}
                  className="w-full px-4 py-4 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] font-[Azeret_Mono] text-3xl text-center tracking-[0.5em] placeholder-[#3A3A3A] focus:outline-none focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828]/30 transition-colors"
                />
                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-1.5 text-[#EF4444] text-sm mt-2 font-[Barlow]"
                  >
                    <AlertCircle size={14} /> {error}
                  </motion.p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                loading={loading}
                disabled={code.replace(/\s/g, '').length !== 8}
              >
                Sign In
              </Button>

              <div className="text-center">
                {resent ? (
                  <p className="text-[#22C55E] text-sm font-[Barlow]">Code resent!</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-[#9CA3AF] text-sm font-[Barlow] underline underline-offset-2 hover:text-[#E8E2D6] transition-colors"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Quiet help link below the card. First-time visitors and locked-out members
            need an escape hatch — there was no contact path before. */}
        <div className="mt-5 text-center">
          <a
            href="mailto:help@toc.monster?subject=TOC%20sign-in%20help"
            className="inline-flex items-center gap-1.5 text-[#71717A] hover:text-[#A1A1AA] text-sm font-[Barlow] transition-colors"
          >
            <HelpCircle size={14} /> Trouble signing in?
          </a>
        </div>
      </motion.div>
    </div>
  );
}
