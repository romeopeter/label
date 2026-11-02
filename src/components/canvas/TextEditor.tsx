import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEditor } from "@/store/editor";
import { calloutGeometry } from "@/lib/callouts";
import { MARK_FONT_FAMILY } from "@/lib/marks";

/**
 * Typing on the canvas. A textarea sits exactly over the text it replaces, at
 * the current zoom and rotation, while the node underneath is hidden. Only one
 * element is ever open, and any click away closes it.
 */
export const TextEditor = ({ scale }: { scale: number }) => {
  const editingId = useEditor((s) => s.editingId);
  const el = useEditor((s) => s.elements.find((e) => e.id === editingId));
  const update = useEditor((s) => s.updateElement);
  const deleteElement = useEditor((s) => s.deleteElement);
  const setEditingId = useEditor((s) => s.setEditingId);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [height, setHeight] = useState(0);

  const initial = el && (el.type === "text" || el.type === "shape") ? el.text ?? "" : "";

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.focus();
    area.select();
  }, [editingId]);

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = "0px";
    area.style.height = `${area.scrollHeight}px`;
    setHeight(area.scrollHeight);
  }, [initial, scale, el?.width]);

  if (!el || (el.type !== "text" && !(el.type === "shape" && el.calloutKind))) {
    return null;
  }

  const close = () => {
    // Blank text would be an invisible layer; a blank bubble is still a bubble.
    if (el.type === "text" && !el.text.trim()) deleteElement(el.id);
    setEditingId(null);
  };

  const isText = el.type === "text";
  const box = isText
    ? { x: 0, y: 0, width: el.width, height: el.height }
    : calloutGeometry(
        el.calloutKind ?? "speech",
        el.width,
        el.height,
        el.tail ?? [0, 0],
        el.cornerRadius,
      ).textBox;
  const fontSize = isText ? el.fontSize : el.fontSize ?? 40;
  // A callout's text sits in the middle of the bubble, text at the top of its box.
  const top = isText ? 0 : Math.max(0, (box.height * scale - height) / 2);

  return (
    <div
      className="absolute left-0 top-0 z-20"
      style={{
        transform: `translate(${el.x * scale}px, ${el.y * scale}px) rotate(${el.rotation}deg)`,
        transformOrigin: "0 0",
      }}
    >
      <textarea
        ref={areaRef}
        aria-label="Edit text"
        spellCheck={false}
        value={initial}
        placeholder="Type here"
        onChange={(event) => update(el.id, { text: event.target.value })}
        onBlur={close}
        onKeyDown={(event) => {
          if (event.key === "Escape" || (event.key === "Enter" && event.metaKey)) {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className="absolute resize-none overflow-hidden border-0 bg-transparent p-0 outline-none placeholder:opacity-50"
        style={{
          left: box.x * scale,
          top: box.y * scale + top,
          width: box.width * scale,
          fontSize: fontSize * scale,
          fontFamily: isText ? el.fontFamily : MARK_FONT_FAMILY,
          fontWeight: isText ? el.fontWeight : 500,
          lineHeight: isText ? el.lineHeight : 1.2,
          letterSpacing: isText ? el.letterSpacing * scale : 0,
          textAlign: isText ? el.align : "center",
          color: isText ? el.fill : el.textFill ?? "#FFFFFF",
          caretColor: isText ? el.fill : el.textFill ?? "#FFFFFF",
        }}
      />
    </div>
  );
};
