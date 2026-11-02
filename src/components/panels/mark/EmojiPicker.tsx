import { useMemo, useState } from "react";
import emojis from "@/data/emojis.json";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PanelHelp } from "../primitives";

/* ------------------------------------------------------------------------------------------- */

const GROUPS = [
  { key: "smileys-emotion", label: "Smileys" },
  { key: "people-body", label: "People" },
  { key: "animals-nature", label: "Nature" },
  { key: "food-drink", label: "Food" },
  { key: "travel-places", label: "Travel" },
  { key: "activities", label: "Activities" },
  { key: "objects", label: "Objects" },
  { key: "symbols", label: "Symbols" },
  { key: "flags", label: "Flags" },
];

const MAX_SEARCH_RESULTS = 200;

export const EmojiPicker = ({ onPick }: { onPick: (char: string) => void }) => {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState(GROUPS[0].key);
  const search = query.trim().toLowerCase();

  const results = useMemo(
    () =>
      search
        ? emojis
            .filter((emoji) => emoji.name.toLowerCase().includes(search))
            .slice(0, MAX_SEARCH_RESULTS)
        : emojis.filter((emoji) => emoji.group === group),
    [search, group],
  );

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
      <Input
        autoFocus
        aria-label="Search emoji"
        placeholder="Search emoji"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {!search && (
        <div className="flex flex-wrap gap-1">
          {GROUPS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === group}
              onClick={() => setGroup(key)}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 text-[10.5px] transition-colors hover:bg-p-200/10 hover:text-text",
                key === group ? "bg-p-200/10 text-text" : "text-text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {results.length === 0 ? (
        <PanelHelp>No emoji match that. Try another word.</PanelHelp>
      ) : (
        <div className="grid grid-cols-7 gap-0.5">
          {results.map((emoji) => (
            <button
              key={emoji.char}
              type="button"
              title={emoji.name}
              aria-label={emoji.name}
              onClick={() => onPick(emoji.char)}
              className="flex aspect-square cursor-pointer items-center justify-center rounded-md text-lg transition-colors hover:bg-p-200/10"
            >
              {emoji.char}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
