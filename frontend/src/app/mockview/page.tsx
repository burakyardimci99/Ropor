"use client";

import { motion } from "framer-motion";

import { DensityChart } from "@/components/DensityChart";
import { InsideTable } from "@/components/InsideTable";
import { KioskStage, ScanViewport, useClock } from "@/components/kiosk/visuals";
import { InsidePerson, WeeklyDensity } from "@/lib/api";

const MOCK_INSIDE: InsidePerson[] = [
  { id: "1", full_name: "Ada Yılmaz", role: "researcher", interests: ["NLP", "RAG"], intent: "Difüzyon modeli fine-tune ediyor", entered_at: new Date(Date.now() - 92 * 60000).toISOString() },
  { id: "2", full_name: "Mehmet Demir", role: "student", interests: ["CV"], intent: "Veri etiketleme aracı geliştiriyor", entered_at: new Date(Date.now() - 34 * 60000).toISOString() },
  { id: "3", full_name: "Elif Kaya", role: "staff", interests: ["MLOps"], intent: null, entered_at: new Date(Date.now() - 8 * 60000).toISOString() },
  { id: "4", full_name: "Can Öz", role: "student", interests: [], intent: "Robotik kol", entered_at: new Date(Date.now() - 3 * 60000).toISOString() },
];

const MOCK_DENSITY: WeeklyDensity = {
  days: [
    { date: "2026-05-26", count: 12 },
    { date: "2026-05-27", count: 19 },
    { date: "2026-05-28", count: 8 },
    { date: "2026-05-29", count: 23 },
    { date: "2026-05-30", count: 4 },
    { date: "2026-05-31", count: 2 },
    { date: "2026-06-01", count: 15 },
  ],
  peak: 23,
  total: 83,
  generated_at: new Date().toISOString(),
};

export default function MockAmbient() {
  const { hh, mm, ss, date, day } = useClock();
  const inside = MOCK_INSIDE;
  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <KioskStage glow="idle" chrome={{ backendConnected: true, cameraConnected: true, cameraText: "Kamera bağlı · 0f", privacyNote: "Yüz tanıma aktif" }}>
        <motion.div className="state-anim flex h-full w-full items-stretch" style={{ gap: "70px" }}>
          <div className="flex flex-col" style={{ flex: "1.45 1 0", minWidth: 0, gap: "30px" }}>
            <div>
              <div style={{ fontSize: "26px", letterSpacing: ".34em", color: "var(--blue-bright)", fontWeight: 600 }}>HOŞ GELDİNİZ</div>
              <div className="flex items-end" style={{ marginTop: "6px", lineHeight: 0.86 }}>
                <span className="font-display" style={{ fontSize: "126px", fontWeight: 700, color: "#FFFFFF", letterSpacing: "-.02em" }}>{hh}:{mm}</span>
                <span className="font-display" style={{ fontSize: "48px", fontWeight: 500, color: "var(--blue)", marginBottom: "16px", marginLeft: "10px" }}>{ss}</span>
                <span style={{ marginLeft: "26px", marginBottom: "20px", fontSize: "30px", color: "#CFE6FF", fontWeight: 500 }}>{date} · {day}</span>
              </div>
            </div>
            <InsideTable people={inside} />
            <DensityChart data={MOCK_DENSITY} />
          </div>
          <div className="flex flex-col items-center justify-center" style={{ flex: "1 1 0", gap: "40px" }}>
            <ScanViewport state="idle" size={420} />
            <div className="flex flex-col items-center" style={{ gap: "14px" }}>
              <div style={{ fontSize: "52px", fontWeight: 700, color: "#FFFFFF", textAlign: "center" }}>Yüzünüzü kameraya gösterin</div>
              <div style={{ fontSize: "28px", color: "#7FB2E6", fontWeight: 400, textAlign: "center" }}>Sisteme erişim için lütfen kameraya bakın</div>
            </div>
          </div>
        </motion.div>
      </KioskStage>
    </main>
  );
}
