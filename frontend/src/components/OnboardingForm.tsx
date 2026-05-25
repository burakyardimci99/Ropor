"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

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
      // Steps without a text input need Enter handled globally.
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
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center px-12"
    >
      <div className="text-sm uppercase tracking-widest text-white/40">
        Adım {onb.step + 1} / {ONBOARDING_STEPS.length}
      </div>

      {stepName === "name" && (
        <Field label="Adın Soyadın?">
          <input
            ref={inputRef}
            value={onb.full_name}
            onChange={(e) => onSet("full_name", e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Ahmet Yılmaz"
            className={inputCls}
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
            className={inputCls}
          />
        </Field>
      )}

      {stepName === "role" && (
        <Field label="Rolün?">
          <div className="space-y-3">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => {
                  onSet("role", r);
                  onNext();
                }}
                className={`flex w-full items-center gap-4 rounded-xl border px-6 py-4 text-2xl transition ${
                  onb.role === r
                    ? "border-cyan-400 bg-cyan-500/20"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full border ${
                    onb.role === r ? "border-cyan-400 bg-cyan-400" : "border-white/40"
                  }`}
                />
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-white/30">↑↓ ile seç, Enter ile onayla</p>
        </Field>
      )}

      {stepName === "interests" && (
        <Field label="İlgi alanların? (opsiyonel)">
          <div className="mb-3 flex flex-wrap gap-2">
            {onb.interests.map((t) => (
              <span
                key={t}
                className="rounded-full bg-cyan-500/20 px-4 py-1.5 text-lg text-cyan-200"
              >
                {t}
              </span>
            ))}
          </div>
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
            className={inputCls}
          />
          <p className="mt-3 text-sm text-white/30">
            Tab/Enter ile ekle · boşken Enter ile atla
          </p>
        </Field>
      )}

      {stepName === "kvkk" && (
        <Field label="KVKK Açık Rıza">
          <div className="max-h-48 overflow-y-auto rounded-xl bg-white/5 p-5 text-base leading-relaxed text-white/70">
            <p>
              Yüz biyometrik verileriniz (yüz embedding&apos;i) yalnızca lab girişinde
              sizi tanımak amacıyla işlenir ve saklanır. Ham fotoğraf/video saklanmaz.
              Verileriniz lab dışına aktarılmaz.
            </p>
            <p className="mt-3">
              İstediğiniz zaman profilinizden tüm verilerinizi silebilir,
              leaderboard&apos;dan çıkabilirsiniz. 6 ay aktif olmayan hesapların
              embedding&apos;i otomatik silinir.
            </p>
          </div>
          <label className="mt-5 flex cursor-pointer items-start gap-3 text-lg text-white/80">
            <input
              type="checkbox"
              checked={onb.kvkk}
              onChange={(e) => onSet("kvkk", e.target.checked)}
              className="mt-1.5 h-5 w-5 accent-cyan-500"
            />
            <span>
              Yüz biyometrik verimin işlenmesini ve saklanmasını onaylıyorum.
            </span>
          </label>
        </Field>
      )}

      {error && <p className="mt-6 text-xl text-red-400">{error}</p>}

      <div className="mt-8 flex items-center justify-between">
        <span className="text-white/50">
          {onb.step === 0 ? "[Esc] iptal" : "[Esc] geri"}
        </span>
        <button
          onClick={onNext}
          disabled={busy}
          className="rounded-xl bg-cyan-600 px-8 py-3 text-xl font-semibold transition hover:bg-cyan-500 disabled:opacity-50"
        >
          {stepName === "kvkk" ? "Kaydı Tamamla" : "Devam"}{" "}
          <span className="text-white/60">[Enter]</span>
        </button>
      </div>

      <div className="mt-6 flex gap-2">
        {ONBOARDING_STEPS.map((_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${
              i === onb.step ? "bg-cyan-400" : i < onb.step ? "bg-cyan-700" : "bg-white/20"
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
}

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-6 py-5 text-3xl outline-none focus:border-cyan-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <label className="mb-4 block text-4xl font-semibold">{label}</label>
      {children}
    </div>
  );
}
