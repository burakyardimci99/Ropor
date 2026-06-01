"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { wsUrlFor } from "@/lib/origin";

const INTERVAL_MS = 500;
const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 480;
const JPEG_QUALITY = 0.7;

export type CameraPermission =
  | "pending"
  | "granted"
  | "denied"
  | "unavailable"
  | "insecure";

export interface CameraStatus {
  permission: CameraPermission;
  framesSent: number;
  wsConnected: boolean;
  error: string | null;
}

/**
 * Captures camera frames in the browser and streams them as JPEG WebSocket
 * binary messages to the backend. The hook runs for the lifetime of the page.
 */
export function useCamera() {
  const [status, setStatus] = useState<CameraStatus>({
    permission: "pending",
    framesSent: 0,
    wsConnected: false,
    error: null,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sentCountRef = useRef(0);

  const request = useCallback(async () => {
    setStatus((s) => ({ ...s, permission: "pending", error: null }));

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus((s) => ({ ...s, permission: "unavailable" }));
      return;
    }
    // getUserMedia requires a secure context (HTTPS) outside of localhost.
    if (!window.isSecureContext) {
      setStatus((s) => ({
        ...s,
        permission: "insecure",
        error:
          "Kamera erişimi için güvenli bir kaynak (HTTPS veya localhost) gerekli.",
      }));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: FRAME_WIDTH, height: FRAME_HEIGHT, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current) {
        videoRef.current = document.createElement("video");
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
        canvasRef.current.width = FRAME_WIDTH;
        canvasRef.current.height = FRAME_HEIGHT;
      }
      setStatus((s) => ({ ...s, permission: "granted", error: null }));
    } catch (e) {
      const err = e as Error;
      setStatus((s) => ({
        ...s,
        permission: err.name === "NotAllowedError" ? "denied" : "unavailable",
        error: err.message,
      }));
    }
  }, []);

  // Request on mount.
  useEffect(() => {
    request();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      wsRef.current?.close();
    };
  }, [request]);

  // Once we have a stream, open WS and start sending frames.
  useEffect(() => {
    if (status.permission !== "granted") return;

    let closed = false;
    let retry: ReturnType<typeof setTimeout>;
    let interval: ReturnType<typeof setInterval>;

    const captureAndSend = async () => {
      const ws = wsRef.current;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !video || !canvas) return;
      // Throttle: drop frames if the socket buffer is backing up.
      if (ws.bufferedAmount > 200_000) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
      );
      if (!blob) return;
      const buf = await blob.arrayBuffer();
      ws.send(buf);
      sentCountRef.current += 1;
      // Update counter ~ once per second to avoid render spam.
      if (sentCountRef.current % 2 === 0) {
        setStatus((s) => ({ ...s, framesSent: sentCountRef.current }));
      }
    };

    const connect = () => {
      const url = wsUrlFor(
        "/ws/frames",
        process.env.NEXT_PUBLIC_BACKEND_FRAMES_WS_URL,
      );
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      ws.onopen = () => {
        setStatus((s) => ({ ...s, wsConnected: true }));
        interval = setInterval(captureAndSend, INTERVAL_MS);
      };
      ws.onclose = () => {
        setStatus((s) => ({ ...s, wsConnected: false }));
        clearInterval(interval);
        if (!closed) retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      clearInterval(interval);
      wsRef.current?.close();
    };
  }, [status.permission]);

  return { status, retry: request };
}










































