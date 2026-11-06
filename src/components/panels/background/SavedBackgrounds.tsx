import { useEffect, useState } from "react";
import { Bookmark, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditor, SAVED_MAX } from "@/store/editor";
import type { SavedBackground } from "@/types";
import { Button } from "@/components/ui/button";
import { hasSavedBackgroundsFile } from "@/lib/host";
import { backgroundThumb } from "@/lib/background/thumb";
import { MutedMini, PanelHelp, SectionLabel } from "../primitives";
import { choiceClass } from "../choice";

const SavedTile = ({ saved, selected }: { saved: SavedBackground; selected: boolean }) => {
  const use = useEditor((s) => s.useSavedBackground);
  const remove = useEditor((s) => s.deleteSavedBackground);
  const customPairs = useEditor((s) => s.customPatternPairs);
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void backgroundThumb(saved.background, customPairs).then((url) => current && setThumb(url));
    return () => {
      current = false;
    };
  }, [saved.background, customPairs]);

  return (
    <div className="group relative">
      <button
        type="button"
        aria-label="Use this saved background"
        aria-pressed={selected}
        onClick={() => use(saved.id)}
        className={cn(
          "aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-md border bg-chrome bg-cover bg-center transition-colors",
          choiceClass(selected),
        )}
        style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
      />
      <button
        type="button"
        aria-label="Delete this saved background"
        onClick={() => remove(saved.id)}
        className="absolute -right-1 -top-1 hidden h-3.5 w-3.5 cursor-pointer items-center justify-center rounded-full border border-hairline bg-chrome text-text-muted hover:text-text group-hover:flex"
      >
        <X className="h-2 w-2" />
      </button>
    </div>
  );
};

/** Backgrounds kept to use again, in any project. */
export const SavedBackgrounds = () => {
  const saved = useEditor((s) => s.savedBackgrounds);
  const background = useEditor((s) => s.background);
  const save = useEditor((s) => s.saveBackground);
  const current = JSON.stringify(background);
  const isSaved = saved.some((entry) => JSON.stringify(entry.background) === current);

  return (
    <div className="space-y-2.5">
      <Button variant="outline" size="block" className="cursor-pointer" disabled={isSaved} onClick={save}>
        <Bookmark className="h-3 w-3" /> {isSaved ? "Saved" : "Save this background"}
      </Button>
      {saved.length > 0 ? (
        <>
          <SectionLabel right={<MutedMini>{`${saved.length} OF ${SAVED_MAX}`}</MutedMini>}>SAVED</SectionLabel>
          <div className="grid grid-cols-4 gap-1.5">
            {saved.map((entry) => (
              <SavedTile key={entry.id} saved={entry} selected={JSON.stringify(entry.background) === current} />
            ))}
          </div>
        </>
      ) : (
        <PanelHelp>Save a background to use it again in any project.</PanelHelp>
      )}
      {!hasSavedBackgroundsFile && saved.length > 0 && (
        <PanelHelp>In the browser, saved backgrounds last until you close Layer.</PanelHelp>
      )}
    </div>
  );
};
