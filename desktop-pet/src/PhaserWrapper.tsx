import { useEffect, useRef, useCallback } from "react";
import Phaser from "phaser";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { currentMonitor } from "@tauri-apps/api/window";
import { DogScene } from "./scenes/DogScene";
import { useDogStore } from "./store/dogStore";
import { addCoin, getTotalCoins } from "./db";
import { triggerPetHead } from "./services/localAnalysis";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { getBasePath } from "./db";

const CANVAS_W = 400;
const CANVAS_H = 450;

const HIT_AREA = { x: 100, y: 260, w: 200, h: 160 };
const DEAD_ZONE = 4;
const POLL_INTERVAL = 80;

function isInHitArea(x: number, y: number): boolean {
  return (
    x >= HIT_AREA.x &&
    x <= HIT_AREA.x + HIT_AREA.w &&
    y >= HIT_AREA.y &&
    y <= HIT_AREA.y + HIT_AREA.h
  );
}

interface DragState {
  startScreenX: number;
  startScreenY: number;
  startWinX: number;
  startWinY: number;
  dragging: boolean;
}

export function PhaserWrapper() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<DogScene | null>(null);

  const dogState = useDogStore((s) => s.dogState);
  const dogColor = useDogStore((s) => s.dogColor);
  const setShowStatusBubble = useDogStore((s) => s.setShowStatusBubble);
  const setShowMoodSlider = useDogStore((s) => s.setShowMoodSlider);
  const setShowContextMenu = useDogStore((s) => s.setShowContextMenu);
  const setIsHovering = useDogStore((s) => s.setIsHovering);
  const coinReady = useDogStore((s) => s.coinReady);
  const setCoinReady = useDogStore((s) => s.setCoinReady);
  const setComfortMessage = useDogStore((s) => s.setComfortMessage);
  const setTotalCoins = useDogStore((s) => s.setTotalCoins);
  const coinDroppedRef = useRef(false);

  const showMoodSlider = useDogStore((s) => s.showMoodSlider);
  const showAskPanel = useDogStore((s) => s.showAskPanel);
  const showContextMenu = useDogStore((s) => s.showContextMenu);
  const showDailyReport = useDogStore((s) => s.showDailyReport);
  const comfortMessage = useDogStore((s) => s.comfortMessage);
  const showStatusBubble = useDogStore((s) => s.showStatusBubble);

  const anyPopupOpen =
    showMoodSlider ||
    showAskPanel ||
    showContextMenu ||
    showDailyReport ||
    !!comfortMessage ||
    showStatusBubble;

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inHitRef = useRef(false);
  const passthroughRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const anyPopupRef = useRef(anyPopupOpen);
  anyPopupRef.current = anyPopupOpen;
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyPassthrough = useCallback(async (val: boolean) => {
    if (passthroughRef.current === val) return;
    passthroughRef.current = val;
    try {
      await invoke("set_mouse_passthrough", { passthrough: val });
    } catch {
      /* Rust command not ready yet */
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      try {
        const pos = await invoke<[number, number] | null>(
          "get_cursor_pos_in_window"
        );
        if (!pos) return;
        const [x, y] = pos;
        if (isInHitArea(x, y)) {
          inHitRef.current = true;
          useDogStore.getState().setIsHovering(true);
          gameRef.current?.events.emit("set-hover", true);
          applyPassthrough(false);
          stopPolling();
          hoverTimerRef.current = setTimeout(() => {
            setShowStatusBubble(true);
          }, 400);
        }
      } catch {
        /* ignore */
      }
    }, POLL_INTERVAL);
  }, [applyPassthrough, stopPolling, setShowStatusBubble]);

  const setPassthrough = useCallback(
    async (val: boolean) => {
      await applyPassthrough(val);
      if (val) {
        startPolling();
      } else {
        stopPolling();
      }
    },
    [applyPassthrough, startPolling, stopPolling]
  );

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const scene = new DogScene();
    sceneRef.current = scene;

    const game = new Phaser.Game({
      type: Phaser.WEBGL,
      width: CANVAS_W,
      height: CANVAS_H,
      parent: containerRef.current,
      transparent: true,
      scene,
      render: { pixelArt: true },
      input: { mouse: { preventDefaultWheel: false }, touch: false },
    });

    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current?.dragging) return;

      const hit = isInHitArea(e.clientX, e.clientY);

      if (hit !== inHitRef.current) {
        inHitRef.current = hit;
        setIsHovering(hit);
        gameRef.current?.events.emit("set-hover", hit);

        if (hit) {
          hoverTimerRef.current = setTimeout(() => {
            setShowStatusBubble(true);
          }, 400);
        } else {
          if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
          }
          setShowStatusBubble(false);
        }
      }

      if (hit || anyPopupRef.current) {
        setPassthrough(false);
      } else {
        setPassthrough(true);
      }
    };

    const onLeave = () => {
      if (dragRef.current?.dragging) return;
      inHitRef.current = false;
      setIsHovering(false);
      gameRef.current?.events.emit("set-hover", false);
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      setShowStatusBubble(false);
      if (!anyPopupRef.current) {
        setPassthrough(true);
      }
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [setPassthrough, setShowStatusBubble, setIsHovering]);

  useEffect(() => {
    if (anyPopupOpen) {
      setPassthrough(false);
    } else if (!inHitRef.current && !dragRef.current?.dragging) {
      setPassthrough(true);
    }
  }, [anyPopupOpen, setPassthrough]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const onPointerDown = useCallback(
    async (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button === 2) return;
      e.preventDefault();
      e.stopPropagation();

      try {
        const win = getCurrentWindow();
        const pos = await win.outerPosition();
        const mon = await currentMonitor();
        const scale = mon?.scaleFactor ?? 1;

        dragRef.current = {
          startScreenX: e.screenX,
          startScreenY: e.screenY,
          startWinX: pos.x / scale,
          startWinY: pos.y / scale,
          dragging: false,
        };

        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* window API not ready */
      }
    },
    []
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;

      const dx = e.screenX - dragRef.current.startScreenX;
      const dy = e.screenY - dragRef.current.startScreenY;

      if (!dragRef.current.dragging) {
        if (Math.abs(dx) < DEAD_ZONE && Math.abs(dy) < DEAD_ZONE) return;
        dragRef.current.dragging = true;
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
        setShowStatusBubble(false);
        setIsHovering(false);
        gameRef.current?.events.emit("set-hover", false);
      }

      invoke("move_window", {
        x: dragRef.current.startWinX + dx,
        y: dragRef.current.startWinY + dy,
      });
    },
    [setShowStatusBubble, setIsHovering]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      const wasDragging = dragRef.current.dragging;
      dragRef.current = null;

      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      if (!wasDragging) {
        setShowMoodSlider(true);
      }
    },
    [setShowMoodSlider]
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setShowContextMenu(true);
    },
    [setShowContextMenu]
  );

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.playAnimation(dogState);
  }, [dogState]);

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.switchDogColor(dogColor);
  }, [dogColor]);

  useEffect(() => {
    if (coinReady && sceneRef.current && !coinDroppedRef.current) {
      coinDroppedRef.current = true;
      sceneRef.current.dropCoin();
    }
  }, [coinReady]);

  const handleCoinClick = useCallback(async () => {
    if (!sceneRef.current) return;
    const collected = sceneRef.current.collectCoin();
    if (!collected) return;

    coinDroppedRef.current = false;
    setCoinReady(false);

    try {
      const base = await getBasePath();
      const statusPath = await join(base, "status.json");
      const raw = await readTextFile(statusPath);
      const data = JSON.parse(raw);
      data.coin_ready = false;
      await writeTextFile(statusPath, JSON.stringify(data, null, 2));
    } catch { /* ignore */ }

    try {
      await addCoin("hourly");
      const total = await getTotalCoins();
      setTotalCoins(total);
    } catch (err) {
      console.error("[coin] failed to save:", err);
    }

    setComfortMessage({
      timestamp: "_thinking_",
      comfort_text: "叼了个亮晶晶的东西回来...",
      choice: "coin",
      ttl_seconds: 60,
    });

    try {
      const msg = await triggerPetHead();
      if (msg) {
        setComfortMessage(msg);
      } else {
        setComfortMessage({
          timestamp: new Date().toISOString(),
          comfort_text: "给你带了个好东西！",
          choice: "coin",
          ttl_seconds: 10,
        });
      }
    } catch {
      setComfortMessage({
        timestamp: new Date().toISOString(),
        comfort_text: "嘿嘿，闪闪发光的！",
        choice: "coin",
        ttl_seconds: 10,
      });
    }
  }, [setCoinReady, setComfortMessage, setTotalCoins]);

  return (
    <>
      <div
        ref={containerRef}
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
        }}
      />
      <div
        id="hit-area"
        style={{
          position: "absolute",
          left: HIT_AREA.x,
          top: HIT_AREA.y,
          width: HIT_AREA.w,
          height: HIT_AREA.h,
          cursor: "pointer",
          zIndex: 10,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={onContextMenu}
      />
      {coinReady && (
        <div
          id="coin-area"
          onClick={handleCoinClick}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            left: 224,
            top: 334,
            width: 72,
            height: 72,
            cursor: "pointer",
            zIndex: 15,
          }}
        />
      )}
    </>
  );
}
