export type Screen =
  | "AMBIENT"
  | "GREETING"
  | "UNKNOWN_PROMPT"
  | "ONBOARDING_FORM"
  | "VISITOR_MODE"
  | "PROFILE"
  | "INTENT_PROMPT";

export interface GreetingPayload {
  message?: string;
  visit_count?: number;
  badge_count?: number;
  confidence?: number;
  current_reservation?: { resource_name: string } | null;
  user?: { id?: string; full_name?: string; role?: string; interests?: string[] };
  welcome?: boolean;
  /** Set only on the visit that the kiosk should optionally tag with intent. */
  visit_id?: string;
}

export type Role = "researcher" | "student" | "staff" | "guest";

export interface OnboardingData {
  sessionId: string | null;
  step: number; // 0..4
  full_name: string;
  email: string;
  role: Role;
  interests: string[];
  kvkk: boolean;
}

export interface VisitorData {
  visitor_name: string;
  purpose: string;
}

export interface IntentData {
  visitId: string | null;
  userName: string | null;
  text: string;
  saved: boolean;
}

export interface KioskState {
  screen: Screen;
  connected: boolean;
  greeting: GreetingPayload;
  embeddingRef: string | null;
  profileUserId: string | null;
  onboarding: OnboardingData;
  visitor: VisitorData;
  intent: IntentData;
  error: string | null;
  busy: boolean;
}

export const ONBOARDING_STEPS = ["name", "email", "role", "interests", "kvkk"] as const;

export const ROLE_LABELS: Record<Role, string> = {
  researcher: "Araştırmacı",
  student: "Öğrenci",
  staff: "Personel",
  guest: "Misafir",
};

export const initialOnboarding: OnboardingData = {
  sessionId: null,
  step: 0,
  full_name: "",
  email: "",
  role: "student",
  interests: [],
  kvkk: false,
};

const initialIntent: IntentData = {
  visitId: null,
  userName: null,
  text: "",
  saved: false,
};

export const initialState: KioskState = {
  screen: "AMBIENT",
  connected: false,
  greeting: {},
  embeddingRef: null,
  profileUserId: null,
  onboarding: initialOnboarding,
  visitor: { visitor_name: "", purpose: "" },
  intent: initialIntent,
  error: null,
  busy: false,
};

export type Action =
  | { type: "SET_CONNECTED"; value: boolean }
  | { type: "SHOW_GREETING"; payload: GreetingPayload }
  | { type: "SHOW_UNKNOWN"; embeddingRef: string }
  | { type: "GO_AMBIENT" }
  | { type: "BEGIN_ONBOARDING"; sessionId: string }
  | { type: "ONB_SET"; field: keyof OnboardingData; value: unknown }
  | { type: "ONB_STEP"; delta: number }
  | { type: "BEGIN_VISITOR" }
  | { type: "VIS_SET"; field: keyof VisitorData; value: string }
  | { type: "OPEN_PROFILE"; userId: string }
  | { type: "OPEN_INTENT"; visitId: string; userName: string | null }
  | { type: "INTENT_SET_TEXT"; value: string }
  | { type: "INTENT_SAVED" }
  | { type: "SET_ERROR"; message: string | null }
  | { type: "SET_BUSY"; value: boolean };

export function reducer(state: KioskState, action: Action): KioskState {
  switch (action.type) {
    case "SET_CONNECTED":
      return { ...state, connected: action.value };

    case "SHOW_GREETING":
      return { ...state, screen: "GREETING", greeting: action.payload, error: null };

    case "SHOW_UNKNOWN":
      return {
        ...state,
        screen: "UNKNOWN_PROMPT",
        embeddingRef: action.embeddingRef,
        error: null,
      };

    case "GO_AMBIENT":
      return {
        ...state,
        screen: "AMBIENT",
        greeting: {},
        embeddingRef: null,
        profileUserId: null,
        onboarding: initialOnboarding,
        visitor: { visitor_name: "", purpose: "" },
        intent: initialIntent,
        error: null,
        busy: false,
      };

    case "OPEN_PROFILE":
      return {
        ...state,
        screen: "PROFILE",
        profileUserId: action.userId,
        error: null,
      };

    case "OPEN_INTENT":
      return {
        ...state,
        screen: "INTENT_PROMPT",
        intent: {
          visitId: action.visitId,
          userName: action.userName,
          text: "",
          saved: false,
        },
        error: null,
      };

    case "INTENT_SET_TEXT":
      return { ...state, intent: { ...state.intent, text: action.value } };

    case "INTENT_SAVED":
      return { ...state, intent: { ...state.intent, saved: true } };

    case "BEGIN_ONBOARDING":
      return {
        ...state,
        screen: "ONBOARDING_FORM",
        onboarding: { ...initialOnboarding, sessionId: action.sessionId },
        error: null,
      };

    case "ONB_SET":
      return {
        ...state,
        onboarding: { ...state.onboarding, [action.field]: action.value },
      };

    case "ONB_STEP": {
      const step = Math.max(
        0,
        Math.min(ONBOARDING_STEPS.length - 1, state.onboarding.step + action.delta),
      );
      return { ...state, onboarding: { ...state.onboarding, step }, error: null };
    }

    case "BEGIN_VISITOR":
      return {
        ...state,
        screen: "VISITOR_MODE",
        visitor: { visitor_name: "", purpose: "" },
        error: null,
      };

    case "VIS_SET":
      return {
        ...state,
        visitor: { ...state.visitor, [action.field]: action.value },
      };

    case "SET_ERROR":
      return { ...state, error: action.message, busy: false };

    case "SET_BUSY":
      return { ...state, busy: action.value };

    default:
      return state;
  }
}

export const LOCKED_SCREENS: Screen[] = [
  "ONBOARDING_FORM",
  "VISITOR_MODE",
  "PROFILE",
  "INTENT_PROMPT",
];
