"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

import { KioskState } from "@/lib/kioskMachine";

interface Props {
  state: KioskState;
  onSet: (field: "visitor_name" | "purpose", value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function VisitorMode({ state, onSet, onSubmit, onCancel }: Props) {
  const { visitor, error, busy } = state;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center px-12"
    >
      <h1 className="text-5xl font-bold">Misafir Girişi</h1>
      <p className="mt-3 text-xl text-white/50">Hoş geldiniz! Birkaç bilgi alalım.</p>

      <label className="mt-10 block text-2xl font-semibold">Adınız</label>
      <input
        ref={inputRef}
        value={visitor.visitor_name}
        onChange={(e) => onSet("visitor_name", e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder="Mehmet Demir"
        className={inputCls}
      />

      <label className="mt-6 block text-2xl font-semibold">
        Ziyaret amacı / kimi ziyaret <span className="text-white/40">(opsiyonel)</span>
      </label>
      <input
        value={visitor.purpose}
        onChange={(e) => onSet("purpose", e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder="Toplantı · Ahmet Hoca"
        className={inputCls}
      />

      {error && <p className="mt-6 text-xl text-red-400">{error}</p>}

      <div className="mt-10 flex items-center justify-between">
        <span className="text-white/50">[Esc] iptal</span>
        <button
          onClick={onSubmit}
          disabled={busy}
          className="rounded-xl bg-violet-600 px-8 py-3 text-xl font-semibold transition hover:bg-violet-500 disabled:opacity-50"
        >
          Giriş Yap <span className="text-white/60">[Enter]</span>
        </button>
      </div>
    </motion.div>
  );
}

const inputCls =
  "mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-6 py-4 text-2xl outline-none focus:border-violet-400";
