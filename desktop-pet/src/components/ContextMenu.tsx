import { useEffect, useState } from "react";
import { useDogStore } from "../store/dogStore";
import { DOG_SKINS } from "../config/dog-states";
import { analyzeRecentWork } from "../services/localAnalysis";

type SubMenu = "none" | "skins";

export function ContextMenu() {
  const visible = useDogStore((s) => s.showContextMenu);
  const setVisible = useDogStore((s) => s.setShowContextMenu);
  const setComfortMessage = useDogStore((s) => s.setComfortMessage);
  const setShowDailyReport = useDogStore((s) => s.setShowDailyReport);
  const dogColor = useDogStore((s) => s.dogColor);
  const setDogColor = useDogStore((s) => s.setDogColor);

  const [sub, setSub] = useState<SubMenu>("none");
  const [petting, setPetting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSub("none");
      return;
    }
    const dismiss = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-ctx-menu]")) return;
      setVisible(false);
    };
    const timer = setTimeout(() => {
      window.addEventListener("pointerdown", dismiss);
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", dismiss);
    };
  }, [visible, setVisible]);

  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    window.addEventListener("contextmenu", prevent);
    return () => window.removeEventListener("contextmenu", prevent);
  }, []);

  if (!visible) return null;

  async function handlePetHead() {
    setPetting(true);
    try {
      const msg = await analyzeRecentWork();
      setComfortMessage(msg);
    } catch (err) {
      console.error("Failed to analyze:", err);
      setComfortMessage({
        timestamp: new Date().toISOString(),
        comfort_text: "汪！摸摸头好舒服~",
        choice: "pet_head",
        ttl_seconds: 10,
      });
    }
    setPetting(false);
    setVisible(false);
  }

  function handleDailyReport() {
    setVisible(false);
    setShowDailyReport(true);
  }

  if (sub === "skins") {
    return (
      <div
        data-ctx-menu
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
          onClick={() => setSub("none")}
          style={{
            padding: "4px 10px 6px",
            fontWeight: "bold",
            fontSize: 10,
            borderBottom: "2px solid var(--pixel-border)",
            marginBottom: 2,
            color: "var(--pixel-text-light)",
            cursor: "pointer",
          }}
        >
          {"<"} 返回
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
                dogColor === skin.id ? "var(--pixel-accent)" : "transparent",
              color: dogColor === skin.id ? "#fff" : "var(--pixel-text)",
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

  return (
    <div
      data-ctx-menu
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
      <MenuItem label="摸摸头" onClick={handlePetHead} disabled={petting} />
      <MenuItem label="今日报告" onClick={handleDailyReport} />
      <div
        style={{
          height: 2,
          backgroundColor: "var(--pixel-border)",
          margin: "3px 0",
          opacity: 0.4,
        }}
      />
      <MenuItem label="换皮肤 >" onClick={() => setSub("skins")} />
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        padding: "5px 10px",
        cursor: disabled ? "wait" : "pointer",
        color: disabled ? "var(--pixel-text-light)" : "var(--pixel-text)",
        fontFamily: "var(--pixel-font)",
        fontSize: 11,
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          e.currentTarget.style.backgroundColor = "var(--pixel-bg-dark)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {label}
    </div>
  );
}
