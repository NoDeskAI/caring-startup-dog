import { create } from "zustand";
import { DEFAULT_DOG_COLOR, resolveDogState } from "../config/dog-states";
import type { DogStateName } from "../config/dog-states";

export interface StatusData {
  user?: string;
  last_update: string;
  dog_state?: DogStateName;
  emotion_score?: number;
  emotion_label?: string;
  msg_count_1h: number;
  prompt_count_1h: number;
  active_hours: number;
  alert_level?: string;
  work_summary?: string;
  hover_text?: string;
  daily_narrative?: string;
  stress_signals?: string[];
  message?: string;
}

export interface ComfortMessage {
  timestamp: string;
  comfort_text: string;
  choice: string;
  ttl_seconds: number;
}

export type ConnStatus = "ok" | "stale" | "off";

export interface ConnState {
  openclaw: ConnStatus;
  feishu: ConnStatus;
  lastCheck: number;
}

interface DogStore {
  userMood: number;
  dogState: DogStateName;
  statusData: StatusData | null;
  comfortMessage: ComfortMessage | null;
  connState: ConnState;
  showAskPanel: boolean;
  showStatusBubble: boolean;
  showMoodSlider: boolean;
  showSkinMenu: boolean;
  showContextMenu: boolean;
  showDailyReport: boolean;
  dogColor: number;

  setUserMood: (mood: number) => void;
  setDogState: (state: DogStateName) => void;
  setStatusData: (data: StatusData) => void;
  setComfortMessage: (msg: ComfortMessage | null) => void;
  setConnState: (state: ConnState) => void;
  setShowAskPanel: (show: boolean) => void;
  setShowStatusBubble: (show: boolean) => void;
  setShowMoodSlider: (show: boolean) => void;
  setShowSkinMenu: (show: boolean) => void;
  setShowContextMenu: (show: boolean) => void;
  setShowDailyReport: (show: boolean) => void;
  setDogColor: (color: number) => void;
}

export const useDogStore = create<DogStore>((set, get) => ({
  userMood: 3,
  dogState: "walking",
  statusData: null,
  comfortMessage: null,
  showAskPanel: false,
  showStatusBubble: false,
  showMoodSlider: false,
  showSkinMenu: false,
  showContextMenu: false,
  showDailyReport: false,
  connState: { openclaw: "off", feishu: "off", lastCheck: 0 },
  dogColor: DEFAULT_DOG_COLOR,

  setUserMood: (mood) => {
    set({ userMood: mood, dogState: resolveDogState(mood) });
  },
  setDogState: (state) => set({ dogState: state }),
  setStatusData: (data) => {
    set({ statusData: data });
  },
  setComfortMessage: (msg) => {
    if (msg) {
      set({ comfortMessage: msg, showStatusBubble: false });
    } else {
      set({ comfortMessage: msg });
    }
  },
  setShowAskPanel: (show) => {
    if (show) set({ showAskPanel: true, showStatusBubble: false, showMoodSlider: false, showDailyReport: false, showContextMenu: false });
    else set({ showAskPanel: false });
  },
  setShowStatusBubble: (show) => {
    const { comfortMessage, showMoodSlider, showDailyReport, showAskPanel } = get();
    if (show && (comfortMessage || showMoodSlider || showDailyReport || showAskPanel)) return;
    set({ showStatusBubble: show });
  },
  setShowMoodSlider: (show) => {
    if (show) set({ showMoodSlider: true, showStatusBubble: false, showAskPanel: false, showDailyReport: false, showContextMenu: false });
    else set({ showMoodSlider: false });
  },
  setShowSkinMenu: (show) => set({ showSkinMenu: show }),
  setShowContextMenu: (show) => {
    if (show) set({ showContextMenu: true, showMoodSlider: false, showAskPanel: false });
    else set({ showContextMenu: false });
  },
  setShowDailyReport: (show) => {
    if (show) set({ showDailyReport: true, showStatusBubble: false, showAskPanel: false, showMoodSlider: false, showContextMenu: false });
    else set({ showDailyReport: false });
  },
  setConnState: (state) => set({ connState: state }),
  setDogColor: (color) => set({ dogColor: color }),
}));
