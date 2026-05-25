"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

import { UserProfile, api } from "@/lib/api";

interface Props {
  userId: string;
  onBack: () => void;
  onActivity: () => void;
}

export function ProfileScreen({ userId, onBack, onActivity }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    api
      .getProfile(userId)
      .then(setProfile)
      .catch((e) => setError((e as Error).message));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      onActivity();
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack, onActivity]);

  const toggleLeaderboard = async () => {
    if (!profile) return;
    onActivity();
    setBusy(true);
    try {
      await api.patchUser(userId, { leaderboard_opt_in: !profile.leaderboard_opt_in });
      setProfile({ ...profile, leaderboard_opt_in: !profile.leaderboard_opt_in });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    onActivity();
    setBusy(true);
    try {
      await api.deleteUser(userId);
      onBack();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (!profile) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex h-full w-full items-center justify-center text-2xl text-white/50"
      >
        {error ?? "Profil yükleniyor…"}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center px-12"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-5xl font-bold">{profile.full_name}</h1>
        <span className="rounded-full bg-white/10 px-4 py-1.5 text-lg text-white/60">
          {profile.role}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4 text-lg text-white/50">
        <span>{profile.email_verified ? "✓ Email doğrulandı" : "Email doğrulanmadı"}</span>
        {profile.badges.length > 0 && <span>{profile.badges.length} rozet 🏅</span>}
        <span>{profile.recent_visits.length} son ziyaret</span>
      </div>

      {profile.interests.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {profile.interests.map((t) => (
            <span
              key={t}
              className="rounded-full bg-cyan-500/20 px-4 py-1.5 text-lg text-cyan-200"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {profile.current_reservation && (
        <div className="mt-6 rounded-xl bg-white/5 p-5 text-xl text-white/80">
          Aktif rezervasyon: {profile.current_reservation.resource_name}
        </div>
      )}

      {/* Leaderboard opt-out */}
      <div className="mt-8 flex items-center justify-between rounded-xl bg-white/5 p-5">
        <div>
          <div className="text-xl font-semibold">Leaderboard&apos;da görün</div>
          <div className="text-base text-white/50">
            Kapatırsan sıralamada gösterilmezsin.
          </div>
        </div>
        <button
          onClick={toggleLeaderboard}
          disabled={busy}
          role="switch"
          aria-checked={profile.leaderboard_opt_in}
          className={`relative h-9 w-16 rounded-full transition disabled:opacity-50 ${
            profile.leaderboard_opt_in ? "bg-emerald-500" : "bg-white/20"
          }`}
        >
          <span
            className={`absolute top-1 h-7 w-7 rounded-full bg-white transition-all ${
              profile.leaderboard_opt_in ? "left-8" : "left-1"
            }`}
          />
        </button>
      </div>

      {/* KVKK delete */}
      <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-5">
        <div className="text-xl font-semibold text-red-200">Verilerimi sil (KVKK)</div>
        <div className="mb-4 text-base text-white/60">
          Yüz verin, ziyaretlerin ve profilin kalıcı olarak silinir.
        </div>
        {!confirmDelete ? (
          <button
            onClick={() => {
              onActivity();
              setConfirmDelete(true);
            }}
            className="rounded-lg bg-red-600/80 px-6 py-3 text-lg font-semibold transition hover:bg-red-600"
          >
            Tüm verilerimi sil
          </button>
        ) : (
          <div className="flex items-center gap-4">
            <span className="text-lg text-red-200">Emin misin?</span>
            <button
              onClick={deleteAccount}
              disabled={busy}
              className="rounded-lg bg-red-600 px-6 py-3 text-lg font-semibold transition hover:bg-red-500 disabled:opacity-50"
            >
              Evet, kalıcı olarak sil
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg bg-white/10 px-6 py-3 text-lg transition hover:bg-white/20"
            >
              Vazgeç
            </button>
          </div>
        )}
      </div>

      {error && <p className="mt-5 text-lg text-red-400">{error}</p>}

      <div className="mt-8 text-white/50">[Esc] ana ekrana dön</div>
    </motion.div>
  );
}
