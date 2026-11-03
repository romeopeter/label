import { useLayoutEffect, useMemo } from "react";
import useImage from "use-image";
import type { ImageElement } from "@/types";
import { hasEdit } from "@/lib/imageEdit/presets";
import {
  isImageEditSupported,
  prepareSource,
  renderEdit,
} from "@/lib/imageEdit/renderer";

/**
 * The picture to draw for an image element: its edited canvas, with any crop
 * already applied, or the untouched original when there's nothing to edit.
 * `onDraw` runs after new pixels land, because Konva can't see a canvas change.
 */
export const useEditedImage = (
  image: HTMLImageElement | undefined,
  edit: ImageElement["edit"],
  crop: ImageElement["crop"],
  onDraw?: () => void,
) => {
  const [overlay] = useImage(edit?.style?.overlaySrc ?? "", "anonymous");
  const output = useMemo(() => document.createElement("canvas"), []);
  const active = !!image && hasEdit(edit) && isImageEditSupported();

  const source = useMemo(
    () => (active && image ? prepareSource(image, crop) : null),
    [active, image, crop],
  );

  useLayoutEffect(() => {
    if (!source || !edit) return;
    renderEdit(source, edit, output, overlay ?? null);
    onDraw?.();
    // onDraw is a fresh closure each render and only ever redraws the same layer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, edit, output, overlay]);

  return { picture: source ? output : image, edited: !!source };
};
