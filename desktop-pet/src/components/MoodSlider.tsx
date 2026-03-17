import { useState, useCallback } from "react";
import { useDogStore } from "../store/dogStore";
import { logMood } from "../db";
import type { DogStateName } from "../config/dog-states";

interface MoodLevel {
  value: number;
  score: number;
  label: string;
  emoji: string;
  dogState: DogStateName;
}

const MOOD_LEVELS: MoodLevel[] = [
  { value: 1, score: -1.0, label: "非常差", emoji: "😫", dogState: "exhausted" },
  { value: 2, score: -0.5, label: "不太好", emoji: "😔", dogState: "a_bit_tired" },
  { value: 3, score: 0.0, label: "一般", emoji: "😐", dogState: "walking" },
  { value: 4, score: 0.5, label: "还不错", emoji: "😊", dogState: "running" },
  { value: 5, score: 1.0, label: "很好", emoji: "😄", dogState: "energetic" },
];

export function MoodSlider() {
  const showMoodSlider = useDogStore((s) => s.showMoodSlider);
  const setShowMoodSlider = useDogStore((s) => s.setShowMoodSlider);
  const setDogState = useDogStore((s) => s.setDogState);
  const [sliderValue, setSliderValue] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  const currentMood = MOOD_LEVELS[sliderValue - 1];

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);

    const mood = MOOD_LEVELS[sliderValue - 1];
    setDogState(mood.dogState);

    try {
      await logMood({
        source: "user_click",
        dog_state: mood.dogState,
        emotion_score: mood.score,
        emotion_label: mood.label,
      });
    } catch (err) {
      console.error("Failed to log mood:", err);
    }

    setSubmitting(false);
    setShowMoodSlider(false);
  }, [sliderValue, submitting, setDogState, setShowMoodSlider]);

  if (!showMoodSlider) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        top: 10,
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderRadius: 14,
        padding: "14px 18px 10px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
        zIndex: 300,
        width: 260,
        fontFamily: '"Courier New", monospace',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: "bold",
          textAlign: "center",
          marginBottom: 10,
          color: "#333",
        }}
      >
        现在心情怎么样？
      </div>

      <div
        style={{
          textAlign: "center",
          fontSize: 32,
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {currentMood.emoji}
      </div>
      <div
        style={{
          textAlign: "center",
          fontSize: 12,
          color: "#666",
          marginBottom: 10,
        }}
      >
        {currentMood.label}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 16 }}>😫</span>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={sliderValue}
          onChange={(e) => setSliderValue(Number(e.target.value))}
          style={{
            flex: 1,
            height: 6,
            accentColor: "#e8a040",
            cursor: "pointer",
          }}
        />
        <span style={{ fontSize: 16 }}>😄</span>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "0 22px",
          marginTop: 2,
          marginBottom: 10,
        }}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            style={{
              fontSize: 9,
              color: sliderValue === n ? "#e8a040" : "#bbb",
              fontWeight: sliderValue === n ? "bold" : "normal",
              width: 8,
              textAlign: "center",
            }}
          >
            {n}
          </span>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          display: "block",
          width: "100%",
          padding: "7px 0",
          border: "2px solid #e0d4c0",
          borderRadius: 8,
          backgroundColor: "#fff8dc",
          cursor: submitting ? "not-allowed" : "pointer",
          fontSize: 12,
          fontFamily: "inherit",
          fontWeight: "bold",
          color: "#8b6914",
          transition: "all 0.15s",
          opacity: submitting ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!submitting) e.currentTarget.style.backgroundColor = "#f0e6c8";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#fff8dc";
        }}
      >
        记录
      </button>

      <button
        onClick={() => setShowMoodSlider(false)}
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
        取消
      </button>
    </div>
  );
}
