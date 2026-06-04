"use client";

import { useEffect, useRef } from "react";

/**
 * Fires `onTrigger` once when all the given keys are held simultaneously, then
 * re-arms only after every combo key has been released (so holding the keys
 * down doesn't spam the callback). Used for hidden operator shortcuts that have
 * no visible control on the kiosk — e.g. "a"+"d" to reveal the camera tile or
 * "a"+"l" to toggle detection.
 */
export function useKeyCombo(keys: string[], onTrigger: () => void) {
  // Keep the latest callback without re-binding the listeners every render.
  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;

  // Stable, order-independent identity for the key set.
  const comboKey = keys.map((k) => k.toLowerCase()).sort().join("+");

  useEffect(() => {
    const wanted = new Set(comboKey.split("+"));
    const down = new Set<string>();
    let armed = true;

    const allDown = () => {
      for (const k of wanted) if (!down.has(k)) return false;
      return true;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!wanted.has(k)) return;
      down.add(k);
      if (armed && allDown()) {
        armed = false;
        onTriggerRef.current();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!wanted.has(k)) return;
      down.delete(k);
      if (down.size === 0) armed = true;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [comboKey]);
}
