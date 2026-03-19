import { useEffect } from "react";
import { useDogStore } from "../store/dogStore";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { logMood, getBasePath } from "../db";

interface Choice {
  label: string;
  userMood: number;
  value: string;
  emotionScore: number;
}

const CHOICES: Choice[] = [
  { label: "精力充沛!", userMood: 5, value: "running", emotionScore: 1.0 },
  { label: "有点累了...", userMood: 3, value: "a_bit_tired", emotionScore: -0.2 },
  { label: "好困...想躺下", userMood: 1, value: "sleeping", emotionScore: -0.6 },
];

export function AskPanel() {
  const showAskPanel = useDogStore((s) => s.showAskPanel);
  const setShowAskPanel = useDogStore((s) => s.setShowAskPanel);
  const setUserMood = useDogStore((s) => s.setUserMood);
  const energy = useDogStore((s) => s.energy);

  useEffect(() => {
    if (!showAskPanel) return;
    const dismiss = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-ask-panel]")) return;
      setShowAskPanel(false);
    };
    const timer = setTimeout(() => {
      window.addEventListener("pointerdown", dismiss);
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", dismiss);
    };
  }, [showAskPanel, setShowAskPanel]);

  if (!showAskPanel) return null;

  async function handleChoice(choice: Choice) {
    setUserMood(choice.userMood);
    setShowAskPanel(false);

    try {
      await logMood({
        source: "ask_response",
        dog_state: choice.value,
        emotion_score: choice.emotionScore,
        emotion_label: choice.label,
        energy,
      });
    } catch (err) {
      console.error("Failed to log mood:", err);
    }

    try {
      const base = await getBasePath();
      const responsePath = await join(base, "user-response.json");
      const data = JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          choice: choice.value,
          processed: false,
        },
        null,
        2
      );
      await writeTextFile(responsePath, data);
    } catch (err) {
      console.error("Failed to write user-response.json:", err);
    }
  }

  return (
    <div
      data-ask-panel
      className="pixel-box"
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 175,
        padding: "10px 12px",
        zIndex: 300,
        width: 160,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 8 }}>
        我现在...
      </div>
      {CHOICES.map((c) => (
        <button
          key={c.value}
          className="pixel-btn"
          onClick={() => handleChoice(c)}
          style={{
            display: "block",
            width: "100%",
            padding: "5px 8px",
            marginBottom: 3,
            fontSize: 11,
            textAlign: "center",
          }}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
