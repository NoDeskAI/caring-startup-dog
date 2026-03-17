import { useState, useCallback, useEffect } from "react";
import { useDogStore } from "../store/dogStore";
import { logMood } from "../db";
import { MOOD_TO_STATE } from "../config/dog-states";

interface MoodLevel {
  value: number;
  score: number;
  label: string;
  icon: string;
}

const MOOD_LEVELS: MoodLevel[] = [
  { value: 1, score: -1.0, label: "很差", icon: ">_<" },
  { value: 2, score: -0.5, label: "不太好", icon: "T_T" },
  { value: 3, score: 0.0, label: "一般", icon: "-_-" },
  { value: 4, score: 0.5, label: "还行", icon: "^_^" },
  { value: 5, score: 1.0, label: "很好", icon: "^o^" },
];

export function MoodSlider() {
  const showMoodSlider = useDogStore((s) => s.showMoodSlider);
  const setShowMoodSlider = useDogStore((s) => s.setShowMoodSlider);
  const setUserMood = useDogStore((s) => s.setUserMood);
  const energy = useDogStore((s) => s.energy);
  const [sliderValue, setSliderValue] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!showMoodSlider) return;
    const dismiss = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-mood-panel]")) return;
      setShowMoodSlider(false);
    };
    const timer = setTimeout(() => {
      window.addEventListener("pointerdown", dismiss);
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", dismiss);
    };
  }, [showMoodSlider, setShowMoodSlider]);

  const currentMood = MOOD_LEVELS[sliderValue - 1];

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);

    const mood = MOOD_LEVELS[sliderValue - 1];
    setUserMood(sliderValue);

    const resolvedState = MOOD_TO_STATE[sliderValue] ?? "walking";
    try {
      await logMood({
        source: "user_click",
        dog_state: resolvedState,
        emotion_score: mood.score,
        emotion_label: mood.label,
        energy,
      });
    } catch (err) {
      console.error("Failed to log mood:", err);
    }

    setSubmitting(false);
    setShowMoodSlider(false);
  }, [sliderValue, submitting, setUserMood, setShowMoodSlider, energy]);

  if (!showMoodSlider) return null;

  return (
    <div
      data-mood-panel
      className="pixel-box"
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        top: 10,
        padding: "10px 14px 8px",
        zIndex: 300,
        width: 200,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 8 }}>
        心情如何?
      </div>

      <div style={{ fontSize: 18, lineHeight: 1, marginBottom: 2 }}>
        {currentMood.icon}
      </div>
      <div
        style={{
          fontSize: 10,
          color: "var(--pixel-text-light)",
          marginBottom: 8,
        }}
      >
        {currentMood.label}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          marginBottom: 4,
        }}
      >
        {MOOD_LEVELS.map((m) => (
          <button
            key={m.value}
            onClick={() => setSliderValue(m.value)}
            style={{
              width: 28,
              height: 22,
              border:
                sliderValue === m.value
                  ? "2px solid var(--pixel-border)"
                  : "2px solid transparent",
              background:
                sliderValue === m.value
                  ? "var(--pixel-accent)"
                  : "var(--pixel-bg-dark)",
              color:
                sliderValue === m.value ? "#fff" : "var(--pixel-text-light)",
              fontFamily: "var(--pixel-font)",
              fontSize: 9,
              cursor: "pointer",
              padding: 0,
              fontWeight: sliderValue === m.value ? "bold" : "normal",
            }}
          >
            {m.value}
          </button>
        ))}
      </div>

      <button
        className="pixel-btn"
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          width: "100%",
          marginTop: 6,
          padding: "5px 0",
          fontSize: 11,
          opacity: submitting ? 0.5 : 1,
          cursor: submitting ? "not-allowed" : "pointer",
        }}
      >
        {submitting ? "..." : "记录"}
      </button>
    </div>
  );
}
