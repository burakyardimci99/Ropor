"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { ScanViewport } from "@/components/kiosk/visuals";

const STEPS = ["Yüz algılandı", "Öznitelikler çıkarılıyor", "Kimlik eşleştiriliyor"];

export function ScanningScreen() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 460);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="state-anim flex h-full w-full items-center justify-center"
      style={{ gap: "90px" }}
    >
      <ScanViewport state="scanning" />

      <div className="flex flex-col items-start" style={{ maxWidth: "900px" }}>
        <div style={{ fontSize: "30px", letterSpacing: ".34em", color: "var(--blue-bright)", fontWeight: 600 }}>
          YÜZ TANIMA
        </div>
        <div
          className="font-display flex items-end"
          style={{ fontSize: "150px", fontWeight: 700, color: "#FFFFFF", lineHeight: 0.95, letterSpacing: "-.02em", marginTop: "10px" }}
        >
          Tanınıyor
          <span style={{ display: "inline-flex", gap: "14px", marginLeft: "22px", marginBottom: "34px" }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="blink"
                style={{
                  width: "20px", height: "20px", borderRadius: "50%",
                  background: "var(--blue)", animationDelay: `${i * 0.22}s`,
                }}
              />
            ))}
          </span>
        </div>
        <div style={{ fontSize: "38px", color: "#A9CDF2", fontWeight: 400, marginTop: "18px" }}>
          Lütfen kameraya bakmaya devam edin
        </div>

        <div className="flex flex-col" style={{ gap: "16px", marginTop: "48px" }}>
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            const color = done ? "var(--green)" : active ? "var(--blue)" : "#3E5C82";
            return (
              <div key={label} className="flex items-center" style={{ gap: "18px", opacity: i <= step ? 1 : 0.45 }}>
                {done ? (
                  <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                    <circle cx="17" cy="17" r="15" stroke="var(--green)" strokeWidth="3" />
                    <path d="M10 17.5l4.5 4.5L24 12" stroke="var(--green)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : active ? (
                  <svg className="spin-cw-fast" width="34" height="34" viewBox="0 0 34 34" fill="none">
                    <circle cx="17" cy="17" r="14" stroke="rgba(45,168,255,.25)" strokeWidth="4" />
                    <path d="M17 3a14 14 0 0 1 14 14" stroke="var(--blue)" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                ) : (
                  <span style={{ width: "34px", height: "34px", borderRadius: "50%", border: "3px solid #2C4566" }} />
                )}
                <span style={{ fontSize: "32px", fontWeight: 500, color }}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
