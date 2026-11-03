import { useState } from "react";
import { Camera } from "lucide-react";
import { captureScreen, hasNativeScreenshot } from "@/lib/host";
import { Button } from "@/components/ui/button";
import { PanelHelp } from "./primitives";

const HELP = hasNativeScreenshot
  ? "Layer steps aside: drag over anything on your screen, or press Space to pick a window. Esc cancels."
  : "Pick a screen or window to capture.";

export const ScreenshotButton = ({
  onCapture,
}: {
  onCapture: (image: Blob) => void | Promise<unknown>;
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = async () => {
    setBusy(true);
    setError(null);
    try {
      const image = await captureScreen();
      if (image) await onCapture(image);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="block" disabled={busy} onClick={capture}>
        <Camera className="h-3 w-3" /> Add screenshot
      </Button>
      <PanelHelp>{error ?? HELP}</PanelHelp>
    </>
  );
};
