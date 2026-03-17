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
      className="pixel-box"
      style={{
        position: "absolute",
        right: 10,
        bottom: 60,
        padding: "6px 0",
        zIndex: 500,
        minWidth: 120,
        fontSize: 11,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          padding: "4px 10px 6px",
          fontWeight: "bold",
          fontSize: 10,
          borderBottom: "2px solid var(--pixel-border)",
          marginBottom: 2,
          color: "var(--pixel-text-light)",
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
            padding: "4px 10px",
            cursor: "pointer",
            backgroundColor:
              dogColor === skin.id
                ? "var(--pixel-accent)"
                : "transparent",
            color:
              dogColor === skin.id ? "#fff" : "var(--pixel-text)",
            fontWeight: dogColor === skin.id ? "bold" : "normal",
            fontFamily: "var(--pixel-font)",
            fontSize: 10,
          }}
          onMouseEnter={(e) => {
            if (dogColor !== skin.id)
              e.currentTarget.style.backgroundColor = "var(--pixel-bg-dark)";
          }}
          onMouseLeave={(e) => {
            if (dogColor !== skin.id)
              e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          {dogColor === skin.id ? "> " : "  "}
          {String(skin.id).padStart(2, "0")} {skin.name}
        </div>
      ))}
    </div>
  );
}
