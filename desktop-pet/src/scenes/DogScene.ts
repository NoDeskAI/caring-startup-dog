import Phaser from "phaser";
import {
  DOG_STATES,
  SPRITE_COLS,
  FRAME_WIDTH,
  FRAME_HEIGHT,
  DEFAULT_DOG_COLOR,
} from "../config/dog-states";
import type { DogStateName } from "../config/dog-states";

export class DogScene extends Phaser.Scene {
  private dog!: Phaser.GameObjects.Sprite;
  private bubble?: Phaser.GameObjects.Sprite;
  private currentState: DogStateName = "running";
  private dogColor: number = DEFAULT_DOG_COLOR;
  private flipDirection = false;
  private assetsLoaded = false;
  private pointerDownTime = 0;
  private dragTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super("DogScene");
  }

  create() {
    this.loadAssets();
  }

  private loadAssets() {
    let needsLoad = false;

    for (let i = 0; i <= 9; i++) {
      const key = `dog_${String(i).padStart(2, "0")}`;
      if (!this.textures.exists(key)) {
        this.load.spritesheet(
          key,
          `sprites/${String(i).padStart(2, "0")}.png`,
          { frameWidth: FRAME_WIDTH, frameHeight: FRAME_HEIGHT }
        );
        needsLoad = true;
      }
    }

    if (!this.textures.exists("emote_bored")) {
      this.load.image("emote_bored", "emotes/Emotes/mid/boredEmote.png");
      this.load.image(
        "emote_very_happy",
        "emotes/Emotes/mid/veryHappyEmote.png"
      );
      this.load.image("emote_neutral", "emotes/Emotes/mid/neutralEmote.png");
      this.load.image(
        "emote_question",
        "emotes/Emotes/misc/question mark.png"
      );
      needsLoad = true;
    }

    if (needsLoad) {
      this.load.once("complete", () => this.onAssetsLoaded());
      this.load.start();
    } else {
      this.onAssetsLoaded();
    }
  }

  private onAssetsLoaded() {
    this.assetsLoaded = true;
    this.children.removeAll();

    for (let i = 0; i <= 9; i++) {
      this.createAnimationsForColor(i);
    }

    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height - 80;

    this.dog = this.add
      .sprite(cx, cy, this.getSpriteKey(), 0)
      .setScale(3)
      .setInteractive();

    this.playAnimation(this.currentState);

    this.dog.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.game.events.emit("dog-rightclick");
        return;
      }
      this.pointerDownTime = Date.now();
      this.dragTimer = setTimeout(() => {
        if (this.pointerDownTime > 0) {
          this.pointerDownTime = 0;
          this.game.events.emit("start-window-drag");
        }
      }, 180);
    });

    this.input.on("pointerup", () => {
      if (this.pointerDownTime > 0) {
        if (this.dragTimer) clearTimeout(this.dragTimer);
        this.dragTimer = null;
        this.pointerDownTime = 0;
        this.game.events.emit("dog-clicked");
      }
    });

    this.time.addEvent({
      delay: 8000,
      callback: () => {
        this.flipDirection = !this.flipDirection;
        if (this.dog) this.dog.setFlipX(this.flipDirection);
      },
      loop: true,
    });
  }

  private getSpriteKey(): string {
    return `dog_${String(this.dogColor).padStart(2, "0")}`;
  }

  private createAnimationsForColor(color: number) {
    const spriteKey = `dog_${String(color).padStart(2, "0")}`;

    for (const [stateName, config] of Object.entries(DOG_STATES)) {
      const animKey = `${spriteKey}_${stateName}`;
      if (this.anims.exists(animKey)) continue;

      const startFrame = config.row * SPRITE_COLS;
      const frames = this.anims.generateFrameNumbers(spriteKey, {
        start: startFrame,
        end: startFrame + config.frames - 1,
      });

      this.anims.create({
        key: animKey,
        frames,
        frameRate: 6,
        repeat: -1,
      });
    }
  }

  playAnimation(state: DogStateName) {
    this.currentState = state;
    if (!this.assetsLoaded || !this.dog) return;

    const animKey = `${this.getSpriteKey()}_${state}`;
    if (this.anims.exists(animKey)) {
      this.dog.play(animKey);
    }
    this.updateBubble(state);
  }

  switchDogColor(color: number) {
    if (color === this.dogColor) return;
    this.dogColor = color;
    if (!this.assetsLoaded || !this.dog) return;
    this.playAnimation(this.currentState);
  }

  private updateBubble(state: DogStateName) {
    if (this.bubble) {
      this.bubble.destroy();
      this.bubble = undefined;
    }

    const config = DOG_STATES[state];
    if (!config?.bubble) return;

    let emoteKey: string;
    switch (config.bubble) {
      case "zzz":
        emoteKey = "emote_bored";
        break;
      case "heart":
        emoteKey = "emote_very_happy";
        break;
      case "question":
        emoteKey = "emote_question";
        break;
      default:
        emoteKey = "emote_neutral";
    }

    if (!this.textures.exists(emoteKey)) return;

    this.bubble = this.add.sprite(
      this.dog.x + 30,
      this.dog.y - 55,
      emoteKey
    );
    this.bubble.setScale(1.5);

    this.tweens.add({
      targets: this.bubble,
      y: this.bubble.y - 4,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }
}
