"use client";

import { CameraStatus as Status } from "@/hooks/useCamera";

interface Props {
  status: Status;
  onRetry: () => void;
}

export function CameraIndicator({ status }: Props) {
  const ok = status.permission === "granted" && status.wsConnected;
  return (
    <div
      className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs ${
        ok ? "bg-emerald-700/60" : "bg-red-700/70"
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-white" />
      {ok ? `kamera · ${status.framesSent}f` : "kamera yok"}
    </div>
  );
}

export function CameraBlocker({ status, onRetry }: Props) {
  if (status.permission === "granted" || status.permission === "pending") return null;

  const title =
    status.permission === "denied"
      ? "Kamera erişimi reddedildi"
      : status.permission === "insecure"
        ? "Kamera için HTTPS gerekli"
        : "Kamera kullanılamıyor";

  const hint =
    status.permission === "denied"
      ? "Tarayıcının kilit/kamera simgesinden izin verin ve yeniden deneyin."
      : status.permission === "insecure"
        ? "Site http üzerinden açıldı. HTTPS ile sunun veya chrome://flags 'unsafely-treat-insecure-origin-as-secure' ile bu adresi güvenli kabul edin."
        : "Bağlı bir kamera bulunamadı.";

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
      <div className="max-w-2xl rounded-2xl bg-zinc-900 p-10 text-center">
        <div className="text-5xl">📷</div>
        <h2 className="mt-4 text-3xl font-bold">{title}</h2>
        <p className="mt-3 text-lg text-white/60">{hint}</p>
        {status.error && (
          <p className="mt-2 font-mono text-sm text-red-300/70">{status.error}</p>
        )}
        <button
          onClick={onRetry}
          className="mt-6 rounded-xl bg-cyan-600 px-6 py-3 text-lg font-semibold transition hover:bg-cyan-500"
        >
          Tekrar dene
        </button>
      </div>
    </div>
  );
}
