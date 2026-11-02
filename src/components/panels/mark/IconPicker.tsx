import { useMemo, useState } from "react";
import icons from "@/data/icons.json";
import { Input } from "@/components/ui/input";
import { PanelHelp } from "../primitives";

/* ------------------------------------------------------------------------------------------- */

/** Rendering all ~1,500 at once would stall the panel for icons nobody scans. */
const MAX_VISIBLE = 120;

export const IconPicker = ({
  onPick,
}: {
  onPick: (name: string, path: string) => void;
}) => {
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();

  const matches = useMemo(
    () =>
      search
        ? icons.filter(
            (icon) =>
              icon.name.includes(search) ||
              icon.tags.some((tag) => tag.includes(search)),
          )
        : icons,
    [search],
  );

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
      <Input
        autoFocus
        aria-label="Search icons"
        placeholder="Search icons"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {matches.length === 0 ? (
        <PanelHelp>No icons match that. Try another word.</PanelHelp>
      ) : (
        <div className="grid grid-cols-6 gap-0.5">
          {matches.slice(0, MAX_VISIBLE).map((icon) => (
            <button
              key={icon.name}
              type="button"
              title={icon.name}
              aria-label={icon.name}
              onClick={() => onPick(icon.name, icon.path)}
              className="flex aspect-square cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors hover:bg-p-200/10 hover:text-text"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="h-4.5 w-4.5"
              >
                <path d={icon.path} />
              </svg>
            </button>
          ))}
        </div>
      )}

      {matches.length > MAX_VISIBLE && (
        <PanelHelp>
          Showing {MAX_VISIBLE} of {matches.length}. Search to find more.
        </PanelHelp>
      )}
    </div>
  );
};
