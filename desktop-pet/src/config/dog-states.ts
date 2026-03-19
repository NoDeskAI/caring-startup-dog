export interface DogStateConfig {
  row: number;
  frames: number;
  speed: number;
  bubble?: string;
  label: string;
  vitality: number;
  energyThreshold: number;
}

export const SPRITE_COLS = 8;
export const FRAME_WIDTH = 64;
export const FRAME_HEIGHT = 48;

export const DOG_STATES: Record<string, DogStateConfig> = {
  running: {
    row: 3,
    frames: 8,
    speed: 0,
    bubble: "heart",
    label: "冲冲冲!",
    vitality: 5,
    energyThreshold: 70,
  },
  walking: {
    row: 4,
    frames: 8,
    speed: 0,
    label: "走走走~",
    vitality: 4,
    energyThreshold: 50,
  },
  a_bit_tired: {
    row: 1,
    frames: 6,
    speed: 0,
    label: "有点累了...",
    vitality: 3,
    energyThreshold: 30,
  },
  resting: {
    row: 2,
    frames: 6,
    speed: 0,
    label: "歇会儿...",
    vitality: 2,
    energyThreshold: 15,
  },
  sleeping: {
    row: 8,
    frames: 4,
    speed: 0,
    bubble: "zzz",
    label: "zzZ...",
    vitality: 1,
    energyThreshold: 0,
  },
  asking: {
    row: 0,
    frames: 6,
    speed: 0,
    bubble: "question",
    label: "...?",
    vitality: 0,
    energyThreshold: 0,
  },
};

export type DogStateName = keyof typeof DOG_STATES;

export const MOOD_TO_STATE: Record<number, DogStateName> = {
  1: "sleeping",
  2: "resting",
  3: "a_bit_tired",
  4: "walking",
  5: "running",
};

export function resolveDogState(userMood: number): DogStateName {
  return MOOD_TO_STATE[userMood] ?? "walking";
}

export const DEFAULT_DOG_COLOR = 5;

export const DOG_SKINS = [
  { id: 0, name: "深灰" },
  { id: 1, name: "棕色" },
  { id: 2, name: "蓝灰" },
  { id: 3, name: "红棕" },
  { id: 4, name: "浅灰" },
  { id: 5, name: "灰白" },
  { id: 6, name: "深棕" },
  { id: 7, name: "银灰" },
  { id: 8, name: "金棕" },
  { id: 9, name: "金黄" },
];
