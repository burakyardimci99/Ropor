"use client";

import { motion } from "framer-motion";
import { CSSProperties, ReactNode, useEffect, useMemo, useState } from "react";

export type StageState = "idle" | "scanning" | "welcome" | "fail";

/* ----------------------------- Stage scaler ----------------------------- */
/**
 * Stretches the fixed 1920x1080 design canvas to fully cover the viewport.
 * On a 16:9 screen (the 60" TV target) this is a uniform, distortion-free
 * scale; on other aspect ratios it fills the screen edge-to-edge instead of
 * letterboxing with black bars.
 */
export function useStageScale() {
  const [scale, setScale] = useState({ sx: 1, sy: 1 });
  useEffect(() => {
    const fit = () =>
      setScale({ sx: window.innerWidth / 1920, sy: window.innerHeight / 1080 });
    fit();
    window.addEventListener("resize", fit);

    return () => window.removeEventListener("resize", fit);
  }, []);
  return scale;
}

/* ----------------------------- Clock ----------------------------- */
const TR_DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
export function useClock() {
  // Must start as null so the server-rendered HTML and the first client render
  // are identical (both show the "--" placeholders below). If we seeded this
  // with `new Date()`, the server would bake in its clock time and the client
  // would hydrate a few seconds later with a different time, triggering a React
  // hydration mismatch (e.g. server "12" vs client "15" seconds). We fill in the
  // real time only after mount, inside the effect.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date()); // first real tick, right after hydration
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Until the post-mount effect runs, render fixed-width placeholders. They are
  // the same 2-char width as the real values, so there is no layout shift when
  // the clock fills in.
  if (!now) {
    return { hh: "--", mm: "--", ss: "--", date: "", day: "" };
  }

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const date = `${now.getDate()} ${TR_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const day = TR_DAYS[now.getDay()];
  return { hh, mm, ss, date, day };
}

/* ----------------------------- Logo ----------------------------- */
export function Logo() {
  return (
    <div className="flex items-center" style={{ gap: "22px" }}>
      <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
        <defs>
          <linearGradient id="ailab-lg" x1="10" y1="8" x2="74" y2="76" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5BC0FF" />
            <stop offset="1" stopColor="#0B63C4" />
          </linearGradient>
        </defs>
        <rect x="3" y="3" width="78" height="78" rx="22" stroke="url(#ailab-lg)" strokeWidth="3" fill="rgba(45,168,255,.07)" />
        <path d="M16 42c10-15 42-15 52 0-10 15-42 15-52 0Z" stroke="url(#ailab-lg)" strokeWidth="3.4" fill="none" />
        <circle cx="42" cy="42" r="10.5" fill="none" stroke="#5BC0FF" strokeWidth="3.4" />
        <circle cx="42" cy="42" r="3.6" fill="#5BC0FF" />
        <circle cx="42" cy="20" r="3.2" fill="#5BC0FF" />
        <circle cx="42" cy="64" r="3.2" fill="#5BC0FF" />
        <circle cx="20.5" cy="42" r="3.2" fill="#5BC0FF" />
        <circle cx="63.5" cy="42" r="3.2" fill="#5BC0FF" />
        <path d="M42 31.5V20M42 52.5V64M31.5 42H20.5M52.5 42H63.5" stroke="#2DA8FF" strokeWidth="2.6" />
      </svg>
      <div style={{ lineHeight: 0.92 }}>
        <div
          className="font-display"
          style={{ fontWeight: 700, fontSize: "42px", letterSpacing: ".04em", color: "#EAF4FF" }}
        >
          AI&nbsp;LAB
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Face glyph ----------------------------- */
function FaceGlyph({ color, opacity = 1 }: { color: string; opacity?: number }) {
  return (
    <svg width="200" height="220" viewBox="0 0 200 220" fill="none" style={{ opacity }}>
      <path
        d="M100 30c-34 0-58 24-58 62 0 30 16 52 40 64v18c0 8 8 14 18 14s18-6 18-14v-18c24-12 40-34 40-64 0-38-24-62-58-62Z"
        stroke={color} strokeWidth="3" fill="none" opacity=".55"
      />
      <circle cx="78" cy="92" r="6" fill={color} />
      <circle cx="122" cy="92" r="6" fill={color} />
      <path d="M86 130c8 7 20 7 28 0" stroke={color} strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

/* ----------------------------- Scan viewport ----------------------------- */
export function ScanViewport({
  state,
  initials,
  size = 540,
}: {
  state: StageState;
  initials?: string;
  size?: number;
}) {
  const ring = state === "welcome" ? "var(--green)" : state === "fail" ? "var(--amber)" : "var(--blue)";
  const D = size;
  return (
    <div className="relative" style={{ width: D, height: D, flexShrink: 0 }}>
      {state === "idle" && (
        <>
          <div className="pulse-ring" style={{ borderColor: "rgba(45,168,255,.7)" }} />
          <div className="pulse-ring" style={{ borderColor: "rgba(45,168,255,.7)", animationDelay: "1.13s" }} />
          <div className="pulse-ring" style={{ borderColor: "rgba(45,168,255,.7)", animationDelay: "2.26s" }} />
        </>
      )}

      <svg
        className={state === "scanning" ? "spin-cw" : "spin-ccw"}
        width={D} height={D} viewBox="0 0 540 540" style={{ position: "absolute", inset: 0 }}
      >
        <circle cx="270" cy="270" r="262" fill="none" stroke="rgba(45,168,255,.18)" strokeWidth="2" strokeDasharray="3 18" />
      </svg>

      <div
        className={"absolute inset-0 rounded-full " + (state === "idle" ? "breathe" : "")}
        style={{
          border: `4px solid ${ring}`,
          boxShadow: `0 0 90px -10px ${ring}, inset 0 0 70px -30px ${ring}`,
          transition: "border-color .6s ease, box-shadow .6s ease",
        }}
      />

      {state === "scanning" && (
        <svg className="spin-cw-fast" width={D} height={D} viewBox="0 0 540 540" style={{ position: "absolute", inset: 0 }}>
          <defs>
            <linearGradient id="ailab-arcg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#5BC0FF" stopOpacity="0" />
              <stop offset="1" stopColor="#5BC0FF" stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle cx="270" cy="270" r="250" fill="none" stroke="url(#ailab-arcg)" strokeWidth="6" strokeLinecap="round" strokeDasharray="430 1140" />
        </svg>
      )}

      <div
        className="absolute rounded-full overflow-hidden flex items-center justify-center"
        style={{ inset: "34px", background: "radial-gradient(circle at 50% 35%, #0e2240 0%, #07142e 60%, #040b1c 100%)" }}
      >
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 30%, rgba(45,168,255,.18), transparent 60%)" }} />

        {state === "idle" && <FaceGlyph color="#3E78C0" opacity={0.8} />}

        {state === "scanning" && (
          <>
            <FaceGlyph color="#5BC0FF" />
            <div
              className="scan-line absolute"
              style={{
                left: "8%", right: "8%", height: "4px",
                background: "linear-gradient(90deg, transparent, #5BC0FF, transparent)",
                boxShadow: "0 0 24px 4px rgba(91,192,255,.8)",
              }}
            />
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="absolute blink"
                style={{
                  [i < 2 ? "top" : "bottom"]: "14%",
                  [i % 2 === 0 ? "left" : "right"]: "14%",
                  width: "46px", height: "46px",
                  borderTop: i < 2 ? "3px solid #5BC0FF" : "none",
                  borderBottom: i >= 2 ? "3px solid #5BC0FF" : "none",
                  borderLeft: i % 2 === 0 ? "3px solid #5BC0FF" : "none",
                  borderRight: i % 2 === 1 ? "3px solid #5BC0FF" : "none",
                }}
              />
            ))}
          </>
        )}

        {state === "welcome" && (
          <div
            className="pop flex items-center justify-center rounded-full"
            style={{
              width: "72%", height: "72%",
              background: "linear-gradient(150deg, #0e8f63, #065f46)",
              boxShadow: "0 0 60px -8px rgba(52,211,153,.7)",
            }}
          >
            <span className="font-display" style={{ fontSize: "190px", fontWeight: 700, color: "#EAFFF6" }}>
              {initials}
            </span>
          </div>
        )}

        {state === "fail" && (
          <div className="pop flex items-center justify-center">
            <svg width="200" height="220" viewBox="0 0 200 220" fill="none">
              <path
                d="M100 30c-34 0-58 24-58 62 0 30 16 52 40 64v18c0 8 8 14 18 14s18-6 18-14v-18c24-12 40-34 40-64 0-38-24-62-58-62Z"
                stroke="#FBBF24" strokeWidth="3" fill="none" opacity=".5"
              />
              <circle cx="100" cy="104" r="40" stroke="#FBBF24" strokeWidth="6" fill="none" />
              <path d="M100 88v22" stroke="#FBBF24" strokeWidth="7" strokeLinecap="round" />
              <circle cx="100" cy="124" r="4.6" fill="#FBBF24" />
            </svg>
          </div>
        )}
      </div>

      {state === "welcome" && (
        <div
          className="pop absolute flex items-center justify-center rounded-full"
          style={{
            right: "18px", bottom: "18px", width: "128px", height: "128px",
            background: "var(--green)", boxShadow: "0 0 50px -6px rgba(52,211,153,.9)", border: "6px solid #062a1e",
          }}
        >
          <svg width="74" height="74" viewBox="0 0 74 74" fill="none">
            <path className="check-path" d="M20 39l12 12 22-26" stroke="#04241a" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Confetti ----------------------------- */
export function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 46 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 2.4 + Math.random() * 1.8,
        size: 8 + Math.random() * 12,
        color: ["#34D399", "#5BC0FF", "#2DA8FF", "#EAF4FF", "#A7F3D0"][Math.floor(Math.random() * 5)],
        rot: Math.random() * 360,
      })),
    [],
  );
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="conf"
          style={{
            left: p.left + "%", width: p.size + "px", height: p.size * 0.6 + "px",
            background: p.color, animationDuration: p.dur + "s", animationDelay: p.delay + "s",
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

/* ----------------------------- Form primitives ----------------------------- */
/** Brand-styled text input used across the kiosk forms. */
export const fieldInputCls =
  "w-full rounded-2xl border border-white/10 bg-[#081634] px-7 py-5 text-3xl text-white placeholder-white/25 outline-none transition focus:border-[#5BC0FF] focus:bg-[#0a1d44]";

export const btnPrimaryStyle: CSSProperties = {
  padding: "22px 48px",
  borderRadius: "18px",
  fontSize: "30px",
  fontWeight: 700,
  border: "none",
  cursor: "pointer",
  color: "#04101f",
  background: "linear-gradient(150deg, #5BC0FF, #0B63C4)",
  boxShadow: "0 0 44px -12px rgba(45,168,255,.8)",
};

export const btnGhostStyle: CSSProperties = {
  padding: "22px 44px",
  borderRadius: "18px",
  fontSize: "30px",
  fontWeight: 600,
  cursor: "pointer",
  color: "#CFE6FF",
  background: "rgba(255,255,255,.06)",
  border: "2px solid rgba(91,192,255,.3)",
};

/**
 * Centered glass card for the interactive forms (onboarding / visitor / profile).
 * Fits inside the stage content slot and scrolls internally if a screen is tall.
 */
export function FormCard({
  children,
  maxWidth = 1040,
  motionKey,
}: {
  children: ReactNode;
  maxWidth?: number;
  motionKey?: string;
}) {
  return (
    <motion.div
      key={motionKey}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.35 }}
      className="flex h-full w-full items-center justify-center"
    >
      <div
        className="glass"
        style={{
          width: "100%",
          maxWidth,
          maxHeight: "100%",
          overflowY: "auto",
          borderRadius: "32px",
          border: "1px solid rgba(91,192,255,.22)",
          padding: "52px 60px",
          boxShadow: "0 40px 120px -40px rgba(0,0,0,.7)",
        }}
      >
        {children}
      </div>
    </motion.div>
  );
}

/* ----------------------------- Stage shell ----------------------------- */
const GLOW: Record<StageState, string> = {
  welcome: "radial-gradient(circle, rgba(52,211,153,.22), transparent 62%)",
  fail: "radial-gradient(circle, rgba(251,191,36,.18), transparent 62%)",
  idle: "radial-gradient(circle, rgba(45,168,255,.20), transparent 62%)",
  scanning: "radial-gradient(circle, rgba(45,168,255,.20), transparent 62%)",
};

export interface StageChrome {
  /** Backend WebSocket health — drives the "Sistem bağlı / Bağlantı yok" pill. */
  backendConnected?: boolean;
  /**
   * Whether face detection is currently running. Drives the "Yüz tanıma aktif /
   * kapalı" indicator in the top-right. The detection on/off action no longer
   * has a visible button — it is triggered by the hidden "a"+"l" operator
   * shortcut wired up in the page (which still prompts for the PIN).
   */
  detectionActive?: boolean;
}

/**
 * Persistent kiosk shell: scaled 1920x1080 canvas, layered background,
 * AI LAB logo header, security-zone pill, and bottom camera status.
 * Foreground screens are passed as children and crossfade inside it.
 */
export function KioskStage({
  glow,
  chrome,
  showConfetti,
  children,
}: {
  glow: StageState;
  chrome?: StageChrome;
  showConfetti?: boolean;
  children: ReactNode;
}) {
  const { sx, sy } = useStageScale();
  // Small informational clock shown in the bottom-right corner of the shell.
  const { hh, mm, date, day } = useClock();

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div
        className="absolute left-0 top-0 overflow-hidden"
        style={{
          width: 1920,
          height: 1080,
          transformOrigin: "top left",
          transform: `scale(${sx}, ${sy})`,
          background:
            "radial-gradient(120% 90% at 50% -10%, #15336b 0%, #0b1d44 32%, #050b1c 64%, #02050f 100%)",
        }}
      >
        <div className="bg-grid" />
        <div className="bg-glow" style={{ background: GLOW[glow] }} />
        <div className="vignette" />
        {showConfetti && <Confetti />}

        {/* header: logo (left) + status pills (right). The two pills sit side by
            side: the face-recognition indicator first, then the backend/system
            indicator right next to it, both styled identically. */}
        <div style={{ position: "absolute", top: 43, left: 77, right: 77 }}>
          <div className="flex items-start justify-between" style={{ width: "100%" }}>
            <Logo />
            <div className="flex items-center" style={{ gap: "14px" }}>
              {/* Face-recognition indicator: green + "aktif" while detection is
                  running, muted grey + "kapalı" when an operator has paused it
                  (via the hidden "a"+"l" shortcut). Mirrors the system pill's
                  look so the two read as a matched pair. */}
              <div className="glass flex items-center rounded-full" style={{ gap: "12px", padding: "14px 26px" }}>
                <span
                  className={chrome?.detectionActive ? "blink" : undefined}
                  style={{
                    width: "12px", height: "12px", borderRadius: "50%",
                    background: chrome?.detectionActive ? "var(--green)" : "#6B7A99",
                    boxShadow: chrome?.detectionActive ? "0 0 12px var(--green)" : "none",
                  }}
                />
                <span style={{ fontSize: "22px", color: "#BFE0FF", fontWeight: 500 }}>
                  {chrome?.detectionActive ? "Yüz tanıma aktif" : "Yüz tanıma kapalı"}
                </span>
              </div>

              {/* System / backend connection indicator. */}
              <div className="glass flex items-center rounded-full" style={{ gap: "12px", padding: "14px 26px" }}>
                <span
                  style={{
                    width: "12px", height: "12px", borderRadius: "50%",
                    background: chrome?.backendConnected ? "var(--green)" : "#ff5470",
                    boxShadow: `0 0 12px ${chrome?.backendConnected ? "var(--green)" : "#ff5470"}`,
                  }}
                />
                <span style={{ fontSize: "22px", color: "#BFE0FF", fontWeight: 500 }}>
                  {chrome?.backendConnected ? "Sistem bağlı" : "Bağlantı yok"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* foreground content area inside overscan-safe zone */}
        <div style={{ position: "absolute", left: 77, right: 77, top: 190, bottom: 150 }}>
          {children}
        </div>

        {/* Detection on/off has no visible button — it is toggled by the hidden
            "a"+"l" operator shortcut (see page.tsx), which still prompts for the
            PIN before flipping state. The current state is reflected by the
            "Yüz tanıma" indicator in the header above. */}

        {/* Bottom-right informational clock. Right-aligned to the same 77px
            screen margin as the header pills (and bottom:43, matching the
            header's top:43) so it sits flush with the screen's framing rather
            than dominating the layout like the old oversized clock did. */}
        <div style={{ position: "absolute", right: 77, bottom: 43, textAlign: "right" }}>
          <div className="flex items-baseline justify-end" style={{ gap: "14px" }}>
            <span className="font-display" style={{ fontSize: "40px", fontWeight: 600, color: "#EAF4FF", letterSpacing: ".01em" }}>
              {hh}:{mm}
            </span>
            <span style={{ fontSize: "22px", color: "#7FB2E6", fontWeight: 500 }}>
              {date} · {day}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
