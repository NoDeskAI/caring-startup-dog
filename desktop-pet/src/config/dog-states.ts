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
  energetic: {
    row: 7,
    frames: 6,
    speed: 0,
    bubble: "heart",
    label: "动力满满！",
    vitality: 5,
    energyThreshold: 70,
  },
  running: {
    row: 3,
    frames: 8,
    speed: 0,
    label: "状态好，在冲！",
    vitality: 4,
    energyThreshold: 50,
  },
  walking: {
    row: 4,
    frames: 8,
    speed: 0,
    label: "有点累了…",
    vitality: 3,
    energyThreshold: 30,
  },
  a_bit_tired: {
    row: 1,
    frames: 6,
    speed: 0,
    label: "有一点累",
    vitality: 2,
    energyThreshold: 15,
  },
  exhausted: {
    row: 2,
    frames: 6,
    speed: 0,
    bubble: "zzz",
    label: "非常疲惫",
    vitality: 1,
    energyThreshold: 0,
  },
  tired: {
    row: 8,
    frames: 4,
    speed: 0,
    bubble: "zzz",
    label: "该休息了！",
    vitality: 1,
    energyThreshold: 0,
  },
  asking: {
    row: 0,
    frames: 6,
    speed: 0,
    bubble: "question",
    label: "你的狗想问你…",
    vitality: 0,
    energyThreshold: 0,
  },
};

export type DogStateName = keyof typeof DOG_STATES;

export const MOOD_TO_STATE: Record<number, DogStateName> = {
  1: "exhausted",
  2: "a_bit_tired",
  3: "walking",
  4: "running",
  5: "energetic",
};

const VITALITY_STATES: DogStateName[] = [
  "exhausted",
  "exhausted",
  "a_bit_tired",
  "walking",
  "running",
  "energetic",
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
  return VITALITY_STATES[maxVitality] ?? "exhausted";
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
