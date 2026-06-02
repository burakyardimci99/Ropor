"use client";

import { motion } from "framer-motion";

import { WeeklyDensity } from "@/lib/api";

const TR_DAYS_SHORT = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

function weekdayLabel(iso: string) {
  // iso is "YYYY-MM-DD"; parse as UTC date to match backend bucketing.
  const [y, m, d] = iso.split("-").map(Number);
  return TR_DAYS_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function DensityChart({ data }: { data: WeeklyDensity }) {
  const peak = Math.max(data.peak, 1);

  return (
    <div style={{ width: "100%" }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "20px", letterSpacing: ".2em", color: "#6FA8DE", fontWeight: 600 }}>
          LAB YOĞUNLUĞU · SON 7 GÜN
        </div>
        <div style={{ fontSize: "22px", color: "#9FC4EA", fontWeight: 500 }}>
          {data.total} giriş
        </div>
      </div>

      <div className="flex items-end" style={{ gap: "16px", height: "150px" }}>
        {data.days.map((d, i) => {
          const ratio = d.count / peak;
          const isPeak = d.count === data.peak && d.count > 0;
          const isToday = i === data.days.length - 1;
          return (
            <div key={d.date} className="flex flex-1 flex-col items-center" style={{ gap: "10px", height: "100%" }}>
              <div className="flex flex-1 flex-col items-center justify-end" style={{ width: "100%" }}>
                <div style={{ fontSize: "22px", fontWeight: 600, color: d.count > 0 ? "#D8E8FF" : "#3E5C82", marginBottom: "8px" }}>
                  {d.count}
                </div>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(ratio * 100, d.count > 0 ? 6 : 2)}%` }}
                  transition={{ duration: 0.6, delay: i * 0.06, ease: "easeOut" }}
                  style={{
                    width: "100%",
                    borderRadius: "12px 12px 6px 6px",
                    background: isPeak
                      ? "linear-gradient(180deg, #34D399, #0e8f63)"
                      : "linear-gradient(180deg, #5BC0FF, #0B63C4)",
                    boxShadow: isPeak
                      ? "0 0 34px -8px rgba(52,211,153,.8)"
                      : "0 0 30px -10px rgba(45,168,255,.7)",
                    opacity: d.count > 0 ? 1 : 0.35,
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? "#5BC0FF" : "#6FA8DE",
                }}
              >
                {weekdayLabel(d.date)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
