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
  private assetsLoaded = false;

  constructor() {
    super("DogScene");
  }

  create() {
    this.loadAssets();
  }

  private loadAssets() {
    let needsLoad = false;

    const currentKey = this.getSpriteKey();
    if (!this.textures.exists(currentKey)) {
      this.load.spritesheet(
        currentKey,
        `sprites/${String(this.dogColor).padStart(2, "0")}.png`,
        { frameWidth: FRAME_WIDTH, frameHeight: FRAME_HEIGHT }
      );
      needsLoad = true;
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

    this.createAnimationsForColor(this.dogColor);

    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height - 80;

    this.dog = this.add
      .sprite(cx, cy, this.getSpriteKey(), 0)
      .setScale(3);

    this.playAnimation(this.currentState);

    this.game.events.on("set-hover", (hover: boolean) => {
      if (!this.dog) return;
      if (hover) {
        this.dog.setTint(0xddeeff);
      } else {
        this.dog.clearTint();
      }
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

    const key = this.getSpriteKey();
    if (!this.textures.exists(key)) {
      this.load.spritesheet(
        key,
        `sprites/${String(color).padStart(2, "0")}.png`,
        { frameWidth: FRAME_WIDTH, frameHeight: FRAME_HEIGHT }
      );
      this.load.once("complete", () => {
        this.createAnimationsForColor(color);
        this.playAnimation(this.currentState);
      });
      this.load.start();
    } else {
      this.createAnimationsForColor(color);
      this.playAnimation(this.currentState);
    }
  }

  private updateBubble(_state: DogStateName) {
    if (this.bubble) {
      this.bubble.destroy();
      this.bubble = undefined;
    }
  }
}
