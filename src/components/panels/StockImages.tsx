import { useEffect, useRef, useState } from "react";
import {
  downloadStockImage,
  hasStockImages,
  searchStockImages,
  type StockImage,
} from "@/lib/host";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PanelHelp, SectionLabel } from "./primitives";

const SEARCH_DELAY_MS = 500;

const messageOf = (reason: unknown) =>
  reason instanceof Error ? reason.message : String(reason);

export const StockImages = ({
  onPick,
}: {
  onPick: (image: Blob) => void | Promise<unknown>;
}) => {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [images, setImages] = useState<StockImage[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A slower, older search must not overwrite the newest one.
  const latest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = async (text: string, nextPage: number) => {
    const request = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const found = await searchStockImages(text, nextPage);
      if (request !== latest.current) return;
      setImages((shown) => (nextPage === 1 ? found.images : [...shown, ...found.images]));
      setHasMore(found.hasMore);
      setPage(nextPage);
      setSearched(text);
    } catch (reason) {
      if (request === latest.current) setError(messageOf(reason));
    } finally {
      if (request === latest.current) setLoading(false);
    }
  };

  // Searches once typing pauses, so each keystroke isn't a request.
  const onType = (text: string) => {
    setQuery(text);
    clearTimeout(timer.current);
    const trimmed = text.trim();
    if (trimmed) {
      timer.current = setTimeout(() => search(trimmed, 1), SEARCH_DELAY_MS);
      return;
    }
    latest.current++;
    setImages([]);
    setHasMore(false);
    setSearched("");
    setLoading(false);
    setError(null);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  const add = async (image: StockImage) => {
    setAddingId(image.id);
    setError(null);
    try {
      await onPick(await downloadStockImage(image.largeImageUrl));
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setAddingId(null);
    }
  };

  if (!hasStockImages) {
    return (
      <div className="space-y-2">
        <SectionLabel>FREE IMAGES</SectionLabel>
        <PanelHelp>Searching free images works in the desktop app.</PanelHelp>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SectionLabel>FREE IMAGES</SectionLabel>
      <Input
        type="search"
        aria-label="Search free images"
        placeholder="Search free images"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={query}
        onChange={(e) => onType(e.target.value)}
      />

      {images.length > 0 && (
        <div className="max-h-60 overflow-y-auto">
          <div className="grid grid-cols-3 gap-1.5">
            {images.map((image) => (
              <button
                key={image.id}
                type="button"
                title={image.tags}
                aria-label={`Use image: ${image.tags}`}
                disabled={addingId !== null}
                onClick={() => add(image)}
                className="aspect-square cursor-pointer overflow-hidden rounded-md border border-hairline bg-canvas transition-colors hover:border-p-300 disabled:cursor-default disabled:opacity-50"
              >
                <img
                  src={image.previewUrl}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {hasMore && (
        <Button
          variant="ghost"
          size="block"
          disabled={loading}
          onClick={() => search(searched, page + 1)}
        >
          More images
        </Button>
      )}

      {error && <PanelHelp>{error}</PanelHelp>}
      {!error && loading && <PanelHelp>Searching…</PanelHelp>}
      {!error && !loading && searched && images.length === 0 && (
        <PanelHelp>No images found. Try another word.</PanelHelp>
      )}
      {addingId !== null && <PanelHelp>Adding image…</PanelHelp>}
      {images.length > 0 && <PanelHelp>Images from Pixabay</PanelHelp>}
    </div>
  );
};
