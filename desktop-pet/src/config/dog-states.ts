export interface DogStateConfig {
  row: number;
  frames: number;
  speed: number;
  bubble?: string;
  label: string;
}

export const SPRITE_COLS = 8;
export const FRAME_WIDTH = 64;
export const FRAME_HEIGHT = 48;

export const DOG_STATES: Record<string, DogStateConfig> = {
  running: {
    row: 3,
    frames: 8,
    speed: 0,
    label: "状态好，在冲！",
  },
  walking: {
    row: 4,
    frames: 8,
    speed: 0,
    label: "有点累了…",
  },
  tired: {
    row: 8,
    frames: 4,
    speed: 0,
    bubble: "zzz",
    label: "该休息了！",
  },
  energetic: {
    row: 7,
    frames: 6,
    speed: 0,
    bubble: "heart",
    label: "动力满满！",
  },
  a_bit_tired: {
    row: 1,
    frames: 6,
    speed: 0,
    label: "有一点累",
  },
  exhausted: {
    row: 2,
    frames: 6,
    speed: 0,
    bubble: "zzz",
    label: "非常疲惫",
  },
  asking: {
    row: 0,
    frames: 6,
    speed: 0,
    bubble: "question",
    label: "你的狗想问你…",
  },
};

export type DogStateName = keyof typeof DOG_STATES;

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
