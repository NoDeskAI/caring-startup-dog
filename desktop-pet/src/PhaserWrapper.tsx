import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DogScene } from "./scenes/DogScene";
import { useDogStore } from "./store/dogStore";

const CANVAS_W = 400;
const CANVAS_H = 450;

export function PhaserWrapper() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<DogScene | null>(null);

  const dogState = useDogStore((s) => s.dogState);
  const dogColor = useDogStore((s) => s.dogColor);
  const setShowStatusBubble = useDogStore((s) => s.setShowStatusBubble);
  const setShowMoodSlider = useDogStore((s) => s.setShowMoodSlider);
  const setShowSkinMenu = useDogStore((s) => s.setShowSkinMenu);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const scene = new DogScene();
    sceneRef.current = scene;

    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      width: CANVAS_W,
      height: CANVAS_H,
      parent: containerRef.current,
      transparent: true,
      scene,
      render: { pixelArt: true },
    });

    game.events.on("dog-hover-start", () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        setShowStatusBubble(true);
      }, 300);
    });

    game.events.on("dog-hover-end", () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      setShowStatusBubble(false);
    });

    game.events.on("dog-clicked", () => {
      setShowMoodSlider(true);
    });

    game.events.on("dog-rightclick", () => {
      setShowSkinMenu(true);
    });

    game.events.on("start-window-drag", () => {
      getCurrentWindow().startDragging().catch(() => {});
    });

    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, [setShowStatusBubble, setShowMoodSlider, setShowSkinMenu]);

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.playAnimation(dogState);
  }, [dogState]);

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.switchDogColor(dogColor);
  }, [dogColor]);

  return (
    <div
      ref={containerRef}
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        position: "absolute",
        top: 0,
        left: 0,
      }}
    />
  );
}
