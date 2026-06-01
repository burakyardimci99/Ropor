import { restBase } from "@/lib/origin";

// Empty BASE = same-origin (relative URLs), e.g. when fronted by Caddy.
const BASE = restBase(process.env.NEXT_PUBLIC_BACKEND_URL);

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.detail ?? `İstek başarısız (${res.status})`);
  }
  return data as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`İstek başarısız (${res.status})`);
  return (await res.json()) as T;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail ?? `İstek başarısız (${res.status})`);
  return data as T;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail ?? `İstek başarısız (${res.status})`);
  return data as T;
}

export interface OnboardingStartResp {
  session_id: string;
  expires_at: string;
}

export interface CompleteResp {
  user: { id: string; full_name: string; email: string; role: string };
  welcome_message: string;
}

export interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  visit_count: number;
  badge_count: number;
}

export interface LiveDashboard {
  currently_inside: { id: string; full_name: string; role: string }[];
  recent_activity: { full_name: string; entered_at: string }[];
  generated_at: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  role: string;
  interests: string[];
  bio: string | null;
  avatar_url: string | null;
  leaderboard_opt_in: boolean;
  email_verified: boolean;
  recent_visits: { entered_at: string }[];
  current_reservation: { resource_name: string; starts_at: string; ends_at: string } | null;
  badges: { code: string; name: string; earned_at: string }[];
}

export const api = {
  onboardingStart: (embedding_ref: string) =>
    post<OnboardingStartResp>("/api/onboarding/start", { embedding_ref }),

  onboardingUpdate: (session_id: string, field: string, value: unknown) =>
    post("/api/onboarding/update", { session_id, field, value }),

  onboardingComplete: (body: {
    session_id: string;
    full_name: string;
    email: string;
    role: string;
    interests: string[];
    kvkk_consent: boolean;
  }) => post<CompleteResp>("/api/onboarding/complete", body),

  onboardingCancel: (session_id: string) =>
    post("/api/onboarding/cancel", { session_id }),

  visitorRegister: (body: {
    visitor_name: string;
    purpose?: string;
    embedding_ref?: string;
  }) => post<{ visitor_session_id: string; message: string }>(
    "/api/visitors/register",
    body,
  ),

  leaderboard: () =>
    get<LeaderboardEntry[]>("/api/leaderboard?period=monthly&limit=10"),

  live: () => get<LiveDashboard>("/api/dashboard/live"),

  setVisitIntent: (visit_id: string, intent: string) =>
    post<{ status: string }>(`/api/visits/${visit_id}/intent`, { intent }),

  getProfile: (id: string) => get<UserProfile>(`/api/users/${id}/profile`),

  patchUser: (id: string, body: Partial<{ leaderboard_opt_in: boolean; interests: string[]; bio: string }>) =>
    patch<{ status: string }>(`/api/users/${id}`, body),

  deleteUser: (id: string) => del<{ status: string }>(`/api/users/${id}`),
};
