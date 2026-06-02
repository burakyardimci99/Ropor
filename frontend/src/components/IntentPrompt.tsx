"use client";

import { useEffect, useRef } from "react";

import { FormCard, btnGhostStyle, btnPrimaryStyle, fieldInputCls } from "@/components/kiosk/visuals";
import { IntentData } from "@/lib/kioskMachine";

interface Props {
  intent: IntentData;
  suggestions?: string[];
  busy: boolean;
  error: string | null;
  onSet: (value: string) => void;
  onSave: () => void;
  onSkip: () => void;
}

export function IntentPrompt({ intent, suggestions = [], busy, error, onSet, onSave, onSkip }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const name = intent.userName?.split(" ")[0];
  const chips = suggestions.filter(Boolean).slice(0, 6);

  // Saved confirmation (kiosk auto-returns to ambient after a short dwell).
  if (intent.saved) {
    return (
      <FormCard maxWidth={760} motionKey="intent-saved">
        <div className="flex flex-col items-center" style={{ gap: "28px", textAlign: "center" }}>
          <div
            className="pop flex items-center justify-center rounded-full"
            style={{ width: "128px", height: "128px", background: "var(--green)", boxShadow: "0 0 50px -6px rgba(52,211,153,.9)" }}
          >
            <svg width="68" height="68" viewBox="0 0 74 74" fill="none">
              <path className="check-path" d="M20 39l12 12 22-26" stroke="#04241a" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="font-display" style={{ fontSize: "56px", fontWeight: 700, color: "#FFFFFF" }}>
            Teşekkürler, kaydedildi
          </div>
          <div style={{ fontSize: "30px", color: "#9FC4EA" }}>İyi çalışmalar{name ? `, ${name}` : ""}!</div>
        </div>
      </FormCard>
    );
  }

  return (
    <FormCard maxWidth={1040} motionKey="intent">
      <div style={{ fontSize: "26px", letterSpacing: ".28em", color: "var(--blue-bright)", fontWeight: 600 }}>
        BUGÜNÜN ODAĞI
      </div>
      <h1 className="font-display" style={{ fontSize: "60px", fontWeight: 700, color: "#FFFFFF", marginTop: "8px", lineHeight: 1.05 }}>
        {name ? `${name}, bugün ne üzerinde çalışacaksın?` : "Bugün ne üzerinde çalışacaksın?"}
      </h1>
      <p style={{ fontSize: "26px", color: "#7FB2E6", marginTop: "10px" }}>
        Kısaca yaz — lab ekranında "üzerinde çalışıyor" olarak görünür. İstemezsen atla.
      </p>

      <input
        ref={inputRef}
        value={intent.text}
        onChange={(e) => onSet(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && intent.text.trim()) onSave();
        }}
        placeholder="Difüzyon modeli eğitimi, RAG denemesi…"
        className={fieldInputCls}
        style={{ marginTop: "36px" }}
      />

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center" style={{ gap: "12px", marginTop: "20px" }}>
          <span style={{ fontSize: "22px", color: "#5E86B5", fontWeight: 500 }}>Hızlı seç:</span>
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onSet(c);
                inputRef.current?.focus();
              }}
              className="dock-btn"
              style={{
                borderRadius: "99px", padding: "10px 24px", fontSize: "26px", fontWeight: 500, cursor: "pointer",
                color: "#9FD3FF", background: "rgba(45,168,255,.14)", border: "1px solid rgba(91,192,255,.3)",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {error && <p style={{ marginTop: "24px", fontSize: "26px", color: "#FCA5A5" }}>{error}</p>}

      <div className="flex items-center justify-between" style={{ marginTop: "44px" }}>
        <button onClick={onSkip} style={btnGhostStyle}>
          Atla <span style={{ opacity: 0.55, marginLeft: "8px" }}>[Esc]</span>
        </button>
        <button
          onClick={onSave}
          disabled={busy || !intent.text.trim()}
          style={{ ...btnPrimaryStyle, opacity: busy || !intent.text.trim() ? 0.5 : 1 }}
        >
          Kaydet <span style={{ opacity: 0.6, marginLeft: "8px" }}>[Enter]</span>
        </button>
      </div>
    </FormCard>
  );
}
