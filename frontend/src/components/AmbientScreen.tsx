"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { LeaderboardEntry, LiveDashboard, api } from "@/lib/api";

export function AmbientScreen() {
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [live, setLive] = useState<LiveDashboard | null>(null);
  const [clock, setClock] = useState("");

  useEffect(() => {
    const load = () => {
      api.leaderboard().then(setBoard).catch(() => {});
      api.live().then(setLive).catch(() => {});
    };
    load();
    const poll = setInterval(load, 10000);
    const tick = setInterval(
      () => setClock(new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })),
      1000,
    );
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-full w-full flex-col p-12"
    >
      <div className="flex items-baseline justify-between">
        <h1 className="text-4xl font-bold tracking-tight text-white/90">AI Lab</h1>
        <span className="text-3xl font-light text-white/50">{clock}</span>
      </div>

      <div className="mt-10 grid flex-1 grid-cols-2 gap-10">
        <Panel title="Şu an içeride">
          {live?.currently_inside.length ? (
            <ul className="space-y-3">
              {live.currently_inside.map((u) => (
                <li key={u.id} className="flex items-center gap-3 text-2xl text-white/80">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  {u.full_name}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Şu an lab boş</Empty>
          )}
        </Panel>

        <Panel title="Leaderboard · Bu ay">
          {board.length ? (
            <ol className="space-y-2">
              {board.map((e, i) => (
                <li
                  key={e.user_id}
                  className="flex items-center justify-between text-xl text-white/80"
                >
                  <span>
                    <span className="mr-3 inline-block w-6 text-white/40">{i + 1}</span>
                    {e.full_name}
                  </span>
                  <span className="text-white/50">
                    {e.visit_count} ziyaret
                    {e.badge_count > 0 && ` · ${e.badge_count}🏅`}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>Henüz veri yok</Empty>
          )}
        </Panel>
      </div>
    </motion.div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/5 p-8">
      <h2 className="mb-6 text-sm font-semibold uppercase tracking-widest text-white/40">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xl text-white/30">{children}</div>;
}
