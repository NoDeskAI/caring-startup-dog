import { PhaserWrapper } from "./PhaserWrapper";
import { StatusBubble } from "./components/StatusBubble";
import { ComfortBubble } from "./components/ComfortBubble";
import { AskPanel } from "./components/AskPanel";
import { MoodSlider } from "./components/MoodSlider";
import { SkinMenu } from "./components/SkinMenu";
import { useStateWatcher } from "./hooks/useStateWatcher";
import "./App.css";

function App() {
  useStateWatcher();

  return (
    <div className="app-container">
      <PhaserWrapper />
      <StatusBubble />
      <ComfortBubble />
      <MoodSlider />
      <AskPanel />
      <SkinMenu />
    </div>
  );
}

export default App;
