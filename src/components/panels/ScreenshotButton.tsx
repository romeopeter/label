import { useState } from "react";
import { Camera } from "lucide-react";
import { captureScreen, hasNativeScreenshot } from "@/lib/host";
import { Button } from "@/components/ui/button";
import { PanelHelp } from "./primitives";
import { ScreenAreaPicker } from "./ScreenAreaPicker";

const HELP = hasNativeScreenshot
  ? "Layer steps aside to take your screen, then you choose the area to keep."
  : "Pick a screen or window, then choose the area to keep.";

export const ScreenshotButton = ({
  onCapture,
}: {
  onCapture: (image: Blob) => void | Promise<unknown>;
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The whole screen, while the user chooses the area of it to keep. */
  const [screen, setScreen] = useState<Blob | null>(null);

  const capture = async () => {
    setBusy(true);
    setError(null);
    try {
      const image = await captureScreen();
      if (image) setScreen(image);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const keep = async (area: Blob) => {
    setScreen(null);
    try {
      await onCapture(area);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  return (
    <div className="flex flex-col gap-2 pb-2">
      <Button variant="outline" size="block" disabled={busy || !!screen} onClick={capture}>
        <Camera className="h-3 w-3" /> Add screenshot
      </Button>
      <PanelHelp>{error ?? HELP}</PanelHelp>
      {screen && <ScreenAreaPicker image={screen} onCancel={() => setScreen(null)} onCapture={keep} />}
    </div>
  );
};
