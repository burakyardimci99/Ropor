"use client";

import { useCallback, useEffect, useState } from "react";

import {
  AdminStats,
  AdminUserDetail,
  AdminUserRow,
  OnboardingSessionRow,
  VisitRow,
  VisitorSession,
  adminApi,
  getAdminToken,
  setAdminToken,
} from "@/lib/adminApi";

type Tab = "users" | "sessions" | "visits";

export function AdminApp() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(Boolean(getAdminToken()));
  }, []);

  // Kiosk globals lock body overflow; admin needs to scroll.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!authed) return <TokenGate onAuthed={() => setAuthed(true)} />;
  return <Panel onLogout={() => { setAdminToken(""); setAuthed(false); }} />;
}

// ── Token gate ───────────────────────────────────────────────────────────
function TokenGate({ onAuthed }: { onAuthed: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    setAdminToken(value.trim());
    try {
      await adminApi.stats();
      onAuthed();
    } catch (e) {
      setAdminToken("");
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 p-8">
        <h1 className="text-3xl font-bold">AI Lab Admin</h1>
        <p className="mt-2 text-sm text-white/50">
          Admin token gerekli. .env'deki ADMIN_TOKEN değerini gir.
        </p>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Bearer token"
          className="mt-6 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-lg outline-none focus:border-cyan-400"
          autoFocus
        />
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <button
          onClick={submit}
          disabled={busy || !value.trim()}
          className="mt-5 w-full rounded-xl bg-cyan-600 px-6 py-3 text-lg font-semibold transition hover:bg-cyan-500 disabled:opacity-50"
        >
          {busy ? "Doğrulanıyor…" : "Giriş"}
        </button>
      </div>
    </main>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────
function Panel({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("users");
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    const load = () => adminApi.stats().then(setStats).catch(() => {});
    load();
    const i = setInterval(load, 15000);
    return () => clearInterval(i);
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">AI Lab Admin</h1>
        <button
          onClick={onLogout}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm transition hover:bg-white/20"
        >
          Çıkış
        </button>
      </header>

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Kullanıcı" value={stats.users} />
          <Stat label="Aktif" value={stats.active_users} />
          <Stat label="Embedding" value={stats.embeddings} />
          <Stat label="Ziyaret 24s" value={stats.visits_24h} />
          <Stat label="Aktif Onboarding" value={stats.active_onboarding} />
          <Stat label="Aktif Misafir" value={stats.active_visitors} />
        </div>
      )}

      <nav className="mb-4 flex gap-2">
        <TabButton active={tab === "users"} onClick={() => setTab("users")}>
          Kullanıcılar
        </TabButton>
        <TabButton active={tab === "sessions"} onClick={() => setTab("sessions")}>
          Aktif Oturumlar
        </TabButton>
        <TabButton active={tab === "visits"} onClick={() => setTab("visits")}>
          Son Ziyaretler
        </TabButton>
      </nav>

      {tab === "users" && <UsersTab />}
      {tab === "sessions" && <SessionsTab />}
      {tab === "visits" && <VisitsTab />}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-zinc-900 p-4">
      <div className="text-xs uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-cyan-600" : "bg-zinc-900 text-white/60 hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

// ── Users tab ────────────────────────────────────────────────────────────
function UsersTab() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [sort, setSort] = useState<"recent" | "visits" | "name">("visits");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi
      .listUsers({ q, role: role || undefined, sort })
      .then(setRows)
      .catch((e) => setError((e as Error).message));
  }, [q, role, sort]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
      <div className="rounded-2xl bg-zinc-900 p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ad / email ara"
            className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-sm outline-none focus:bg-white/10"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg bg-white/5 px-3 py-2 text-sm"
          >
            <option value="">tüm roller</option>
            <option value="researcher">Araştırmacı</option>
            <option value="student">Öğrenci</option>
            <option value="staff">Personel</option>
            <option value="guest">Misafir</option>
            <option value="external">Dış</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-lg bg-white/5 px-3 py-2 text-sm"
          >
            <option value="visits">en çok ziyaret</option>
            <option value="recent">yeni kayıt</option>
            <option value="name">isme göre</option>
          </select>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-white/40">
            <tr>
              <th className="pb-2">İsim</th>
              <th className="pb-2">Rol</th>
              <th className="pb-2 text-right">Ziyaret</th>
              <th className="pb-2">Son görülme</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr
                key={u.id}
                onClick={() => setSelected(u.id)}
                className={`cursor-pointer border-t border-white/5 hover:bg-white/5 ${
                  selected === u.id ? "bg-cyan-500/10" : ""
                }`}
              >
                <td className="py-2">
                  <div className="font-medium">{u.full_name}</div>
                  <div className="text-xs text-white/40">{u.email}</div>
                </td>
                <td>
                  <span className="rounded bg-white/10 px-2 py-0.5 text-xs">
                    {u.role}
                  </span>
                  {!u.is_active && (
                    <span className="ml-1 rounded bg-red-500/30 px-2 py-0.5 text-xs">
                      pasif
                    </span>
                  )}
                </td>
                <td className="text-right">{u.visit_count}</td>
                <td className="text-xs text-white/50">
                  {u.last_seen ? new Date(u.last_seen).toLocaleString("tr-TR") : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-white/40">
                  Sonuç yok
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <UserDetail
          userId={selected}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function UserDetail({
  userId,
  onClose,
  onChanged,
}: {
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    adminApi
      .userDetail(userId)
      .then((d) => setDetail(d as AdminUserDetail))
      .catch((e) => setError((e as Error).message));
  }, [userId]);

  useEffect(() => {
    setConfirmDelete(false);
    load();
  }, [load]);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await adminApi.patchUser(userId, body);
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    setBusy(true);
    try {
      await adminApi.deleteUser(userId);
      onChanged();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (!detail) {
    return (
      <div className="rounded-2xl bg-zinc-900 p-5 text-sm text-white/50">
        {error ?? "Yükleniyor…"}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl bg-zinc-900 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{detail.full_name}</h2>
          <div className="text-sm text-white/50">{detail.email}</div>
          <div className="text-xs text-white/40">
            {detail.embeddings_count} embedding · {detail.recent_visits.length} son ziyaret
            {detail.kvkk_consented_at && " · KVKK ✓"}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
        >
          ✕
        </button>
      </div>

      <div>
        <label className="text-xs uppercase text-white/40">Rol</label>
        <select
          value={detail.role}
          onChange={(e) => patch({ role: e.target.value })}
          disabled={busy}
          className="mt-1 w-full rounded bg-white/5 px-3 py-2 text-sm"
        >
          <option value="researcher">Araştırmacı</option>
          <option value="student">Öğrenci</option>
          <option value="staff">Personel</option>
          <option value="guest">Misafir</option>
          <option value="external">Dış</option>
        </select>
      </div>

      <Toggle
        label="Aktif"
        checked={detail.is_active}
        onChange={(v) => patch({ is_active: v })}
        disabled={busy}
      />
      <Toggle
        label="Leaderboard'da görün"
        checked={detail.leaderboard_opt_in}
        onChange={(v) => patch({ leaderboard_opt_in: v })}
        disabled={busy}
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
        <div className="text-sm font-semibold text-red-200">KVKK — verileri sil</div>
        <div className="mb-3 text-xs text-white/50">
          Yüz embedding'leri, ziyaretler, rezervasyonlar dahil tüm veri silinir.
        </div>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded bg-red-600/80 px-4 py-2 text-sm font-semibold hover:bg-red-600"
          >
            Sil
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={del}
              disabled={busy}
              className="rounded bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
            >
              Evet, kalıcı sil
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              Vazgeç
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        disabled={disabled}
        role="switch"
        aria-checked={checked}
        className={`relative h-6 w-11 rounded-full transition ${
          checked ? "bg-emerald-500" : "bg-white/20"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </label>
  );
}

// ── Sessions tab ─────────────────────────────────────────────────────────
function SessionsTab() {
  const [visitors, setVisitors] = useState<VisitorSession[]>([]);
  const [onboardings, setOnboardings] = useState<OnboardingSessionRow[]>([]);

  useEffect(() => {
    const load = () => {
      adminApi.visitors().then(setVisitors).catch(() => {});
      adminApi.onboardings().then(setOnboardings).catch(() => {});
    };
    load();
    const i = setInterval(load, 8000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-2xl bg-zinc-900 p-5">
        <h3 className="mb-3 text-sm uppercase tracking-wider text-white/40">
          Aktif Misafirler
        </h3>
        {visitors.length === 0 && <Empty>Yok</Empty>}
        <ul className="space-y-2">
          {visitors.map((v) => (
            <li key={v.id} className="rounded bg-white/5 px-3 py-2">
              <div className="font-medium">{v.visitor_name ?? "—"}</div>
              <div className="text-xs text-white/50">
                {v.purpose ?? "amaç belirtilmemiş"} ·{" "}
                {new Date(v.entered_at).toLocaleString("tr-TR")}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-zinc-900 p-5">
        <h3 className="mb-3 text-sm uppercase tracking-wider text-white/40">
          Devam Eden Onboarding
        </h3>
        {onboardings.length === 0 && <Empty>Yok</Empty>}
        <ul className="space-y-2">
          {onboardings.map((o) => (
            <li key={o.id} className="rounded bg-white/5 px-3 py-2">
              <div className="font-medium">{o.full_name ?? "(isim yok)"}</div>
              <div className="text-xs text-white/50">
                {o.email ?? "—"} · {o.status} ·{" "}
                {new Date(o.started_at).toLocaleString("tr-TR")}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Visits tab ───────────────────────────────────────────────────────────
function VisitsTab() {
  const [rows, setRows] = useState<VisitRow[]>([]);

  useEffect(() => {
    const load = () => adminApi.visits(50).then(setRows).catch(() => {});
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="rounded-2xl bg-zinc-900 p-5">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-white/40">
          <tr>
            <th className="pb-2">Kullanıcı</th>
            <th className="pb-2">Zaman</th>
            <th className="pb-2 text-right">Güven</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id} className="border-t border-white/5">
              <td className="py-2">{v.user_name}</td>
              <td className="text-white/60">
                {new Date(v.entered_at).toLocaleString("tr-TR")}
              </td>
              <td className="text-right text-white/50">
                {v.detection_confidence != null
                  ? v.detection_confidence.toFixed(2)
                  : "—"}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-center text-white/40">
                Yok
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-4 text-sm text-white/40">{children}</div>;
}
