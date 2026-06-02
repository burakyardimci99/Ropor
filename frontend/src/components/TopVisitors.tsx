"use client";

import { motion } from "framer-motion";

import { LeaderboardEntry } from "@/lib/api";

function initialsOf(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join("") || "?").toUpperCase();
}

// Rank accent: gold / silver / bronze for the podium, blue otherwise.
const RANK_COLOR = ["#FBBF24", "#CBD5E1", "#D8A06A"];

export function TopVisitors({ entries }: { entries: LeaderboardEntry[] }) {
  const rows = entries.slice(0, 4);
  const max = Math.max(1, ...rows.map((r) => r.visit_count));

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-baseline justify-between" style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "20px", letterSpacing: ".2em", color: "#6FA8DE", fontWeight: 600 }}>
          EN ÇOK ZİYARET EDEN
        </div>
        <div style={{ fontSize: "22px", color: "#9FC4EA", fontWeight: 500 }}>Bu ay</div>
      </div>

      {rows.length === 0 ? (
        <div
          className="glass flex items-center justify-center"
          style={{ height: "120px", borderRadius: "20px", border: "1px solid rgba(91,192,255,.18)", fontSize: "26px", color: "#6FA8DE" }}
        >
          Henüz veri yok
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: "10px" }}>
          {rows.map((e, i) => {
            const ratio = e.visit_count / max;
            const leader = i === 0;
            const rankColor = RANK_COLOR[i] ?? "#5BC0FF";
            return (
              <motion.div
                key={e.user_id || i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                className="glass flex items-center"
                style={{ gap: "16px", padding: "12px 20px", borderRadius: "18px", border: "1px solid rgba(91,192,255,.16)" }}
              >
                {/* rank badge */}
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: "40px", height: "40px", borderRadius: "12px", flexShrink: 0,
                    fontSize: "22px", fontWeight: 700, color: "#04101f", background: rankColor,
                    boxShadow: `0 0 22px -6px ${rankColor}`,
                  }}
                >
                  {i + 1}
                </span>

                {/* avatar */}
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: "44px", height: "44px", borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(150deg, #1f6dc4, #0B63C4)",
                    fontSize: "18px", fontWeight: 700, color: "#EAF4FF",
                  }}
                >
                  {initialsOf(e.full_name)}
                </span>

                {/* name + bar */}
                <div style={{ flex: "1 1 0", minWidth: 0 }}>
                  <div className="flex items-baseline justify-between" style={{ gap: "12px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "24px", fontWeight: 600, color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {e.full_name}
                    </span>
                    <span style={{ flexShrink: 0, fontSize: "23px", fontWeight: 600, color: leader ? "#34D399" : "#9FC4EA" }}>
                      {e.visit_count} ziyaret
                      {e.badge_count > 0 ? <span style={{ color: "#6FA8DE" }}> · {e.badge_count}🏅</span> : null}
                    </span>
                  </div>
                  <div style={{ width: "100%", height: "10px", borderRadius: "99px", background: "rgba(45,168,255,.14)", overflow: "hidden" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(ratio * 100, 6)}%` }}
                      transition={{ duration: 0.6, delay: 0.1 + i * 0.06, ease: "easeOut" }}
                      style={{
                        height: "100%",
                        borderRadius: "99px",
                        background: leader
                          ? "linear-gradient(90deg, #5BC0FF, #34D399)"
                          : "linear-gradient(90deg, #0B63C4, #5BC0FF)",
                        boxShadow: leader ? "0 0 18px rgba(52,211,153,.7)" : "0 0 16px rgba(91,192,255,.6)",
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
