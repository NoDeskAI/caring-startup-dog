import { PhaserWrapper } from "./PhaserWrapper";
import { StatusBubble } from "./components/StatusBubble";
import { ComfortBubble } from "./components/ComfortBubble";
import { AskPanel } from "./components/AskPanel";
import { MoodSlider } from "./components/MoodSlider";
import { ContextMenu } from "./components/ContextMenu";
import { DailyReport } from "./components/DailyReport";
import { ConnIndicator } from "./components/ConnIndicator";
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
      <ContextMenu />
      <DailyReport />
      <ConnIndicator />
    </div>
  );
}

export default App;
