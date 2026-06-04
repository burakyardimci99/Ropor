"use client";

import { RefObject, useEffect, useState } from "react";

import { CameraStatus, DetectedFace } from "@/hooks/useCamera";
import { useKeyCombo } from "@/hooks/useKeyCombo";

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
 * "Bilinmiyor" when the face isn't matched to anyone.
 *
 * Hidden feature: there is no visible control. Pressing "a" and "d" together
 * toggles the tile open/closed (so operators can peek at the feed without
 * cluttering the kiosk UI). The on-screen × close button still works too.
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

  // Hidden toggle: pressing "a" + "d" simultaneously opens/closes the tile.
  useKeyCombo(["a", "d"], () => setOpen((v) => !v));

  // The <video> lives in a 1px, opacity-0 wrapper while closed; the browser can
  // pause it (or never start it after srcObject is set off-screen). When the
  // tile is opened we have a real, visible element, so kick playback again —
  // otherwise the feed shows up black.
  useEffect(() => {
    if (open && granted) {
      videoRef.current?.play().catch(() => {});
    }
  }, [open, granted, videoRef]);

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
    </>
  );
}
