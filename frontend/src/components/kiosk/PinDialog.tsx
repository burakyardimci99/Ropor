"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

const PIN = process.env.NEXT_PUBLIC_DETECTION_PIN || "1010";
const LEN = PIN.length;

/**
 * Operator PIN gate for sensitive kiosk controls (e.g. pausing face detection).
 * Accepts on-screen keypad taps and physical keyboard digits.
 */
export function PinDialog({
  title,
  onSuccess,
  onClose,
}: {
  title: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [entry, setEntry] = useState("");
  const [error, setError] = useState(false);

  const submit = useCallback(
    (value: string) => {
      if (value === PIN) {
        onSuccess();
      } else {
        setError(true);
        setEntry("");
      }
    },
    [onSuccess],
  );

  const push = useCallback((digit: string) => {
    setError(false);
    setEntry((prev) => (prev.length >= LEN ? prev : prev + digit));
  }, []);

  const back = useCallback(() => {
    setError(false);
    setEntry((p) => p.slice(0, -1));
  }, []);

  // Auto-submit once a full PIN is entered (kept out of the state updater so
  // React's dev double-invoke doesn't fire the action twice).
  useEffect(() => {
    if (entry.length !== LEN) return;
    const t = setTimeout(() => submit(entry), 120);
    return () => clearTimeout(t);
  }, [entry, submit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") push(e.key);
      else if (e.key === "Backspace") back();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [push, back, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(2,6,15,.72)", backdropFilter: "blur(6px)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass"
        style={{ width: "560px", borderRadius: "32px", border: "1px solid rgba(91,192,255,.25)", padding: "48px 52px", boxShadow: "0 40px 120px -30px rgba(0,0,0,.8)" }}
      >
        <div style={{ fontSize: "22px", letterSpacing: ".22em", color: "var(--blue-bright)", fontWeight: 600 }}>
          OPERATÖR PIN
        </div>
        <div style={{ fontSize: "34px", fontWeight: 700, color: "#FFFFFF", marginTop: "8px" }}>{title}</div>

        {/* PIN dots */}
        <div className="flex justify-center" style={{ gap: "18px", margin: "36px 0" }}>
          {Array.from({ length: LEN }).map((_, i) => {
            const filled = i < entry.length;
            return (
              <div
                key={i}
                style={{
                  width: "58px", height: "70px", borderRadius: "16px",
                  background: "rgba(255,255,255,.05)",
                  border: `2px solid ${error ? "rgba(248,113,113,.7)" : filled ? "#5BC0FF" : "rgba(91,192,255,.25)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {filled && <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: error ? "#FCA5A5" : "#5BC0FF" }} />}
              </div>
            );
          })}
        </div>

        {error && <div style={{ fontSize: "24px", color: "#FCA5A5", textAlign: "center", marginTop: "-18px", marginBottom: "16px" }}>Hatalı PIN, tekrar deneyin.</div>}

        {/* keypad */}
        <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <Key key={d} onClick={() => push(d)}>
              {d}
            </Key>
          ))}
          <Key onClick={onClose} variant="ghost">
            İptal
          </Key>
          <Key onClick={() => push("0")}>0</Key>
          <Key onClick={back} variant="ghost">
            ⌫
          </Key>
        </div>
      </motion.div>
    </div>
  );
}

function Key({
  children,
  onClick,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "ghost";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="dock-btn"
      style={{
        height: "84px",
        borderRadius: "18px",
        fontSize: variant === "ghost" ? "26px" : "38px",
        fontWeight: 600,
        cursor: "pointer",
        color: variant === "ghost" ? "#9FC4EA" : "#EAF4FF",
        background: variant === "ghost" ? "rgba(255,255,255,.04)" : "rgba(45,168,255,.12)",
        border: `2px solid ${variant === "ghost" ? "rgba(255,255,255,.1)" : "rgba(91,192,255,.28)"}`,
      }}
    >
      {children}
    </button>
  );
}
