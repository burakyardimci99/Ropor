"use client";

import { useEffect, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

type Status = "loading" | "ok" | "error";

export default function VerifyPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [name, setName] = useState<string>("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      return;
    }
    fetch(`${BASE}/api/verify?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const d = await r.json();
        setName(d.full_name ?? "");
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <main className="flex h-screen w-screen flex-col items-center justify-center text-center">
      {status === "loading" && <p className="text-2xl text-white/60">Doğrulanıyor…</p>}
      {status === "ok" && (
        <>
          <div className="text-6xl">✓</div>
          <h1 className="mt-6 text-4xl font-bold">Email doğrulandı</h1>
          {name && <p className="mt-3 text-xl text-white/60">Teşekkürler, {name}!</p>}
        </>
      )}
      {status === "error" && (
        <>
          <div className="text-6xl">⚠️</div>
          <h1 className="mt-6 text-4xl font-bold">Doğrulama başarısız</h1>
          <p className="mt-3 text-xl text-white/60">
            Link geçersiz veya süresi dolmuş olabilir.
          </p>
        </>
      )}
    </main>
  );
}
