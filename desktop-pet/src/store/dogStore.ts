import { create } from "zustand";
import { DEFAULT_DOG_COLOR, resolveDogState } from "../config/dog-states";
import type { DogStateName } from "../config/dog-states";

export interface StatusData {
  user?: string;
  last_update: string;
  energy: number;
  dog_state?: DogStateName;
  emotion_score?: number;
  emotion_label?: string;
  msg_count_1h: number;
  prompt_count_1h: number;
  active_hours: number;
  alert_level?: string;
  work_summary?: string;
  stress_signals?: string[];
  message?: string;
  comfort_trigger?: boolean;
}

export interface ComfortMessage {
  timestamp: string;
  comfort_text: string;
  choice: string;
  ttl_seconds: number;
}

interface DogStore {
  energy: number;
  userMood: number;
  dogState: DogStateName;
  statusData: StatusData | null;
  comfortMessage: ComfortMessage | null;
  showAskPanel: boolean;
  showStatusBubble: boolean;
  showMoodSlider: boolean;
  showSkinMenu: boolean;
  showContextMenu: boolean;
  showDailyReport: boolean;
  dogColor: number;

  setEnergy: (energy: number) => void;
  setUserMood: (mood: number) => void;
  setDogState: (state: DogStateName) => void;
  setStatusData: (data: StatusData) => void;
  setComfortMessage: (msg: ComfortMessage | null) => void;
  setShowAskPanel: (show: boolean) => void;
  setShowStatusBubble: (show: boolean) => void;
  setShowMoodSlider: (show: boolean) => void;
  setShowSkinMenu: (show: boolean) => void;
  setShowContextMenu: (show: boolean) => void;
  setShowDailyReport: (show: boolean) => void;
  setDogColor: (color: number) => void;
}

export const useDogStore = create<DogStore>((set, get) => ({
  energy: 100,
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
  dogColor: DEFAULT_DOG_COLOR,

  setEnergy: (energy) => {
    const { userMood } = get();
    set({ energy, dogState: resolveDogState(userMood, energy) });
  },
  setUserMood: (mood) => {
    const { energy } = get();
    set({ userMood: mood, dogState: resolveDogState(mood, energy) });
  },
  setDogState: (state) => set({ dogState: state }),
  setStatusData: (data) => {
    const { userMood } = get();
    const energy = data.energy ?? get().energy;
    set({
      statusData: data,
      energy,
      dogState: resolveDogState(userMood, energy),
    });
  },
  setComfortMessage: (msg) => set({ comfortMessage: msg }),
  setShowAskPanel: (show) => set({ showAskPanel: show }),
  setShowStatusBubble: (show) => set({ showStatusBubble: show }),
  setShowMoodSlider: (show) => set({ showMoodSlider: show }),
  setShowSkinMenu: (show) => set({ showSkinMenu: show }),
  setShowContextMenu: (show) => set({ showContextMenu: show }),
  setShowDailyReport: (show) => set({ showDailyReport: show }),
  setDogColor: (color) => set({ dogColor: color }),
}));
