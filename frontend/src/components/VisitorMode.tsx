"use client";

import { useEffect, useRef } from "react";

import { FormCard, btnGhostStyle, btnPrimaryStyle, fieldInputCls } from "@/components/kiosk/visuals";
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
    <FormCard maxWidth={1000}>
      <div style={{ fontSize: "26px", letterSpacing: ".28em", color: "var(--blue-bright)", fontWeight: 600 }}>
        MİSAFİR GİRİŞİ
      </div>
      <h1 className="font-display" style={{ fontSize: "72px", fontWeight: 700, color: "#FFFFFF", marginTop: "8px" }}>
        Hoş geldiniz
      </h1>
      <p style={{ fontSize: "28px", color: "#7FB2E6", marginTop: "6px" }}>Birkaç bilgi alalım, hemen içeri buyurun.</p>

      <label style={{ display: "block", fontSize: "30px", fontWeight: 600, color: "#CFE6FF", marginTop: "44px", marginBottom: "14px" }}>
        Adınız
      </label>
      <input
        ref={inputRef}
        value={visitor.visitor_name}
        onChange={(e) => onSet("visitor_name", e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder="Mehmet Demir"
        className={fieldInputCls}
      />

      <label style={{ display: "block", fontSize: "30px", fontWeight: 600, color: "#CFE6FF", marginTop: "28px", marginBottom: "14px" }}>
        Ziyaret amacı / kimi ziyaret <span style={{ color: "#5E86B5" }}>(opsiyonel)</span>
      </label>
      <input
        value={visitor.purpose}
        onChange={(e) => onSet("purpose", e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder="Toplantı · Ahmet Hoca"
        className={fieldInputCls}
      />

      {error && <p style={{ marginTop: "24px", fontSize: "26px", color: "#FCA5A5" }}>{error}</p>}

      <div className="flex items-center justify-between" style={{ marginTop: "48px" }}>
        <button onClick={onCancel} style={btnGhostStyle}>
          İptal <span style={{ opacity: 0.55, marginLeft: "8px" }}>[Esc]</span>
        </button>
        <button onClick={onSubmit} disabled={busy} style={{ ...btnPrimaryStyle, opacity: busy ? 0.5 : 1 }}>
          Giriş Yap <span style={{ opacity: 0.6, marginLeft: "8px" }}>[Enter]</span>
        </button>
      </div>
    </FormCard>
  );
}
