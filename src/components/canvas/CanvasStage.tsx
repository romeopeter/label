import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Transformer, Text as KText } from "react-konva";
import Konva from "konva";
import { useEditor } from "../../store/editor";
import { Background } from "./Background";
import { ImageNode } from "./ImageNode";
import { TextNode } from "./TextNode";
import { ShapeNode } from "./ShapeNode";
import { TiltedImageOverlay } from "./TiltedImageOverlay";
import { SelectionToolbar } from "./SelectionToolbar";
import { GRID_LAYER_NAME, GridOverlay } from "./GridOverlay";
import { setStage } from "./stageRef";
import { importImageFile } from "../../lib/importers";
import type { ImageElement, LaybelElement, TextElement } from "@/types";
import { isImageTiltActive } from "@/lib/tilt";

/* ------------------------------------------------------------------------ */

const isTransformerTarget = (node: Konva.Node) => {
  let current: Konva.Node | null = node;

  while (current) {
    if (current.getClassName() === "Transformer") return true;
    current = current.getParent();
  }

  return false;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const CanvasStage = () => {
  // Store selectors
  const canvas = useEditor((s) => s.canvas);
  const background = useEditor((s) => s.background);
  const elements = useEditor((s) => s.elements);
  const selectedIds = useEditor((s) => s.selectedIds);
  const selectElement = useEditor((s) => s.selectElement);
  const deleteElement = useEditor((s) => s.deleteElement);

  // Toolbar global state
  const duplicateElement = useEditor((s) => s.duplicateElement);
  const updateElement = useEditor((s) => s.updateElement);
  const moveElement = useEditor((s) => s.moveElement);
  const setActiveTool = useEditor((s) => s.setActiveTool);

  const addImage = useEditor((s) => s.addImage);
  const zoom = useEditor((s) => s.zoom);
  const grid = useEditor((s) => s.grid);
  const watermark = useEditor((s) => s.watermark);

  // Refs for Konva stage, transformer, and container div
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tiltOverlayRef = useRef<HTMLDivElement>(null);
  const [toolbarMoreOpenFor, setToolbarMoreOpenFor] = useState<string | null>(
    null,
  );

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

      // const availW = wrap.clientWidth - padding;
      // const availH = wrap.clientHeight - padding - 80; // leave room for hints/timeline

      const availW = 1400;
      const availH = 950;

      // Guard against invalid dimensions - don't update if wrapper isn't sized yet
      if (availW <= 0 || availH <= 0) return;

      const fit = Math.min(availW / canvas.width, availH / canvas.height, 1);
      const scale = fit * (zoom / 100);

      setFit({
        scale,
        displayW: canvas.width * scale,
        displayH: canvas.height * scale,
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
  const onStagePointerDown = (
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    const target = e.target as Konva.Node;

    if (isTransformerTarget(target)) return;

    if (target === target.getStage()) {
      selectElement(null);
      return;
    }

    // also deselect when clicking background rect
    const id = target.id?.();
    if (!id) selectElement(null);
  };

  // Handle element selection with shift-key multi-select support
  const onSelect = (id: string) => (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    selectElement(id, e.evt?.shiftKey ?? false);
  };

  const selectedElement =
    selectedIds.length === 1
      ? elements.find((el) => el.id === selectedIds[0])
      : null;

  const selectedToolbarElement =
    selectedElement?.type === "image" || selectedElement?.type === "text"
      ? selectedElement
      : null;

  const toolbarPosition = selectedToolbarElement
    ? {
        x: clamp(
          (selectedToolbarElement.x + selectedToolbarElement.width / 2) * scale,
          120,
          Math.max(120, displayW - 120),
        ),
        y: clamp(
          selectedToolbarElement.y * scale - 10,
          42,
          Math.max(42, displayH - 12),
        ),
      }
    : null;

  const selectedTiltedImage =
    selectedElement?.type === "image" &&
    !selectedElement.deviceFrame &&
    isImageTiltActive(selectedElement.transform)
      ? (selectedElement as ImageElement)
      : null;

  const updateSelectedText = (patch: Partial<TextElement>) => {
    if (!selectedToolbarElement || selectedToolbarElement.type !== "text")
      return;
    updateElement(selectedToolbarElement.id, patch as Partial<LaybelElement>);
  };

  const deleteSelectedElement = () => {
    if (!selectedToolbarElement) return;
    deleteElement(selectedToolbarElement.id);
    setToolbarMoreOpenFor(null);
  };

  const duplicateSelectedElement = () => {
    if (!selectedToolbarElement) return;
    duplicateElement(selectedToolbarElement.id);
    setToolbarMoreOpenFor(null);
  };

  const moveSelectedElement = (dz: 1 | -1) => {
    if (!selectedToolbarElement) return;
    moveElement(selectedToolbarElement.id, dz);
    setToolbarMoreOpenFor(null);
  };

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
          onMouseDown={onStagePointerDown}
          onTouchStart={onStagePointerDown}
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
                    // onRequestEdit={setEditingText}
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

          {/*
            Drawn above content so you can align against it, and only mounted
            when enabled — an always-present Layer costs a backing canvas even
            with nothing in it. Named so export can hide it before capture.
          */}
          {grid.enabled && (
            <Layer name={GRID_LAYER_NAME} listening={false}>
              <GridOverlay grid={grid} width={canvas.width} height={canvas.height} />
            </Layer>
          )}
        </Stage>

        {selectedTiltedImage && (
          <TiltedImageOverlay
            ref={tiltOverlayRef}
            image={selectedTiltedImage}
            scale={scale}
          />
        )}

        {selectedToolbarElement && toolbarPosition && (
          <SelectionToolbar
            element={selectedToolbarElement}
            position={toolbarPosition}
            moreOpen={toolbarMoreOpenFor === selectedToolbarElement.id}
            onMoreOpenChange={(open) =>
              setToolbarMoreOpenFor(open ? selectedToolbarElement.id : null)
            }
            onDelete={deleteSelectedElement}
            onDuplicate={duplicateSelectedElement}
            onLayerForward={() => moveSelectedElement(1)}
            onLayerBackward={() => moveSelectedElement(-1)}
            onTextChange={updateSelectedText}
            onOpenTextPanel={() => setActiveTool("header")}
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
