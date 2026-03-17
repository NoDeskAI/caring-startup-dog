import { useDogStore } from "../store/dogStore";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";
import { logMood } from "../db";

interface Choice {
  label: string;
  emoji: string;
  userMood: number;
  value: string;
  emotionScore: number;
}

const CHOICES: Choice[] = [
  { label: "动力满满", emoji: "💪", userMood: 5, value: "energetic", emotionScore: 1.0 },
  { label: "有一点累", emoji: "😅", userMood: 2, value: "a_bit_tired", emotionScore: -0.3 },
  { label: "非常疲惫", emoji: "😫", userMood: 1, value: "exhausted", emotionScore: -0.8 },
];

export function AskPanel() {
  const showAskPanel = useDogStore((s) => s.showAskPanel);
  const setShowAskPanel = useDogStore((s) => s.setShowAskPanel);
  const setUserMood = useDogStore((s) => s.setUserMood);
  const energy = useDogStore((s) => s.energy);

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
      const home = await homeDir();
      const responsePath = `${home}.创业狗/user-response.json`;
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
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        top: 10,
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        zIndex: 300,
        width: 170,
        fontFamily: '"Courier New", monospace',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: "bold",
          textAlign: "center",
          marginBottom: 8,
          color: "#333",
        }}
      >
        你的狗累了吗？
      </div>
      {CHOICES.map((c) => (
        <button
          key={c.value}
          onClick={() => handleChoice(c)}
          style={{
            display: "block",
            width: "100%",
            padding: "6px 8px",
            marginBottom: 4,
            border: "2px solid #e0d4c0",
            borderRadius: 8,
            backgroundColor: "#fff8dc",
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "inherit",
            textAlign: "center",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#f0e6c8";
            e.currentTarget.style.transform = "scale(1.03)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#fff8dc";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {c.emoji} {c.label}
        </button>
      ))}
      <button
        onClick={() => setShowAskPanel(false)}
        style={{
          display: "block",
          width: "100%",
          padding: "4px",
          marginTop: 4,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontSize: 10,
          color: "#999",
          fontFamily: "inherit",
        }}
      >
        稍后再说
      </button>
    </div>
  );
}
