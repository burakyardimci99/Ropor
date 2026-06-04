"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { DensityChart } from "@/components/DensityChart";
import { InsideTable } from "@/components/InsideTable";
import { TopVisitors } from "@/components/TopVisitors";
import { ScanViewport, useClock } from "@/components/kiosk/visuals";
import { LeaderboardEntry, LiveDashboard, WeeklyDensity, api } from "@/lib/api";

export function AmbientScreen() {
  const { hh } = useClock();

  // Time-of-day greeting derived from the clock hour. `hh` is "--" until the
  // clock mounts (see useClock), so parseInt is NaN on the server/first render
  // and we fall back to a neutral welcome — which also keeps SSR and hydration
  // in sync.
  const hour = parseInt(hh, 10);
  const greeting = Number.isNaN(hour)
    ? "Hoş geldiniz"
    : hour < 6
      ? "İyi geceler"
      : hour < 12
        ? "Günaydın"
        : hour < 18
          ? "İyi günler"
          : "İyi akşamlar";
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
      {/* left: greeting · who's-in-the-lab table · scan ring */}
      <div className="flex flex-col" style={{ flex: "1.45 1 0", minWidth: 0, gap: "30px" }}>
        {/* Nudge the clock/greeting block up a little so it sits closer to the
            top edge of the content area. */}
        <div style={{ marginTop: "-28px" }}>
          {/* Warm, time-of-day greeting that reads as a real welcome rather than
              a small section label. The big clock that used to live here was
              moved to a compact, informational readout in the bottom-right so it
              no longer dominates the top-left. */}
          <div style={{ fontSize: "46px", fontWeight: 600, color: "#EAF4FF", letterSpacing: ".005em" }}>
            {greeting}
            <span style={{ color: "#7FB2E6", fontWeight: 500 }}>, hoş geldiniz</span>
          </div>
        </div>

        <InsideTable people={inside} />

        {/* scan ring + CTA, centered in the space the density chart used to
            share (the chart moved under the leaderboard on the right). */}
        <div className="flex flex-1 flex-col items-center justify-center" style={{ gap: "16px" }}>
          <ScanViewport state="idle" size={240} />
          <div style={{ fontSize: "34px", fontWeight: 700, color: "#FFFFFF", textAlign: "center" }}>
            Yüzünüzü kameraya gösterin
          </div>
        </div>
      </div>

      {/* right: top-visitors leaderboard with the weekly density chart stacked
          underneath it. Aligned to the top so the leaderboard lines up with the
          clock/greeting rather than floating in the vertical center. */}
      <div className="flex flex-col justify-start" style={{ flex: "1 1 0", minWidth: 0, marginTop: "-28px", gap: "34px" }}>
        <TopVisitors entries={board} />
        {density && <DensityChart data={density} />}
      </div>
    </motion.div>
  );
}
