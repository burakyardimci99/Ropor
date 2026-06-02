"use client";

import { RefObject, useState } from "react";

import { CameraStatus, DetectedFace } from "@/hooks/useCamera";

const PREVIEW_W = 320;
const PREVIEW_H = 240; // 4:3, matching the 640x480 capture

interface Props {
  videoRef: RefObject<HTMLVideoElement>;
  face: DetectedFace | null;
  status: CameraStatus;
}

/**
 * Small live camera tile (bottom-left). Mirrors the selfie feed and overlays a
 * square on the detected face, labelled with the recognized name — or
 * "Bilinmiyor" when the face isn't matched to anyone. Can be closed to a small
 * pill and reopened.
 *
 * The <video> is always mounted in the same spot in the tree, even when the
 * tile is "closed" (the wrapper just collapses off-screen). useCamera assigns
 * the MediaStream to this node once on mount, so we must never swap it for a
 * different element — otherwise reopening would attach the ref to a fresh
 * <video> with no stream and the preview would stay blank.
 */
export function CameraPreview({ videoRef, face, status }: Props) {
  const granted = status.permission === "granted";
  const [open, setOpen] = useState(false);

  // Scale the backend's frame-pixel box onto the preview, mirrored to match the
  // flipped (selfie) video.
  let overlay: { left: number; top: number; width: number; height: number } | null = null;
  if (open && granted && face) {
    const { x, y, w, h, frame_w, frame_h } = face.box;
    const sx = PREVIEW_W / frame_w;
    const sy = PREVIEW_H / frame_h;
    overlay = {
      left: PREVIEW_W - (x + w) * sx, // mirror horizontally
      top: y * sy,
      width: w * sx,
      height: h * sy,
    };
  }

  const recognized = Boolean(face?.name);
  const boxColor = recognized ? "#34D399" : "#FBBF24";

  return (
    <>
      <div
        className={
          open
            ? "absolute bottom-24 left-5 z-40 overflow-hidden rounded-2xl border border-white/15 bg-black/60 shadow-2xl backdrop-blur"
            : "pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
        }
        style={open ? { width: PREVIEW_W, height: PREVIEW_H } : undefined}
      >
        {/* Always the same element — never conditionally swapped (see note above). */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />

        {open && (
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Kamera önizlemesini kapat"
              className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-base leading-none text-white/80 backdrop-blur transition hover:bg-black/80 hover:text-white"
            >
              ×
            </button>

            {!granted && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
                Kamera bekleniyor…
              </div>
            )}

            {overlay && (
              <>
                <div
                  className="absolute rounded-md transition-all duration-150"
                  style={{
                    left: overlay.left,
                    top: overlay.top,
                    width: overlay.width,
                    height: overlay.height,
                    border: `2px solid ${boxColor}`,
                    boxShadow: `0 0 16px -2px ${boxColor}`,
                  }}
                />
                <div
                  className="absolute -translate-x-1/2 rounded px-2 py-0.5 text-xs font-semibold text-black"
                  style={{
                    left: overlay.left + overlay.width / 2,
                    top: Math.max(2, overlay.top - 20),
                    background: boxColor,
                    maxWidth: PREVIEW_W - 8,
                  }}
                >
                  {face?.name ?? "Bilinmiyor"}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute bottom-24 left-5 z-40 flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-sm text-white/80 shadow-2xl backdrop-blur transition hover:bg-black/80"
        >
          📷 Kamerayı göster
        </button>
      )}
    </>
  );
}
