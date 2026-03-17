import { create } from "zustand";
import { DEFAULT_DOG_COLOR } from "../config/dog-states";
import type { DogStateName } from "../config/dog-states";

export interface StatusData {
  user: string;
  last_update: string;
  dog_state: DogStateName;
  emotion_score: number;
  emotion_label: string;
  msg_count_1h: number;
  prompt_count_1h: number;
  active_hours: number;
  alert_level: string;
  work_summary: string;
  stress_signals: string[];
  message: string;
}

export interface ComfortMessage {
  timestamp: string;
  comfort_text: string;
  choice: string;
  ttl_seconds: number;
}

interface DogStore {
  dogState: DogStateName;
  statusData: StatusData | null;
  comfortMessage: ComfortMessage | null;
  showAskPanel: boolean;
  showStatusBubble: boolean;
  showMoodSlider: boolean;
  showSkinMenu: boolean;
  dogColor: number;

  setDogState: (state: DogStateName) => void;
  setStatusData: (data: StatusData) => void;
  setComfortMessage: (msg: ComfortMessage | null) => void;
  setShowAskPanel: (show: boolean) => void;
  setShowStatusBubble: (show: boolean) => void;
  setShowMoodSlider: (show: boolean) => void;
  setShowSkinMenu: (show: boolean) => void;
  setDogColor: (color: number) => void;
}

export const useDogStore = create<DogStore>((set) => ({
  dogState: "running",
  statusData: null,
  comfortMessage: null,
  showAskPanel: false,
  showStatusBubble: false,
  showMoodSlider: false,
  showSkinMenu: false,
  dogColor: DEFAULT_DOG_COLOR,

  setDogState: (state) => set({ dogState: state }),
  setStatusData: (data) => set({ statusData: data, dogState: data.dog_state }),
  setComfortMessage: (msg) => set({ comfortMessage: msg }),
  setShowAskPanel: (show) => set({ showAskPanel: show }),
  setShowStatusBubble: (show) => set({ showStatusBubble: show }),
  setShowMoodSlider: (show) => set({ showMoodSlider: show }),
  setShowSkinMenu: (show) => set({ showSkinMenu: show }),
  setDogColor: (color) => set({ dogColor: color }),
}));
