import { useEffect } from "react";
import { useDogStore } from "../store/dogStore";
import { DOG_SKINS } from "../config/dog-states";

export function SkinMenu() {
  const visible = useDogStore((s) => s.showSkinMenu);
  const setVisible = useDogStore((s) => s.setShowSkinMenu);
  const dogColor = useDogStore((s) => s.dogColor);
  const setDogColor = useDogStore((s) => s.setDogColor);

  useEffect(() => {
    if (!visible) return;
    const close = () => setVisible(false);
    const timer = setTimeout(() => {
      window.addEventListener("pointerdown", close, { once: true });
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", close);
    };
  }, [visible, setVisible]);

  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    window.addEventListener("contextmenu", prevent);
    return () => window.removeEventListener("contextmenu", prevent);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        right: 10,
        bottom: 60,
        backgroundColor: "rgba(255,255,255,0.95)",
        borderRadius: 10,
        padding: "6px 0",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        zIndex: 500,
        minWidth: 130,
        fontFamily: '"Courier New", monospace',
        fontSize: 12,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          padding: "4px 12px 6px",
          fontWeight: "bold",
          color: "#666",
          fontSize: 11,
          borderBottom: "1px solid #eee",
          marginBottom: 2,
        }}
      >
        选择皮肤
      </div>
      {DOG_SKINS.map((skin) => (
        <div
          key={skin.id}
          onClick={() => {
            setDogColor(skin.id);
            setVisible(false);
          }}
          style={{
            padding: "5px 12px",
            cursor: "pointer",
            backgroundColor:
              dogColor === skin.id ? "#e8f0fe" : "transparent",
            color: dogColor === skin.id ? "#1a73e8" : "#333",
            fontWeight: dogColor === skin.id ? "bold" : "normal",
            transition: "background 0.1s",
          }}
          onMouseEnter={(e) => {
            if (dogColor !== skin.id)
              e.currentTarget.style.backgroundColor = "#f5f5f5";
          }}
          onMouseLeave={(e) => {
            if (dogColor !== skin.id)
              e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          {dogColor === skin.id ? "● " : "○ "}
          {String(skin.id).padStart(2, "0")} {skin.name}
        </div>
      ))}
    </div>
  );
}
