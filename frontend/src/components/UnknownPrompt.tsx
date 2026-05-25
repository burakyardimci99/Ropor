"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface Props {
  onRegister: () => void;
  onVisitor: () => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
}

export function UnknownPrompt({ onRegister, onVisitor, onCancel, busy, error }: Props) {
  const [secs, setSecs] = useState(15);

  useEffect(() => {
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      if (e.key === "Enter") onRegister();
      else if (e.key.toLowerCase() === "g") onVisitor();
      else if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onRegister, onVisitor, onCancel, busy]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex h-full w-full flex-col items-center justify-center px-12 text-center"
    >
      <div className="text-6xl font-bold">Sizi tanıyamadık 👋</div>
      <p className="mt-4 text-2xl text-white/60">AI Lab&apos;a hoş geldiniz!</p>

      <div className="mt-12 flex gap-6">
        <button
          onClick={onRegister}
          disabled={busy}
          className="rounded-xl bg-cyan-600 px-10 py-5 text-2xl font-semibold transition hover:bg-cyan-500 disabled:opacity-50"
        >
          Kayıt Ol <span className="ml-2 text-white/60">[Enter]</span>
        </button>
        <button
          onClick={onVisitor}
          disabled={busy}
          className="rounded-xl bg-white/10 px-10 py-5 text-2xl font-semibold transition hover:bg-white/20 disabled:opacity-50"
        >
          Misafir <span className="ml-2 text-white/50">[G]</span>
        </button>
      </div>

      {error && <p className="mt-8 text-xl text-red-400">{error}</p>}

      <p className="mt-12 text-lg text-white/30">
        {secs > 0 ? `${secs} saniye içinde misafir moduna…` : "Misafir moduna geçiliyor…"}
      </p>
    </motion.div>
  );
}
