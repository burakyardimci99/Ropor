"use client";

import { restBase } from "@/lib/origin";

const TOKEN_KEY = "ailab.admin.token";

export function getAdminToken(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(TOKEN_KEY) ?? "";
}

export function setAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const base = restBase(process.env.NEXT_PUBLIC_BACKEND_URL);
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAdminToken()}`,
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      res.status === 401
        ? "Token eksik."
        : res.status === 403
          ? "Geçersiz token."
          : res.status === 503
            ? "Admin paneli sunucuda devre dışı (ADMIN_TOKEN boş)."
            : (data?.detail ?? `İstek başarısız (${res.status})`);
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export interface AdminStats {
  users: number;
  active_users: number;
  embeddings: number;
  visits_24h: number;
  active_onboarding: number;
  active_visitors: number;
}

export interface AdminUserRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  leaderboard_opt_in: boolean;
  email_verified: boolean;
  visit_count: number;
  last_seen: string | null;
  created_at: string;
}

export interface AdminUserDetail extends AdminUserRow {
  interests: string[];
  bio: string | null;
  embeddings_count: number;
  kvkk_consented_at: string | null;
  current_reservation: { resource_name: string } | null;
  badges: { code: string; name: string; earned_at: string }[];
  recent_visits: { entered_at: string }[];
}

export interface VisitorSession {
  id: string;
  visitor_name: string | null;
  purpose: string | null;
  entered_at: string;
  expires_at: string;
}

export interface OnboardingSessionRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  status: string;
  started_at: string;
  expires_at: string;
}

export interface VisitRow {
  id: string;
  user_id: string;
  user_name: string;
  entered_at: string;
  detection_confidence: number | null;
}

export const adminApi = {
  stats: () => call<AdminStats>("GET", "/api/admin/stats"),
  listUsers: (params: { q?: string; role?: string; sort?: string }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.role) qs.set("role", params.role);
    if (params.sort) qs.set("sort", params.sort);
    return call<AdminUserRow[]>("GET", `/api/admin/users?${qs}`);
  },
  userDetail: (id: string) => call<AdminUserDetail>("GET", `/api/admin/users/${id}`),
  patchUser: (id: string, body: Partial<AdminUserRow & { interests: string[]; bio: string }>) =>
    call("PATCH", `/api/admin/users/${id}`, body),
  deleteUser: (id: string) => call("DELETE", `/api/admin/users/${id}`),
  visitors: () => call<VisitorSession[]>("GET", "/api/admin/visitor-sessions"),
  onboardings: () => call<OnboardingSessionRow[]>("GET", "/api/admin/onboarding-sessions"),
  visits: (limit = 30) => call<VisitRow[]>("GET", `/api/admin/visits?limit=${limit}`),
};
