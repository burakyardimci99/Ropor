"use client";

import { AnimatePresence } from "framer-motion";
import { useState } from "react";

import { AmbientScreen } from "@/components/AmbientScreen";
import { CameraBlocker } from "@/components/CameraStatus";
import { CameraPreview } from "@/components/CameraPreview";
import { GreetingScreen } from "@/components/GreetingScreen";
import { OnboardingForm } from "@/components/OnboardingForm";
import { ProfileScreen } from "@/components/ProfileScreen";
import { ScanningScreen } from "@/components/ScanningScreen";
import { UnknownPrompt } from "@/components/UnknownPrompt";
import { VisitorMode } from "@/components/VisitorMode";
import { PinDialog } from "@/components/kiosk/PinDialog";
import { KioskStage, StageState } from "@/components/kiosk/visuals";
import { useCamera } from "@/hooks/useCamera";
import { useKeyCombo } from "@/hooks/useKeyCombo";
import { useKiosk } from "@/hooks/useKiosk";
import { Screen } from "@/lib/kioskMachine";

// Per-screen ambient glow for the stage backdrop. The screens themselves are
// sized for the fixed 1920x1080 canvas; KioskStage scales that canvas to fill
// any display, so the layout always fits fullscreen without overflow.
const GLOW: Record<Screen, StageState> = {
  AMBIENT: "idle",
  SCANNING: "scanning",
  GREETING: "welcome",
  UNKNOWN_PROMPT: "fail",
  ONBOARDING_FORM: "idle",
  VISITOR_MODE: "idle",
  PROFILE: "idle",
  INTENT_PROMPT: "idle",
};

export default function Home() {
  const [detectionActive, setDetectionActive] = useState(true);
  const [pinOpen, setPinOpen] = useState(false);
  const { state, actions } = useKiosk(detectionActive);
  const { status: camera, retry: retryCamera, videoRef, face } = useCamera();

  // Hidden operator shortcut: "a" + "l" toggles detection — but still gated by
  // the PIN dialog, so it only opens the prompt rather than flipping directly.
  useKeyCombo(["a", "l"], () => setPinOpen(true));

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <KioskStage
        glow={GLOW[state.screen]}
        chrome={{
          backendConnected: state.connected,
          detectionActive,
        }}
      >
        <AnimatePresence mode="wait">
          {state.screen === "AMBIENT" && <AmbientScreen key="ambient" />}
          {state.screen === "SCANNING" && <ScanningScreen key="scanning" />}
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
      </KioskStage>

      {/* Live self-view with the face box, lifted above the bottom status row. */}
      <CameraPreview videoRef={videoRef} face={face} status={camera} />

      <CameraBlocker status={camera} onRetry={retryCamera} />

      {pinOpen && (
        <PinDialog
          title={detectionActive ? "Algılamayı Duraklat" : "Algılamayı Başlat"}
          onSuccess={() => {
            setDetectionActive((v) => !v);
            setPinOpen(false);
          }}
          onClose={() => setPinOpen(false)}
        />
      )}
    </main>
  );
}
