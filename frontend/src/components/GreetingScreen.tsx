"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";

import { GreetingPayload } from "@/lib/kioskMachine";

export function GreetingScreen({
  greeting,
  onProfile,
}: {
  greeting: GreetingPayload;
  onProfile: () => void;
}) {
  const name = greeting.user?.full_name?.split(" ")[0];
  const welcome = greeting.welcome;
  const hasProfile = !welcome && Boolean(greeting.user?.id);

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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5 }}
      className="flex h-full w-full flex-col items-center justify-center px-12 text-center"
    >
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-7xl font-bold tracking-tight"
      >
        {welcome ? "🎉" : "👋"} {name ? `Hoş geldin, ${name}` : "Hoş geldin"}
      </motion.div>

      {greeting.message && (
        <motion.p
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mt-8 max-w-3xl text-3xl font-light leading-relaxed text-white/80"
        >
          {greeting.message}
        </motion.p>
      )}

      {!welcome && (greeting.visit_count != null || greeting.badge_count != null) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-10 flex gap-10 text-xl text-white/50"
        >
          {greeting.visit_count != null && <span>{greeting.visit_count} ziyaret</span>}
          {greeting.badge_count ? <span>{greeting.badge_count} rozet 🏅</span> : null}
        </motion.div>
      )}

      {hasProfile && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-12 text-lg text-white/40"
        >
          <kbd className="rounded bg-white/10 px-2 py-1">P</kbd> · Profil &amp; gizlilik
        </motion.div>
      )}
    </motion.div>
  );
}
