import { useEffect, useState, useRef } from "react";
import { useDogStore } from "../store/dogStore";
import { DOG_SKINS } from "../config/dog-states";
import { triggerPetHead, getRandomFunText, ensureCron } from "../services/localAnalysis";
import { unlockSkin, getUnlockedSkins, getTotalCoins } from "../db";

type SubMenu = "none" | "skins";

export function ContextMenu() {
  const visible = useDogStore((s) => s.showContextMenu);
  const setVisible = useDogStore((s) => s.setShowContextMenu);
  const setComfortMessage = useDogStore((s) => s.setComfortMessage);
  const setShowDailyReport = useDogStore((s) => s.setShowDailyReport);
  const dogColor = useDogStore((s) => s.dogColor);
  const setDogColor = useDogStore((s) => s.setDogColor);
  const totalCoins = useDogStore((s) => s.totalCoins);
  const unlockedSkins = useDogStore((s) => s.unlockedSkins);
  const setUnlockedSkins = useDogStore((s) => s.setUnlockedSkins);
  const setTotalCoins = useDogStore((s) => s.setTotalCoins);

  const [sub, setSub] = useState<SubMenu>("none");
  const [petting, setPetting] = useState(false);
  const [asking, setAsking] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const previewColorRef = useRef<number | null>(null);
  const savedColorRef = useRef<number>(dogColor);
  const COINS_PER_SKIN = 5;

  useEffect(() => {
    if (!visible) {
      if (previewColorRef.current !== null) {
        setDogColor(savedColorRef.current);
        previewColorRef.current = null;
      }
      setSub("none");
      return;
    }
    savedColorRef.current = dogColor;
  }, [visible, setVisible, setDogColor]);

  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    window.addEventListener("contextmenu", prevent);
    return () => window.removeEventListener("contextmenu", prevent);
  }, []);

  if (!visible) return null;

  async function handlePetHead() {
    setPetting(true);
    setVisible(false);
    try {
      const text = await getRandomFunText();
      setComfortMessage({
        timestamp: new Date().toISOString(),
        comfort_text: text,
        choice: "pet_head",
        ttl_seconds: 12,
      });
    } catch {
      setComfortMessage({
        timestamp: new Date().toISOString(),
        comfort_text: "嘿嘿嘿嘿嘿",
        choice: "pet_head",
        ttl_seconds: 8,
      });
    }
    setPetting(false);
  }

  async function handleWhatDoing() {
    setAsking(true);
    setVisible(false);

    setComfortMessage({
      timestamp: "_thinking_",
      comfort_text: "嗯...",
      choice: "what_doing",
      ttl_seconds: 90,
    });

    try {
      const msg = await triggerPetHead();
      if (msg) {
        setComfortMessage(msg);
      } else {
        setComfortMessage({
          timestamp: new Date().toISOString(),
          comfort_text: "想说什么来着...忘了",
          choice: "what_doing",
          ttl_seconds: 10,
        });
      }
    } catch (err) {
      console.error("Failed to trigger LLM:", err);
      setComfortMessage({
        timestamp: new Date().toISOString(),
        comfort_text: "嘿嘿...等下再说",
        choice: "what_doing",
        ttl_seconds: 10,
      });
    }
    setAsking(false);
  }

  function handleDailyReport() {
    setVisible(false);
    setShowDailyReport(true);
  }

  async function handleRepairCron() {
    setRepairing(true);
    setVisible(false);
    setComfortMessage({
      timestamp: "_thinking_",
      comfort_text: "正在检查连接...",
      choice: "repair",
      ttl_seconds: 120,
    });
    try {
      const ok = await ensureCron();
      setComfortMessage({
        timestamp: new Date().toISOString(),
        comfort_text: ok ? "连接修复好了！数据开始跑了~" : "好像还是有问题...检查一下 OpenClaw 是不是在运行？",
        choice: "repair",
        ttl_seconds: 15,
      });
    } catch {
      setComfortMessage({
        timestamp: new Date().toISOString(),
        comfort_text: "修复失败了...OpenClaw 可能没有启动",
        choice: "repair",
        ttl_seconds: 15,
      });
    }
    setRepairing(false);
  }

  const backdrop = (
    <div
      onClick={() => setVisible(false)}
      style={{ position: "fixed", inset: 0, zIndex: 499 }}
    />
  );

  if (sub === "skins") {
    const handleSkinClick = async (skinId: number) => {
      const isUnlocked = unlockedSkins.includes(skinId);
      if (isUnlocked) {
        previewColorRef.current = null;
        savedColorRef.current = skinId;
        setDogColor(skinId);
        setVisible(false);
        return;
      }
      if (totalCoins >= COINS_PER_SKIN) {
        const ok = await unlockSkin(skinId, COINS_PER_SKIN);
        if (ok) {
          const [skins, coins] = await Promise.all([getUnlockedSkins(), getTotalCoins()]);
          setUnlockedSkins(skins);
          setTotalCoins(coins);
          previewColorRef.current = null;
          savedColorRef.current = skinId;
          setDogColor(skinId);
          setVisible(false);
        }
      }
    };

    const handleSkinHover = (skinId: number) => {
      previewColorRef.current = skinId;
      setDogColor(skinId);
    };

    const handleSkinLeave = () => {
      if (previewColorRef.current !== null) {
        setDogColor(savedColorRef.current);
        previewColorRef.current = null;
      }
    };

    const handleBack = () => {
      if (previewColorRef.current !== null) {
        setDogColor(savedColorRef.current);
        previewColorRef.current = null;
      }
      setSub("none");
    };

    return (
      <>
        {backdrop}
        <div
          data-ctx-menu
          className="pixel-box"
          style={{
            position: "absolute",
            right: 10,
            bottom: 60,
            padding: "6px 0",
            zIndex: 500,
            minWidth: 140,
            fontSize: 11,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            onClick={handleBack}
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
          {DOG_SKINS.map((skin) => {
          const isUnlocked = unlockedSkins.includes(skin.id);
          const isCurrent = dogColor === skin.id && previewColorRef.current === null;
          const canAfford = totalCoins >= COINS_PER_SKIN;
          return (
            <div
              key={skin.id}
              onClick={() => handleSkinClick(skin.id)}
              onMouseEnter={(e) => {
                handleSkinHover(skin.id);
                if (!isCurrent) e.currentTarget.style.backgroundColor = "var(--pixel-bg-dark)";
              }}
              onMouseLeave={(e) => {
                handleSkinLeave();
                if (!isCurrent) e.currentTarget.style.backgroundColor = "transparent";
              }}
              style={{
                padding: "4px 10px",
                cursor: isUnlocked || canAfford ? "pointer" : "default",
                backgroundColor: isCurrent ? "var(--pixel-accent)" : "transparent",
                color: isCurrent ? "#fff" : isUnlocked ? "var(--pixel-text)" : "var(--pixel-text-light)",
                fontWeight: isCurrent ? "bold" : "normal",
                fontFamily: "var(--pixel-font)",
                fontSize: 10,
                opacity: isUnlocked ? 1 : 0.6,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>
                {isCurrent ? "> " : "  "}
                {String(skin.id).padStart(2, "0")} {skin.name}
              </span>
              {!isUnlocked && (
                <span style={{ fontSize: 8, opacity: 0.7 }}>
                  {canAfford ? `${COINS_PER_SKIN}coin` : `差${COINS_PER_SKIN - totalCoins}`}
                </span>
              )}
            </div>
          );
        })}
      </div>
      </>
    );
  }

  return (
    <>
      {backdrop}
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
        style={{
          padding: "3px 10px 5px",
          fontSize: 9,
          color: "var(--pixel-text-light)",
          fontFamily: "var(--pixel-font)",
          borderBottom: "2px solid var(--pixel-border)",
          marginBottom: 2,
        }}
      >
        金币: {totalCoins}
      </div>
      <MenuItem label="摸摸头" onClick={handlePetHead} disabled={petting} />
      <MenuItem label="在干嘛" onClick={handleWhatDoing} disabled={asking} />
      <MenuItem label="今天的日记" onClick={handleDailyReport} />
      <div
        style={{
          height: 2,
          backgroundColor: "var(--pixel-border)",
          margin: "3px 0",
          opacity: 0.4,
        }}
      />
      <MenuItem label="换皮肤 >" onClick={() => setSub("skins")} />
      <MenuItem label="修复连接" onClick={handleRepairCron} disabled={repairing} />
    </div>
    </>
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
