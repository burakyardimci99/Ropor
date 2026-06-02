"use client";

import { motion } from "framer-motion";

import { InsidePerson } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  researcher: "Araştırmacı",
  student: "Öğrenci",
  staff: "Personel",
  guest: "Misafir",
};

function initialsOf(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join("") || "?").toUpperCase();
}

function sinceLabel(iso: string | null) {
  if (!iso) return "—";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

function workingOn(p: InsidePerson) {
  if (p.intent && p.intent.trim()) return p.intent.trim();
  if (p.interests?.length) return p.interests.slice(0, 2).join(", ");
  return "—";
}

export function InsideTable({ people }: { people: InsidePerson[] }) {
  const rows = people.slice(0, 3);

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-baseline justify-between" style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "20px", letterSpacing: ".2em", color: "#6FA8DE", fontWeight: 600 }}>
          ŞU AN LABDA
        </div>
        <div className="flex items-center" style={{ gap: "10px", fontSize: "22px", color: "#9FC4EA", fontWeight: 500 }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 12px var(--green)" }} />
          {people.length} kişi
        </div>
      </div>

      {rows.length === 0 ? (
        <div
          className="glass flex items-center justify-center"
          style={{ height: "120px", borderRadius: "20px", border: "1px solid rgba(91,192,255,.18)", fontSize: "26px", color: "#6FA8DE" }}
        >
          Şu anda labda kimse yok
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: "10px" }}>
          {/* column header */}
          <div
            className="flex items-center"
            style={{ padding: "0 24px", fontSize: "17px", letterSpacing: ".12em", color: "#5E86B5", fontWeight: 600 }}
          >
            <div style={{ flex: "1.4 1 0" }}>KİŞİ</div>
            <div style={{ flex: "2 1 0" }}>ÜZERİNDE ÇALIŞIYOR</div>
            <div style={{ flex: ".6 1 0", textAlign: "right" }}>SÜRE</div>
          </div>

          {rows.map((p, i) => (
            <motion.div
              key={p.id || i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
              className="glass flex items-center"
              style={{
                gap: "20px",
                padding: "14px 24px",
                borderRadius: "18px",
                border: "1px solid rgba(91,192,255,.16)",
              }}
            >
              <div className="flex items-center" style={{ flex: "1.4 1 0", gap: "16px", minWidth: 0 }}>
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: "52px", height: "52px", borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(150deg, #5BC0FF, #0B63C4)",
                    fontSize: "22px", fontWeight: 700, color: "#04101f",
                  }}
                >
                  {initialsOf(p.full_name)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "27px", fontWeight: 600, color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.full_name}
                  </div>
                  <div style={{ fontSize: "19px", color: "#7FB2E6", fontWeight: 500 }}>
                    {ROLE_LABELS[p.role] ?? p.role}
                  </div>
                </div>
              </div>

              <div
                style={{
                  flex: "2 1 0", fontSize: "24px", color: workingOn(p) === "—" ? "#5E86B5" : "#CFE6FF",
                  fontWeight: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
              >
                {workingOn(p)}
              </div>

              <div style={{ flex: ".6 1 0", textAlign: "right", fontSize: "23px", color: "#9FC4EA", fontWeight: 500 }}>
                {sinceLabel(p.entered_at)}
              </div>
            </motion.div>
          ))}

          {people.length > rows.length && (
            <div style={{ textAlign: "center", fontSize: "20px", color: "#6FA8DE", marginTop: "2px" }}>
              +{people.length - rows.length} kişi daha
            </div>
          )}
        </div>
      )}
    </div>
  );
}
