"use client";

import { motion } from "framer-motion";
import { ReactNode, useEffect } from "react";

import { ScanViewport } from "@/components/kiosk/visuals";
import { GreetingPayload } from "@/lib/kioskMachine";

function Stat({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <span
      className="glass"
      style={{
        padding: "12px 26px",
        borderRadius: "99px",
        fontSize: "30px",
        fontWeight: 600,
        color: accent ? "#FDBA74" : "#CFE6FF",
        border: accent ? "1px solid rgba(251,146,60,.45)" : "1px solid rgba(91,192,255,.22)",
      }}
    >
      {children}
    </span>
  );
}

function initialsOf(fullName?: string) {
  if (!fullName) return "AI";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]);
  return letters.join("").toUpperCase() || "AI";
}

export function GreetingScreen({
  greeting,
  onProfile,
}: {
  greeting: GreetingPayload;
  onProfile: () => void;
}) {
  const fullName = greeting.user?.full_name;
  const first = fullName?.split(" ")[0] ?? "";
  const welcome = greeting.welcome;
  const hasProfile = !welcome && Boolean(greeting.user?.id);
  const role = greeting.user?.role;
  const reservation = greeting.current_reservation?.resource_name;

  useEffect(() => {
    if (!hasProfile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "p") onProfile();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasProfile, onProfile]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="state-anim flex h-full w-full items-center justify-center"
      style={{ gap: "90px" }}
    >
      <ScanViewport state="welcome" initials={initialsOf(fullName)} />

      <div style={{ maxWidth: "1000px" }}>
        <div style={{ fontSize: "64px", fontWeight: 600, color: "var(--green)", letterSpacing: ".01em" }}>
          {welcome ? "Aramıza hoş geldin," : "Hoş geldin,"}
        </div>
        <div
          className="font-display"
          style={{
            fontSize: "210px", fontWeight: 700, color: "#FFFFFF",
            lineHeight: 0.92, letterSpacing: "-.02em",
          }}
        >
          {first || "Misafir"}
        </div>

        {role && <div style={{ fontSize: "56px", color: "#CFE6FF", fontWeight: 400, marginTop: "4px" }}>{role}</div>}

        {greeting.message && (
          <div style={{ fontSize: "40px", color: "#A9CDF2", fontWeight: 400, marginTop: "16px", maxWidth: "920px", lineHeight: 1.25 }}>
            {greeting.message}
          </div>
        )}

        {/* stat chips — visit count, streak, badges */}
        <div className="flex flex-wrap items-center" style={{ gap: "16px", marginTop: "28px" }}>
          <Stat>{(greeting.visit_count ?? 0) + 1}. ziyaret</Stat>
          {greeting.streak_days && greeting.streak_days >= 2 ? (
            <Stat accent>🔥 {greeting.streak_days} gün üst üste</Stat>
          ) : null}
          {greeting.badge_count ? <Stat>🏅 {greeting.badge_count} rozet</Stat> : null}
        </div>

        {reservation && (
          <div style={{ fontSize: "32px", color: "#7FB2E6", marginTop: "16px" }}>
            Rezervasyonun: {reservation}
          </div>
        )}

        {/* entry confirmation (logged — there is no physical door) */}
        {(welcome || greeting.visit_id) && (
          <div
            className="pop flex items-center"
            style={{
              gap: "18px", marginTop: "40px", padding: "20px 38px", borderRadius: "99px",
              background: "rgba(52,211,153,.12)", border: "2px solid rgba(52,211,153,.45)", width: "fit-content",
            }}
          >
            <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
              <circle cx="21" cy="21" r="19" stroke="var(--green)" strokeWidth="3" />
              <path className="check-path" d="M12 22l6 6 12-14" stroke="var(--green)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: "38px", fontWeight: 600, color: "#A7F3D0" }}>
              {welcome ? "Kaydın oluşturuldu" : "Girişin kaydedildi"}
            </span>
          </div>
        )}

        {hasProfile && (
          <div style={{ marginTop: "28px", fontSize: "26px", color: "#5E86B5" }}>
            <kbd style={{ background: "rgba(255,255,255,.1)", borderRadius: "8px", padding: "4px 12px" }}>P</kbd>
            <span style={{ marginLeft: "12px" }}>Profil &amp; gizlilik</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
