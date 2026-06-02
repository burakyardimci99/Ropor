"use client";

import { useEffect, useRef, useState } from "react";

import { FormCard, btnGhostStyle, btnPrimaryStyle, fieldInputCls } from "@/components/kiosk/visuals";
import {
  KioskState,
  ONBOARDING_STEPS,
  ROLE_LABELS,
  Role,
} from "@/lib/kioskMachine";

interface Props {
  state: KioskState;
  onSet: (field: keyof KioskState["onboarding"], value: unknown) => void;
  onNext: () => void;
  onBack: () => void;
}

const ROLES: Role[] = ["researcher", "student", "staff", "guest"];

export function OnboardingForm({ state, onSet, onNext, onBack }: Props) {
  const { onboarding: onb, error, busy } = state;
  const stepName = ONBOARDING_STEPS[onb.step];
  const [tag, setTag] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [onb.step]);

  // Role selection + global Enter/Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onBack();
        return;
      }
      if (e.key === "Enter" && (stepName === "role" || stepName === "kvkk")) {
        e.preventDefault();
        onNext();
      }
      if (stepName === "role") {
        const idx = ROLES.indexOf(onb.role);
        if (e.key === "ArrowDown") onSet("role", ROLES[(idx + 1) % ROLES.length]);
        if (e.key === "ArrowUp")
          onSet("role", ROLES[(idx - 1 + ROLES.length) % ROLES.length]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepName, onb.role, onSet, onNext, onBack, busy]);

  const addTag = () => {
    const t = tag.trim();
    if (t && !onb.interests.includes(t)) onSet("interests", [...onb.interests, t]);
    setTag("");
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onNext();
    }
  };

  return (
    <FormCard maxWidth={1040} motionKey={`onb-${onb.step}`}>
      <div style={{ fontSize: "24px", letterSpacing: ".28em", color: "var(--blue-bright)", fontWeight: 600 }}>
        KAYIT · ADIM {onb.step + 1} / {ONBOARDING_STEPS.length}
      </div>

      {stepName === "name" && (
        <Field label="Adın Soyadın?">
          <input
            ref={inputRef}
            value={onb.full_name}
            onChange={(e) => onSet("full_name", e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Ahmet Yılmaz"
            className={fieldInputCls}
          />
        </Field>
      )}

      {stepName === "email" && (
        <Field label="Email adresin?">
          <input
            ref={inputRef}
            type="email"
            value={onb.email}
            onChange={(e) => onSet("email", e.target.value)}
            onKeyDown={onInputKey}
            placeholder="ahmet@itu.edu.tr"
            className={fieldInputCls}
          />
        </Field>
      )}

      {stepName === "role" && (
        <Field label="Rolün?">
          <div className="flex flex-col" style={{ gap: "14px" }}>
            {ROLES.map((r) => {
              const active = onb.role === r;
              return (
                <button
                  key={r}
                  onClick={() => {
                    onSet("role", r);
                    onNext();
                  }}
                  className="flex w-full items-center"
                  style={{
                    gap: "18px",
                    borderRadius: "18px",
                    padding: "22px 28px",
                    fontSize: "30px",
                    cursor: "pointer",
                    color: active ? "#EAF4FF" : "#CFE6FF",
                    background: active ? "rgba(45,168,255,.18)" : "rgba(255,255,255,.05)",
                    border: `2px solid ${active ? "#5BC0FF" : "rgba(255,255,255,.08)"}`,
                  }}
                >
                  <span
                    style={{
                      width: "20px", height: "20px", borderRadius: "50%",
                      background: active ? "#5BC0FF" : "transparent",
                      border: `2px solid ${active ? "#5BC0FF" : "rgba(255,255,255,.4)"}`,
                      boxShadow: active ? "0 0 16px rgba(91,192,255,.8)" : "none",
                    }}
                  />
                  {ROLE_LABELS[r]}
                </button>
              );
            })}
          </div>
          <p style={{ marginTop: "16px", fontSize: "22px", color: "#5E86B5" }}>↑↓ ile seç, Enter ile onayla</p>
        </Field>
      )}

      {stepName === "interests" && (
        <Field label="İlgi alanların? (opsiyonel)">
          {onb.interests.length > 0 && (
            <div className="flex flex-wrap" style={{ gap: "12px", marginBottom: "16px" }}>
              {onb.interests.map((t) => (
                <span
                  key={t}
                  style={{
                    borderRadius: "99px", padding: "10px 22px", fontSize: "26px",
                    background: "rgba(45,168,255,.18)", color: "#9FD3FF",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          <input
            ref={inputRef}
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                if (tag.trim()) addTag();
                else onNext();
              }
            }}
            placeholder="LLM, RAG, computer vision…"
            className={fieldInputCls}
          />
          <p style={{ marginTop: "16px", fontSize: "22px", color: "#5E86B5" }}>
            Tab/Enter ile ekle · boşken Enter ile atla
          </p>
        </Field>
      )}

      {stepName === "kvkk" && (
        <Field label="KVKK Açık Rıza">
          <div
            style={{
              maxHeight: "230px", overflowY: "auto", borderRadius: "18px",
              background: "rgba(255,255,255,.05)", padding: "26px 30px",
              fontSize: "24px", lineHeight: 1.45, color: "#B9D4F2",
            }}
          >
            <p>
              Yüz biyometrik verileriniz (yüz embedding&apos;i) yalnızca lab girişinde
              sizi tanımak amacıyla işlenir ve saklanır. Ham fotoğraf/video saklanmaz.
              Verileriniz lab dışına aktarılmaz.
            </p>
            <p style={{ marginTop: "14px" }}>
              İstediğiniz zaman profilinizden tüm verilerinizi silebilir,
              leaderboard&apos;dan çıkabilirsiniz. 6 ay aktif olmayan hesapların
              embedding&apos;i otomatik silinir.
            </p>
          </div>
          <label className="flex cursor-pointer items-start" style={{ gap: "16px", marginTop: "24px", fontSize: "26px", color: "#CFE6FF" }}>
            <input
              type="checkbox"
              checked={onb.kvkk}
              onChange={(e) => onSet("kvkk", e.target.checked)}
              style={{ marginTop: "8px", width: "26px", height: "26px", accentColor: "#2DA8FF" }}
            />
            <span>Yüz biyometrik verimin işlenmesini ve saklanmasını onaylıyorum.</span>
          </label>
        </Field>
      )}

      {error && <p style={{ marginTop: "28px", fontSize: "26px", color: "#FCA5A5" }}>{error}</p>}

      <div className="flex items-center justify-between" style={{ marginTop: "40px" }}>
        <button onClick={onBack} style={btnGhostStyle}>
          {onb.step === 0 ? "İptal" : "Geri"} <span style={{ opacity: 0.55, marginLeft: "8px" }}>[Esc]</span>
        </button>
        <button onClick={onNext} disabled={busy} style={{ ...btnPrimaryStyle, opacity: busy ? 0.5 : 1 }}>
          {stepName === "kvkk" ? "Kaydı Tamamla" : "Devam"} <span style={{ opacity: 0.6, marginLeft: "8px" }}>[Enter]</span>
        </button>
      </div>

      <div className="flex" style={{ gap: "10px", marginTop: "28px" }}>
        {ONBOARDING_STEPS.map((_, i) => (
          <span
            key={i}
            style={{
              height: "12px",
              flex: 1,
              borderRadius: "99px",
              background: i === onb.step ? "#5BC0FF" : i < onb.step ? "#0B63C4" : "rgba(255,255,255,.14)",
              boxShadow: i === onb.step ? "0 0 16px rgba(91,192,255,.7)" : "none",
              transition: "background .3s ease",
            }}
          />
        ))}
      </div>
    </FormCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: "28px" }}>
      <label className="font-display" style={{ display: "block", fontSize: "46px", fontWeight: 700, color: "#FFFFFF", marginBottom: "22px" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
