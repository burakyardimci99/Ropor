"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

import { api } from "@/lib/api";
import {
  KioskState,
  LOCKED_SCREENS,
  ONBOARDING_STEPS,
  OnboardingData,
  initialState,
  reducer,
} from "@/lib/kioskMachine";

const WS_URL =
  process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:8000/ws/kiosk";

const GREETING_DWELL_MS = 7000;
const WELCOME_DWELL_MS = 9000;
const UNKNOWN_TIMEOUT_MS = 15000;
const FORM_IDLE_MS = 120000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useKiosk() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Refs mirror state so async/WS callbacks read fresh values.
  const stateRef = useRef<KioskState>(state);
  stateRef.current = state;
  const screenRef = useRef(state.screen);
  screenRef.current = state.screen;
  const onbRef = useRef<OnboardingData>(state.onboarding);
  onbRef.current = state.onboarding;
  const embeddingRefRef = useRef<string | null>(state.embeddingRef);
  embeddingRefRef.current = state.embeddingRef;

  const greetingTimer = useRef<ReturnType<typeof setTimeout>>();
  const unknownTimer = useRef<ReturnType<typeof setTimeout>>();
  const idleTimer = useRef<ReturnType<typeof setTimeout>>();

  const clearTimers = useCallback(() => {
    clearTimeout(greetingTimer.current);
    clearTimeout(unknownTimer.current);
    clearTimeout(idleTimer.current);
  }, []);

  const goAmbient = useCallback(() => {
    clearTimers();
    const onb = onbRef.current;
    if (onb.sessionId && screenRef.current === "ONBOARDING_FORM") {
      api.onboardingCancel(onb.sessionId).catch(() => {});
    }
    dispatch({ type: "GO_AMBIENT" });
  }, [clearTimers]);

  const armIdle = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(goAmbient, FORM_IDLE_MS);
  }, [goAmbient]);

  const startVisitor = useCallback(() => {
    clearTimers();
    dispatch({ type: "BEGIN_VISITOR" });
    armIdle();
  }, [clearTimers, armIdle]);

  const startOnboarding = useCallback(async () => {
    const ref = embeddingRefRef.current;
    if (!ref) return;
    clearTimers();
    dispatch({ type: "SET_BUSY", value: true });
    try {
      const { session_id } = await api.onboardingStart(ref);
      dispatch({ type: "BEGIN_ONBOARDING", sessionId: session_id });
      armIdle();
    } catch (e) {
      dispatch({ type: "SET_ERROR", message: (e as Error).message });
    } finally {
      dispatch({ type: "SET_BUSY", value: false });
    }
  }, [clearTimers, armIdle]);

  const completeOnboarding = useCallback(async () => {
    const onb = onbRef.current;
    if (!onb.sessionId) return;
    dispatch({ type: "SET_BUSY", value: true });
    try {
      const res = await api.onboardingComplete({
        session_id: onb.sessionId,
        full_name: onb.full_name,
        email: onb.email,
        role: onb.role,
        interests: onb.interests,
        kvkk_consent: onb.kvkk,
      });
      clearTimers();
      dispatch({
        type: "SHOW_GREETING",
        payload: { message: res.welcome_message, welcome: true },
      });
      greetingTimer.current = setTimeout(goAmbient, WELCOME_DWELL_MS);
    } catch (e) {
      dispatch({ type: "SET_ERROR", message: (e as Error).message });
    }
  }, [clearTimers, goAmbient]);

  const submitVisitor = useCallback(async () => {
    const name = stateRef.current.visitor.visitor_name.trim();
    if (!name) {
      dispatch({ type: "SET_ERROR", message: "Lütfen adınızı girin." });
      return;
    }
    dispatch({ type: "SET_BUSY", value: true });
    try {
      const res = await api.visitorRegister({
        visitor_name: name,
        purpose: stateRef.current.visitor.purpose || undefined,
        embedding_ref: embeddingRefRef.current ?? undefined,
      });
      clearTimers();
      dispatch({
        type: "SHOW_GREETING",
        payload: { message: res.message, welcome: true },
      });
      greetingTimer.current = setTimeout(goAmbient, WELCOME_DWELL_MS);
    } catch (e) {
      dispatch({ type: "SET_ERROR", message: (e as Error).message });
    }
  }, [clearTimers, goAmbient]);

  const openProfile = useCallback(() => {
    const userId = stateRef.current.greeting.user?.id;
    if (!userId) return;
    clearTimers();
    dispatch({ type: "OPEN_PROFILE", userId });
    armIdle();
  }, [clearTimers, armIdle]);

  const onbSet = useCallback(
    (field: keyof OnboardingData, value: unknown) => {
      dispatch({ type: "ONB_SET", field, value });
      armIdle();
    },
    [armIdle],
  );

  const visSet = useCallback(
    (field: "visitor_name" | "purpose", value: string) => {
      dispatch({ type: "VIS_SET", field, value });
      armIdle();
    },
    [armIdle],
  );

  const onbBack = useCallback(() => {
    if (onbRef.current.step === 0) {
      goAmbient();
      return;
    }
    dispatch({ type: "ONB_STEP", delta: -1 });
    armIdle();
  }, [goAmbient, armIdle]);

  const onbNext = useCallback(async () => {
    const onb = onbRef.current;
    const stepName = ONBOARDING_STEPS[onb.step];

    if (stepName === "name" && onb.full_name.trim().length < 2) {
      dispatch({ type: "SET_ERROR", message: "Lütfen ad soyad girin." });
      return;
    }
    if (stepName === "email" && !EMAIL_RE.test(onb.email)) {
      dispatch({ type: "SET_ERROR", message: "Geçerli bir email girin." });
      return;
    }
    if (stepName === "kvkk") {
      if (!onb.kvkk) {
        dispatch({ type: "SET_ERROR", message: "Devam etmek için KVKK onayı gerekli." });
        return;
      }
      await completeOnboarding();
      return;
    }

    if (onb.sessionId) {
      const field = stepName === "name" ? "full_name" : stepName;
      const value =
        stepName === "interests"
          ? onb.interests
          : stepName === "name"
            ? onb.full_name
            : stepName === "email"
              ? onb.email
              : onb.role;
      api.onboardingUpdate(onb.sessionId, field, value).catch(() => {});
    }
    dispatch({ type: "ONB_STEP", delta: 1 });
    armIdle();
  }, [completeOnboarding, armIdle]);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;
    let ws: WebSocket;

    const handleBackend = (incoming: string, payload: Record<string, unknown>) => {
      const cur = screenRef.current;
      if (LOCKED_SCREENS.includes(cur)) return;

      if (incoming === "GREETING") {
        clearTimeout(greetingTimer.current);
        dispatch({ type: "SHOW_GREETING", payload });
        greetingTimer.current = setTimeout(goAmbient, GREETING_DWELL_MS);
      } else if (incoming === "UNKNOWN_PROMPT") {
        if (cur === "UNKNOWN_PROMPT") return;
        const ref = (payload.embedding_ref as string) ?? "";
        dispatch({ type: "SHOW_UNKNOWN", embeddingRef: ref });
        clearTimeout(unknownTimer.current);
        unknownTimer.current = setTimeout(startVisitor, UNKNOWN_TIMEOUT_MS);
      }
    };

    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => dispatch({ type: "SET_CONNECTED", value: true });
      ws.onclose = () => {
        dispatch({ type: "SET_CONNECTED", value: false });
        if (!closed) retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "state_change" && msg.state) {
            handleBackend(msg.state, msg.payload ?? {});
          }
        } catch {
          /* ignore */
        }
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      clearTimers();
      ws?.close();
    };
  }, [goAmbient, startVisitor, clearTimers]);

  return {
    state,
    actions: {
      startOnboarding,
      startVisitor,
      goAmbient,
      onbNext,
      onbBack,
      onbSet,
      visSet,
      submitVisitor,
      openProfile,
      keepAlive: armIdle,
    },
  };
}
