"use client";

import { useCallback, useEffect, useState } from "react";

import { FormCard } from "@/components/kiosk/visuals";
import { UserProfile, api } from "@/lib/api";

interface Props {
  userId: string;
  onBack: () => void;
  onActivity: () => void;
}

function initialsOf(fullName?: string) {
  if (!fullName) return "AI";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "AI";
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
      <FormCard maxWidth={760} motionKey="profile-loading">
        <div style={{ fontSize: "32px", color: "#9FC4EA", textAlign: "center" }}>
          {error ?? "Profil yükleniyor…"}
        </div>
      </FormCard>
    );
  }

  return (
    <FormCard maxWidth={1120} motionKey="profile">
      {/* header */}
      <div className="flex items-center" style={{ gap: "28px" }}>
        <div
          className="font-display flex items-center justify-center rounded-full"
          style={{
            width: "108px", height: "108px", flexShrink: 0, fontSize: "44px", fontWeight: 700,
            color: "#EAF4FF", background: "linear-gradient(150deg, #1f6dc4, #0B63C4)",
            boxShadow: "0 0 40px -10px rgba(45,168,255,.8)",
          }}
        >
          {initialsOf(profile.full_name)}
        </div>
        <div style={{ flex: 1 }}>
          <h1 className="font-display" style={{ fontSize: "60px", fontWeight: 700, color: "#FFFFFF", lineHeight: 1 }}>
            {profile.full_name}
          </h1>
          <div className="flex items-center" style={{ gap: "20px", marginTop: "12px", fontSize: "24px", color: "#7FB2E6" }}>
            <span style={{ borderRadius: "99px", background: "rgba(45,168,255,.16)", color: "#9FD3FF", padding: "6px 18px" }}>
              {profile.role}
            </span>
            <span>{profile.email_verified ? "✓ Email doğrulandı" : "Email doğrulanmadı"}</span>
            {profile.badges.length > 0 && <span>{profile.badges.length} rozet 🏅</span>}
            <span>{profile.recent_visits.length} son ziyaret</span>
          </div>
        </div>
      </div>

      {profile.interests.length > 0 && (
        <div className="flex flex-wrap" style={{ gap: "12px", marginTop: "28px" }}>
          {profile.interests.map((t) => (
            <span key={t} style={{ borderRadius: "99px", padding: "10px 22px", fontSize: "24px", background: "rgba(45,168,255,.16)", color: "#9FD3FF" }}>
              {t}
            </span>
          ))}
        </div>
      )}

      {profile.current_reservation && (
        <div className="glass" style={{ marginTop: "24px", borderRadius: "18px", padding: "22px 28px", fontSize: "28px", color: "#CFE6FF" }}>
          Aktif rezervasyon: {profile.current_reservation.resource_name}
        </div>
      )}

      {/* Leaderboard opt-out */}
      <div
        className="flex items-center justify-between"
        style={{ marginTop: "32px", borderRadius: "18px", padding: "26px 30px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(91,192,255,.16)" }}
      >
        <div>
          <div style={{ fontSize: "30px", fontWeight: 600, color: "#EAF4FF" }}>Leaderboard&apos;da görün</div>
          <div style={{ fontSize: "22px", color: "#7FB2E6", marginTop: "4px" }}>Kapatırsan sıralamada gösterilmezsin.</div>
        </div>
        <button
          onClick={toggleLeaderboard}
          disabled={busy}
          role="switch"
          aria-checked={profile.leaderboard_opt_in}
          style={{
            position: "relative", width: "84px", height: "44px", borderRadius: "99px", border: "none", cursor: "pointer",
            background: profile.leaderboard_opt_in ? "var(--green)" : "rgba(255,255,255,.18)",
            opacity: busy ? 0.5 : 1, transition: "background .2s ease",
          }}
        >
          <span
            style={{
              position: "absolute", top: "5px", height: "34px", width: "34px", borderRadius: "50%", background: "#fff",
              left: profile.leaderboard_opt_in ? "45px" : "5px", transition: "left .2s ease",
            }}
          />
        </button>
      </div>

      {/* KVKK delete */}
      <div style={{ marginTop: "20px", borderRadius: "18px", padding: "26px 30px", background: "rgba(251,113,133,.08)", border: "1px solid rgba(251,113,133,.35)" }}>
        <div style={{ fontSize: "30px", fontWeight: 600, color: "#FCA5A5" }}>Verilerimi sil (KVKK)</div>
        <div style={{ fontSize: "22px", color: "#C9A6AE", marginTop: "4px", marginBottom: "18px" }}>
          Yüz verin, ziyaretlerin ve profilin kalıcı olarak silinir.
        </div>
        {!confirmDelete ? (
          <button
            onClick={() => {
              onActivity();
              setConfirmDelete(true);
            }}
            style={{ borderRadius: "14px", padding: "18px 32px", fontSize: "26px", fontWeight: 600, border: "none", cursor: "pointer", color: "#fff", background: "rgba(244,63,94,.8)" }}
          >
            Tüm verilerimi sil
          </button>
        ) : (
          <div className="flex items-center" style={{ gap: "18px" }}>
            <span style={{ fontSize: "26px", color: "#FCA5A5" }}>Emin misin?</span>
            <button
              onClick={deleteAccount}
              disabled={busy}
              style={{ borderRadius: "14px", padding: "18px 32px", fontSize: "26px", fontWeight: 600, border: "none", cursor: "pointer", color: "#fff", background: "#f43f5e", opacity: busy ? 0.5 : 1 }}
            >
              Evet, kalıcı olarak sil
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{ borderRadius: "14px", padding: "18px 32px", fontSize: "26px", border: "none", cursor: "pointer", color: "#CFE6FF", background: "rgba(255,255,255,.08)" }}
            >
              Vazgeç
            </button>
          </div>
        )}
      </div>

      {error && <p style={{ marginTop: "20px", fontSize: "24px", color: "#FCA5A5" }}>{error}</p>}

      <div style={{ marginTop: "28px", fontSize: "24px", color: "#5E86B5" }}>[Esc] ana ekrana dön</div>
    </FormCard>
  );
}
