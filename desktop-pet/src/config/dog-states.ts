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
    label: "状态好，在冲！",
    vitality: 5,
    energyThreshold: 70,
  },
  walking: {
    row: 4,
    frames: 8,
    speed: 0,
    label: "稳步推进中",
    vitality: 4,
    energyThreshold: 50,
  },
  a_bit_tired: {
    row: 1,
    frames: 6,
    speed: 0,
    label: "节奏放缓一下",
    vitality: 3,
    energyThreshold: 30,
  },
  resting: {
    row: 2,
    frames: 6,
    speed: 0,
    label: "动力积蓄中...",
    vitality: 2,
    energyThreshold: 15,
  },
  sleeping: {
    row: 8,
    frames: 4,
    speed: 0,
    bubble: "zzz",
    label: "充电中，马上回来",
    vitality: 1,
    energyThreshold: 0,
  },
  asking: {
    row: 0,
    frames: 6,
    speed: 0,
    bubble: "question",
    label: "你的狗想问你...",
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

const VITALITY_STATES: DogStateName[] = [
  "sleeping",
  "sleeping",
  "resting",
  "a_bit_tired",
  "walking",
  "running",
];

function energyToMaxVitality(energy: number): number {
  if (energy >= 70) return 5;
  if (energy >= 50) return 4;
  if (energy >= 30) return 3;
  if (energy >= 15) return 2;
  return 1;
}

export function resolveDogState(
  userMood: number,
  energy: number
): DogStateName {
  const desired = MOOD_TO_STATE[userMood] ?? "walking";
  const desiredVitality = DOG_STATES[desired]?.vitality ?? 3;
  const maxVitality = energyToMaxVitality(energy);
  if (desiredVitality <= maxVitality) return desired;
  return VITALITY_STATES[maxVitality] ?? "sleeping";
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
