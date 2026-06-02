"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { DensityChart } from "@/components/DensityChart";
import { InsideTable } from "@/components/InsideTable";
import { TopVisitors } from "@/components/TopVisitors";
import { ScanViewport, useClock } from "@/components/kiosk/visuals";
import { LeaderboardEntry, LiveDashboard, WeeklyDensity, api } from "@/lib/api";

export function AmbientScreen() {
  const { hh, mm, ss, date, day } = useClock();
  const [live, setLive] = useState<LiveDashboard | null>(null);
  const [density, setDensity] = useState<WeeklyDensity | null>(null);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const load = () => api.live().then(setLive).catch(() => {});
    load();
    const poll = setInterval(load, 10000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    const load = () => api.density().then(setDensity).catch(() => {});
    load();
    const poll = setInterval(load, 60000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    const load = () => api.leaderboard().then(setBoard).catch(() => {});
    load();
    const poll = setInterval(load, 60000);
    return () => clearInterval(poll);
  }, []);

  const inside = live?.currently_inside ?? [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="state-anim flex h-full w-full items-stretch"
      style={{ gap: "70px" }}
    >
      {/* left: clock · who's-in-the-lab table · weekly density */}
      <div className="flex flex-col" style={{ flex: "1.45 1 0", minWidth: 0, gap: "30px" }}>
        <div>
          <div style={{ fontSize: "26px", letterSpacing: ".34em", color: "var(--blue-bright)", fontWeight: 600 }}>
            HOŞ GELDİNİZ
          </div>
          <div className="flex items-end" style={{ marginTop: "6px", lineHeight: 0.86 }}>
            <span className="font-display" style={{ fontSize: "126px", fontWeight: 700, color: "#FFFFFF", letterSpacing: "-.02em" }}>
              {hh}:{mm}
            </span>
            <span className="font-display" style={{ fontSize: "48px", fontWeight: 500, color: "var(--blue)", marginBottom: "16px", marginLeft: "10px" }}>
              {ss}
            </span>
            <span style={{ marginLeft: "26px", marginBottom: "20px", fontSize: "30px", color: "#CFE6FF", fontWeight: 500 }}>
              {date} · {day}
            </span>
          </div>
        </div>

        <InsideTable people={inside} />

        <div className="flex" style={{ gap: "44px" }}>
          <div style={{ flex: "1 1 0", minWidth: 0 }}>{density && <DensityChart data={density} />}</div>
          <div style={{ flex: "1 1 0", minWidth: 0 }}>
            <TopVisitors entries={board} />
          </div>
        </div>
      </div>

      {/* right: scan ring + CTA */}
      <div className="flex flex-col items-center justify-center" style={{ flex: "1 1 0", gap: "40px" }}>
        <ScanViewport state="idle" size={420} />
        <div className="flex flex-col items-center" style={{ gap: "14px" }}>
          <div style={{ fontSize: "52px", fontWeight: 700, color: "#FFFFFF", textAlign: "center" }}>
            Yüzünüzü kameraya gösterin
          </div>
          <div style={{ fontSize: "28px", color: "#7FB2E6", fontWeight: 400, textAlign: "center" }}>
            Sisteme erişim için lütfen kameraya bakın
          </div>
        </div>
      </div>
    </motion.div>
  );
}
