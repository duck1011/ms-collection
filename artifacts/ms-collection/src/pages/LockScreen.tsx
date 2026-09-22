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
  if (!value) return <div aria-hidden="true" />;
  const isDelete = value === "⌫";
  return (
    <motion.button
      onClick={() => onClick(value)}
      whileTap={{ scale: 0.96 }}
      aria-label={isDelete ? "Delete last digit" : `Digit ${value}`}
      className={`w-19 h-19 max-[359px]:w-[68px] max-[359px]:h-[68px] rounded-full bg-[#121B24] border border-[#26383D] text-[27px] max-[359px]:text-[24px] font-semibold transition-colors duration-150 cursor-pointer select-none flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#72B8AD]/50 focus-visible:ring-offset-2 hover:bg-[#16222B] active:bg-[#72B8AD] active:text-[#071012] shadow-[0_2px_10px_rgba(2,6,12,0.45)] ${isDelete ? "text-[#6AAFA4]" : "text-[#F3F7F5]"}`}
    >
      {isDelete ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-90" aria-hidden="true">
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
    <div className="flex gap-3.5 justify-center items-center">
      {Array.from({ length: max }).map((_, i) => (
        <motion.div
          key={i}
          initial={false}
          animate={i < length ? { scale: 1, opacity: 1 } : { scale: 0.88, opacity: 0.6 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className={`w-3.5 h-3.5 rounded-full transition-colors duration-300 ${
            i < length
              ? "bg-[#72B8AD] border border-[#72B8AD]/40 shadow-[0_0_8px_rgba(114,184,173,0.35)]"
              : "bg-[#17262B] border border-[#26383D]/50"
          }`}
        />
      ))}
    </div>
  );
}

// ── Background ──────────────────────────────────────────────────────

function BackgroundGlow() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Calm dark base with a barely-there vertical shift */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#070B12] via-[#0B121A] to-[#070B12]" />

      {/* Subtle teal ambience, kept very restrained */}
      <motion.div
        animate={{ opacity: [0.35, 0.5, 0.35] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-36 -left-24 w-[420px] h-[420px] rounded-full bg-[#123237]/40 blur-3xl"
      />
      <motion.div
        animate={{ opacity: [0.25, 0.4, 0.25] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute -bottom-40 -right-28 w-[480px] h-[480px] rounded-full bg-[#123237]/25 blur-3xl"
      />
    </div>
  );
}
// ── Lock Screen (PIN only) ──────────────────────────────────────────

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
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden overflow-y-auto overscroll-contain bg-[#070B12]">
      <BackgroundGlow />

      {/* The section is pinned to 100dvh; the outer container may scroll so the keypad
          is never clipped on very short viewports (e.g. iOS landscape / small phones). */}
      <div
        className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 42px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[320px]"
        >
          <div className="flex flex-col items-center">
            {/* Panda Hero — floating sticker, no bubble/circle, soft silhouette shadow */}
            <motion.div animate={floatAnimation} className="relative mb-[26px] shrink-0">
              <img
                src={import.meta.env.BASE_URL + "sleeping-panda.png"}
                alt="MS Collection"
                className="w-32 h-32 max-[359px]:w-28 max-[359px]:h-28 object-contain drop-shadow-[0_18px_28px_rgba(2,6,12,0.45)]"
                draggable={false}
              />
            </motion.div>

            {/* Title */}
            <h1 className="text-center text-[30px] leading-tight font-bold tracking-tight text-[#DCEFEB]">
              MS Collection
            </h1>

            {/* Subtitle */}
            <p className="text-center mt-2 mb-[30px] text-base text-[#8F9C9D]">
              Masukkan PIN untuk mengakses sistem
            </p>

            {/* PIN indicators */}
            <div className="mb-[42px] space-y-3">
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
            <div className="grid grid-cols-3 gap-3.5 w-full max-w-[300px] mx-auto mb-[26px]" role="group" aria-label="Numeric keypad">
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
              className="w-full max-w-[300px] h-[52px] rounded-full bg-[#0B121A] border border-[#72B8AD]/40 text-[#6AAFA4] text-base font-semibold tracking-wide transition-all duration-200 hover:bg-[#16222B] hover:border-[#72B8AD]/70 active:bg-[#72B8AD] active:text-[#071012] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#0B121A] disabled:hover:border-[#72B8AD]/40 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#72B8AD]/50 focus-visible:ring-offset-2 focus:outline-none"
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
    </div>
  );
}