"use client";

import { AnimatePresence, motion } from "framer-motion";

import { AmbientScreen } from "@/components/AmbientScreen";
import { CameraBlocker, CameraIndicator } from "@/components/CameraStatus";
import { GreetingScreen } from "@/components/GreetingScreen";
import { OnboardingForm } from "@/components/OnboardingForm";
import { ProfileScreen } from "@/components/ProfileScreen";
import { UnknownPrompt } from "@/components/UnknownPrompt";
import { VisitorMode } from "@/components/VisitorMode";
import { useCamera } from "@/hooks/useCamera";
import { useKiosk } from "@/hooks/useKiosk";
import { Screen } from "@/lib/kioskMachine";

const BG: Record<Screen, string> = {
  AMBIENT: "#0a0a0f",
  GREETING: "#06281f",
  UNKNOWN_PROMPT: "#2a1206",
  ONBOARDING_FORM: "#06222a",
  VISITOR_MODE: "#1a0a2a",
  PROFILE: "#0a1830",
};

export default function Home() {
  const { state, actions } = useKiosk();
  const { status: camera, retry: retryCamera } = useCamera();

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <motion.div
        className="absolute inset-0"
        animate={{ backgroundColor: BG[state.screen] }}
        transition={{ duration: 0.8 }}
      />

      {/* KVKK transparency indicator (always visible) */}
      <div className="absolute left-5 top-5 z-20 text-xs text-white/40">
        🔴 Yüz tanıma aktif · detay için QR
      </div>
      <div className="absolute right-5 top-5 z-20 flex items-center gap-2">
        <CameraIndicator status={camera} onRetry={retryCamera} />
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs ${
            state.connected ? "bg-emerald-600/80" : "bg-red-700/80"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-white" />
          {state.connected ? "bağlı" : "bağlantı yok"}
        </div>
      </div>

      <div className="relative z-10 h-full w-full">
        <AnimatePresence mode="wait">
          {state.screen === "AMBIENT" && <AmbientScreen key="ambient" />}
          {state.screen === "GREETING" && (
            <GreetingScreen
              key="greeting"
              greeting={state.greeting}
              onProfile={actions.openProfile}
            />
          )}
          {state.screen === "UNKNOWN_PROMPT" && (
            <UnknownPrompt
              key="unknown"
              onRegister={actions.startOnboarding}
              onVisitor={actions.startVisitor}
              onCancel={actions.goAmbient}
              busy={state.busy}
              error={state.error}
            />
          )}
          {state.screen === "ONBOARDING_FORM" && (
            <OnboardingForm
              key="onboarding"
              state={state}
              onSet={actions.onbSet}
              onNext={actions.onbNext}
              onBack={actions.onbBack}
            />
          )}
          {state.screen === "VISITOR_MODE" && (
            <VisitorMode
              key="visitor"
              state={state}
              onSet={actions.visSet}
              onSubmit={actions.submitVisitor}
              onCancel={actions.goAmbient}
            />
          )}
          {state.screen === "PROFILE" && state.profileUserId && (
            <ProfileScreen
              key="profile"
              userId={state.profileUserId}
              onBack={actions.goAmbient}
              onActivity={actions.keepAlive}
            />
          )}
        </AnimatePresence>
      </div>

      <CameraBlocker status={camera} onRetry={retryCamera} />
    </main>
  );
}
