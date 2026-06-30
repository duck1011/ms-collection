import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { authenticate, getPin } from "@/lib/auth";

// ── Floating animation keyframes ────────────────────────────────────

const floatAnimation = {
  y: [0, -6, 0],
  transition: {
    duration: 4,
    repeat: Infinity,
    ease: "easeInOut" as const,
  },
};

// ── Numeric Keypad ──────────────────────────────────────────────────

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "⌫"],
];

function KeypadButton({ value, onClick }: { value: string; onClick: (v: string) => void }) {
  if (!value) return <div />;
  const isDelete = value === "⌫";
  return (
    <motion.button
      onClick={() => onClick(value)}
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.04 }}
      className="w-16 sm:w-20 h-16 sm:h-20 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 text-xl sm:text-2xl font-semibold text-white hover:bg-white/10 hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(123,92,255,0.15)] active:bg-white/15 transition-all duration-200 cursor-pointer select-none flex items-center justify-center mx-auto focus:outline-none"
    >
      {isDelete ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
          <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
          <line x1="18" y1="9" x2="12" y2="15" />
          <line x1="12" y1="9" x2="18" y2="15" />
        </svg>
      ) : (
        value
      )}
    </motion.button>
  );
}

// ── PIN Dot Indicator ───────────────────────────────────────────────

function PinDots({ length, max }: { length: number; max: number }) {
  return (
    <div className="flex gap-3 sm:gap-4 justify-center items-center">
      {Array.from({ length: max }).map((_, i) => (
        <motion.div
          key={i}
          initial={false}
          animate={
            i < length
              ? { scale: 1, opacity: 1 }
              : { scale: 0.85, opacity: 0.25 }
          }
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className={`w-3 sm:w-3.5 h-3 sm:h-3.5 rounded-full transition-all duration-300 ${
            i < length
              ? "bg-gradient-to-r from-[#7B5CFF] to-[#A855F7] shadow-[0_0_12px_rgba(123,92,255,0.5)]"
              : "bg-white/15 border border-white/10"
          }`}
        />
      ))}
    </div>
  );
}

// ── Background Particles ────────────────────────────────────────────

function BackgroundGlow() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* Main gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050816] via-[#0A1022] to-[#050816]" />
      
      {/* Subtle radial glows */}
      <motion.div
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-[#7B5CFF]/10 via-transparent to-transparent blur-3xl"
      />
      <motion.div
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-[#FF4D9D]/8 via-transparent to-transparent blur-3xl"
      />
      <motion.div
        animate={{ opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[#00E5FF]/5 blur-3xl"
      />

      {/* Subtle grid lines for depth */}
      <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[size:40px_40px]" />
    </div>
  );
}

// ── Lock Screen ─────────────────────────────────────────────────────

export default function LockScreen() {
  const [, setLocation] = useLocation();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const correctPin = getPin();
  const maxDigits = 6;

  // Focus hidden input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const handlePinComplete = useCallback(
    (enteredPin: string) => {
      if (enteredPin === correctPin) {
        setSuccess(true);
        setTimeout(() => {
          authenticate();
          setLocation("/");
        }, 500);
      } else {
        setError("PIN salah. Silakan coba lagi.");
        setShaking(true);
        setTimeout(() => {
          setShaking(false);
          setPin("");
        }, 600);
      }
    },
    [correctPin, setLocation]
  );

  const handleKeyPress = useCallback(
    (value: string) => {
      if (success) return;
      if (error) setError(null);

      if (value === "⌫") {
        setPin((prev) => prev.slice(0, -1));
        return;
      }

      if (pin.length >= maxDigits) return;

      const newPin = pin + value;
      setPin(newPin);

      if (newPin.length === maxDigits) {
        handlePinComplete(newPin);
      }
    },
    [pin, error, success, maxDigits, handlePinComplete]
  );

  const handleSubmit = useCallback(() => {
    if (pin.length === 0 || success) return;
    handlePinComplete(pin);
  }, [pin, success, handlePinComplete]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && pin.length > 0) {
        handleSubmit();
      }
    },
    [handleSubmit, pin]
  );

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      <BackgroundGlow />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm px-6 sm:px-0"
      >
        <div className="flex flex-col items-center space-y-7 sm:space-y-8">
          {/* Panda Hero */}
          <motion.div
            animate={floatAnimation}
            className="relative"
          >
            {/* Glow behind panda */}
            <div className="absolute -inset-8 sm:-inset-10 rounded-full bg-gradient-to-br from-[#7B5CFF]/20 via-[#A855F7]/10 to-[#FF4D9D]/10 blur-2xl" />
            
            {/* Glass container with white background for panda visibility */}
            <div className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-44 md:h-44 rounded-full bg-white backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl">
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[#7B5CFF]/5 via-transparent to-[#FF4D9D]/5" />
              <img
                src="/panda.png"
                alt="MS Collection"
                className="w-[85%] h-[85%] object-contain drop-shadow-lg"
              />
            </div>
          </motion.div>

          {/* Title */}
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-[#7B5CFF] via-[#A855F7] to-[#FF4D9D] bg-clip-text text-transparent">
              MS Collection
            </h1>
            <p className="text-sm text-[#AEB4C2]">Masukkan PIN untuk mengakses sistem</p>
          </div>

          {/* PIN Dots */}
          <div className="space-y-3">
            <AnimatePresence mode="wait">
              {error && (
                <motion.p
                  key="error"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="text-xs text-red-400 text-center"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.div
              animate={shaking ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : {}}
              transition={{ duration: 0.45 }}
            >
              <PinDots length={pin.length} max={maxDigits} />
            </motion.div>
          </div>

          {/* Hidden input for keyboard */}
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={pin}
            onChange={(e) => {
              if (success) return;
              const digits = e.target.value.replace(/\D/g, "").slice(0, maxDigits);
              setPin(digits);
              setError(null);
              if (digits.length === maxDigits) {
                handlePinComplete(digits);
              }
            }}
            onKeyDown={handleKeyDown}
            className="sr-only"
            aria-hidden="true"
          />

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full max-w-[240px] sm:max-w-[280px] mx-auto" role="group" aria-label="Numeric keypad">
            {KEYS.flat().map((key, i) => (
              <KeypadButton key={key || `spacer-${i}`} value={key} onClick={handleKeyPress} />
            ))}
          </div>

          {/* CTA Button */}
          <motion.button
            onClick={handleSubmit}
            disabled={pin.length === 0 || success}
            whileTap={pin.length > 0 ? { scale: 0.97 } : {}}
            whileHover={pin.length > 0 ? { scale: 1.02 } : {}}
            className="w-full max-w-[240px] sm:max-w-[280px] h-14 rounded-full bg-gradient-to-r from-[#7B5CFF] via-[#A855F7] to-[#FF4D9D] text-white font-bold text-sm tracking-wider hover:shadow-[0_0_30px_rgba(123,92,255,0.3)] active:shadow-[0_0_20px_rgba(123,92,255,0.2)] transition-all duration-300 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:shadow-none cursor-pointer"
          >
            <motion.span
              animate={success ? { opacity: 0 } : { opacity: 1 }}
              className="inline-block"
            >
              MASUK
            </motion.span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}