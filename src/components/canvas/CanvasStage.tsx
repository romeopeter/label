import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Transformer, Text as KText } from "react-konva";
import Konva from "konva";
import { useEditor } from "../../store/editor";
import { Background } from "./Background";
import { ImageNode } from "./ImageNode";
import { TextNode } from "./TextNode";
import { ShapeNode } from "./ShapeNode";
import { setStage } from "./stageRef";
import type { TextElement } from "../../types";
import { importImageFile } from "../../lib/importers";

/* ------------------------------------------------------------------------ */

export const CanvasStage = () => {
  // Store selectors
  const canvas = useEditor((s) => s.canvas);
  const background = useEditor((s) => s.background);
  const elements = useEditor((s) => s.elements);
  const selectedIds = useEditor((s) => s.selectedIds);
  const selectElement = useEditor((s) => s.selectElement);
  const updateElement = useEditor((s) => s.updateElement);
  const deleteElement = useEditor((s) => s.deleteElement);
  const addImage = useEditor((s) => s.addImage);
  const zoom = useEditor((s) => s.zoom);
  const watermark = useEditor((s) => s.watermark);

  // Refs for Konva stage, transformer, and container div
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Track which text element is being edited (shows textarea overlay)
  const [editingText, setEditingText] = useState<TextElement | null>(null);

  // Inform exporter where the stage is
  useEffect(() => {
    setStage(stageRef.current);
    return () => setStage(null);
  }, []);

  // Compute scale and display dimensions to fit canvas within viewport, accounting for zoom
  const [{ scale, displayW, displayH }, setFit] = useState(() => ({
    scale: 1,
    displayW: canvas.width,
    displayH: canvas.height,
  }));

  useEffect(() => {
    const compute = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;

      const padding = 80;
      // const availW = wrap.clientWidth - padding;
      // const availH = wrap.clientHeight - padding - 80; // leave room for hints/timeline

       const availW = 1400;
      const availH = 950;

      // Guard against invalid dimensions - don't update if wrapper isn't sized yet
      if (availW <= 0 || availH <= 0) return;

      const fit = Math.min(availW / canvas.width, availH / canvas.height, 1);
      const s = fit * (zoom / 100);
      setFit({
        scale: s,
        displayW: canvas.width * s,
        displayH: canvas.height * s,
      });
    };

    const requestObserver = new ResizeObserver(compute);
    if (wrapRef.current) requestObserver.observe(wrapRef.current);

    return () => requestObserver.disconnect();
  }, [canvas.width, canvas.height, zoom]);

  // Attach transformer to selected nodes
  useEffect(() => {
    const stage = stageRef.current;
    const tr = transformerRef.current;
    if (!stage || !tr) return;
    const nodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter(Boolean) as Konva.Node[];
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, elements]);

  // Keyboard shortcuts: Delete/Backspace removes selected elements, Escape deselects
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Ignore if user is typing in an input or textarea
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      )
        return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length) {
        e.preventDefault();
        selectedIds.forEach(deleteElement);
      }
      if (e.key === "Escape") selectElement(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds, deleteElement, selectElement]);

  // Handle clipboard paste to import images
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.startsWith("image/")) {
          const file = it.getAsFile();
          if (file) await importImageFile(file, addImage);
          break;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addImage]);

  // Deselect when clicking stage background or empty areas
  const onStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) selectElement(null);
    // also deselect when clicking background rect
    const id = (e.target as Konva.Node).id?.();
    if (!id) selectElement(null);
  };

  // Handle element selection with shift-key multi-select support
  const onSelect = (id: string) => (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    selectElement(id, e.evt?.shiftKey ?? false);
  };

  // Position and style the inline text editor overlay to match the Konva text element
  const textareaStyle = useMemo<React.CSSProperties | null>(() => {
    if (!editingText) return null;
    return {
      position: "absolute",
      left: editingText.x * scale,
      top: editingText.y * scale,
      width: editingText.width * scale,
      transform: `rotate(${editingText.rotation}deg)`,
      transformOrigin: "0 0",
      fontFamily: editingText.fontFamily,
      fontSize: editingText.fontSize * scale,
      fontWeight: editingText.fontWeight,
      color: editingText.fill,
      lineHeight: editingText.lineHeight,
      letterSpacing: editingText.letterSpacing,
      textAlign: editingText.align,
      background: "rgba(0,0,0,0.35)",
      border: "1px solid rgba(175,169,236,0.6)",
      borderRadius: 4,
      outline: "none",
      padding: 0,
      margin: 0,
      resize: "none",
      overflow: "hidden",
      zIndex: 10,
    };
  }, [editingText, scale]);

  return (
    <div
      ref={wrapRef}
      className="canvas-stage"
      style={{ position: "relative" }}
    >
      <div
        className="canvas-artboard"
        style={{
          width: displayW,
          height: displayH,
          position: "relative",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.4)",
        }}
      >
        <Stage
          ref={stageRef}
          width={displayW}
          height={displayH}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={onStageMouseDown}
          onTouchStart={onStageMouseDown as any}
        >
          {/* Background layer - non-interactive */}
          <Layer listening={false}>
            <Background
              bg={background}
              width={canvas.width}
              height={canvas.height}
            />
          </Layer>

          {/* Main content layer - elements, transformer, and watermark */}
          <Layer>
            {/* Render all canvas elements based on type */}
            {elements.map((el) => {
              const isSelected = selectedIds.includes(el.id);
              if (el.type === "image") {
                return (
                  <ImageNode
                    key={el.id}
                    el={el}
                    selected={isSelected}
                    onSelect={onSelect(el.id)}
                  />
                );
              }
              if (el.type === "text") {
                return (
                  <TextNode
                    key={el.id}
                    el={el}
                    selected={isSelected}
                    onSelect={onSelect(el.id)}
                    onRequestEdit={setEditingText}
                  />
                );
              }
              if (el.type === "shape") {
                return (
                  <ShapeNode
                    key={el.id}
                    el={el}
                    selected={isSelected}
                    onSelect={onSelect(el.id)}
                  />
                );
              }
              return null;
            })}
            {/* Transform handles for selected elements */}
            <Transformer
              ref={transformerRef}
              rotateEnabled
              keepRatio={false}
              borderStroke="#AFA9EC"
              borderStrokeWidth={1.5}
              anchorFill="#fff"
              anchorStroke="#534AB7"
              anchorSize={9}
            />

            {/* Watermark (Phase 1: composited in JS, always shown for non-Pro) */}
            {watermark && (
              <KText
                x={canvas.width - 240}
                y={canvas.height - 50}
                text="Made with Laybel"
                fontSize={22}
                fontFamily="DM Sans"
                fontStyle="500"
                fill="rgba(255,255,255,0.7)"
                listening={false}
              />
            )}
          </Layer>
        </Stage>

        {/* Inline text editor overlay - positioned and styled to match the Konva text element */}
        {editingText && textareaStyle && (
          <textarea
            autoFocus
            aria-label="Edit text"
            title="Edit text"
            defaultValue={editingText.text}
            style={textareaStyle}
            onBlur={(e) => {
              updateElement(editingText.id, { text: e.currentTarget.value });
              setEditingText(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.currentTarget.blur();
              }
            }}
          />
        )}
      </div>

      <div
        className="art-size-tag"
        style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 11 }}
      >
        {canvas.width} × {canvas.height}
      </div>
    </div>
  );
};
