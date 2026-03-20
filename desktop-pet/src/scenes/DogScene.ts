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
  private coin?: Phaser.GameObjects.Image;
  private coinVisible = false;
  private currentState: DogStateName = "running";
  private dogColor: number = DEFAULT_DOG_COLOR;
  private assetsLoaded = false;
  private loadRetries = 0;
  private readonly MAX_RETRIES = 3;

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

    if (!this.textures.exists("coin")) {
      this.load.image("coin", "sprites/coin.png");
      needsLoad = true;
    }

    if (needsLoad) {
      this.load.once("complete", () => this.onAssetsLoaded());
      this.load.on("loaderror", (file: { key: string }) => {
        console.error("[DogScene] failed to load:", file.key);
        if (this.loadRetries < this.MAX_RETRIES) {
          this.loadRetries++;
          console.log(`[DogScene] retry ${this.loadRetries}/${this.MAX_RETRIES}...`);
          this.time.delayedCall(500 * this.loadRetries, () => {
            this.load.removeAllListeners();
            this.loadAssets();
          });
        }
      });
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
    const groundY = this.cameras.main.height - 80;

    this.dog = this.add
      .sprite(cx, groundY, this.getSpriteKey(), 0)
      .setOrigin(0.5, 1.0)
      .setScale(3);

    this.playAnimation(this.currentState);

    this.game.events.on("set-hover", (hover: boolean) => {
      if (!this.dog) return;
      if (hover) {
        this.dog.setAlpha(0.75);
      } else {
        this.dog.setAlpha(1);
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

  dropCoin() {
    if (!this.assetsLoaded || this.coinVisible) return;
    this.coinVisible = true;

    const cx = this.cameras.main.width / 2 + 60;
    const targetY = this.cameras.main.height - 80;

    const img = this.add.image(cx, -20, "coin");
    img.setScale(0.035);
    this.coin = img;

    this.tweens.add({
      targets: img,
      y: targetY,
      duration: 600,
      ease: "Bounce.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: img,
          scaleX: { from: 0.035, to: 0.038 },
          scaleY: { from: 0.035, to: 0.032 },
          yoyo: true,
          repeat: -1,
          duration: 500,
          ease: "Sine.easeInOut",
        });
      },
    });

    this.game.events.emit("coin-landed");
  }

  collectCoin(): boolean {
    if (!this.coinVisible || !this.coin) return false;
    this.coinVisible = false;

    this.tweens.killTweensOf(this.coin);

    this.tweens.add({
      targets: this.coin,
      y: this.coin.y - 40,
      alpha: 0,
      scaleX: 0.02,
      scaleY: 0.02,
      duration: 300,
      ease: "Power2",
      onComplete: () => {
        this.coin?.destroy();
        this.coin = undefined;
      },
    });
    return true;
  }
}
