"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { ScanViewport } from "@/components/kiosk/visuals";

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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="state-anim flex h-full w-full items-center justify-center"
      style={{ gap: "80px" }}
    >
      <ScanViewport state="fail" size={460} />

      <div className="flex flex-col items-start" style={{ maxWidth: "920px" }}>
        <div style={{ fontSize: "84px", fontWeight: 800, color: "#FFFFFF", lineHeight: 1 }}>
          Sizi tanıyamadık
        </div>
        <div style={{ fontSize: "40px", color: "#F8D88A", fontWeight: 500, marginTop: "18px", lineHeight: 1.25, maxWidth: "860px" }}>
          AI Lab&apos;a hoş geldiniz! Devam etmek için bir seçenek seçin.
        </div>

        <div className="flex" style={{ gap: "24px", marginTop: "48px" }}>
          <button
            onClick={onRegister}
            disabled={busy}
            style={{
              padding: "26px 52px", borderRadius: "20px", fontSize: "34px", fontWeight: 700,
              border: "none", cursor: "pointer", color: "#04101f",
              background: "linear-gradient(150deg, #5BC0FF, #0B63C4)",
              boxShadow: "0 0 50px -10px rgba(45,168,255,.8)", opacity: busy ? 0.5 : 1,
            }}
          >
            Kayıt Ol <span style={{ opacity: 0.6, marginLeft: "10px" }}>[Enter]</span>
          </button>
          <button
            onClick={onVisitor}
            disabled={busy}
            className="glass"
            style={{
              padding: "26px 52px", borderRadius: "20px", fontSize: "34px", fontWeight: 700,
              border: "2px solid rgba(91,192,255,.35)", cursor: "pointer", color: "#CFE6FF",
              opacity: busy ? 0.5 : 1,
            }}
          >
            Misafir <span style={{ opacity: 0.55, marginLeft: "10px" }}>[G]</span>
          </button>
        </div>

        {error && <div style={{ marginTop: "28px", fontSize: "30px", color: "#FCA5A5" }}>{error}</div>}

        <div className="flex items-center" style={{ gap: "14px", marginTop: "40px", padding: "16px 32px", borderRadius: "99px", background: "rgba(251,191,36,.10)", border: "2px solid rgba(251,191,36,.4)" }}>
          <span style={{ fontSize: "30px" }}>ℹ️</span>
          <span style={{ fontSize: "30px", color: "#FCD34D", fontWeight: 500 }}>
            {secs > 0 ? `${secs} sn içinde misafir moduna geçilecek` : "Misafir moduna geçiliyor…"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
