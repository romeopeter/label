import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Transformer, Text as KText, Group as KGroup, Image as KImage, Rect as KRect } from "react-konva";
import useImage from "use-image";
import Konva from "konva";
import { useEditor } from "../../store/editor";
import { Background } from "./Background";
import { ImageNode } from "./ImageNode";
import { TextNode } from "./TextNode";
import { ShapeNode } from "./ShapeNode";
import { LayoutDecorNodes, LayoutSlotsLayer } from "./LayoutOverlay";
import { useLayoutDrag } from "./useLayoutDrag";
import { usePictureDrag } from "./usePictureDrag";
import { SelectionToolbar } from "./SelectionToolbar";
import { GRID_LAYER_NAME, GridOverlay } from "./GridOverlay";
import { SnapGuides, type SnapGuidesHandle } from "./SnapGuides";
import { MarkDraft, type MarkDraftHandle } from "./MarkDraft";
import { MARK_HANDLES_LAYER_NAME, MarkHandles } from "./MarkHandles";
import { TextEditor } from "./TextEditor";
import { CROP_LAYER_NAME, CropOverlay, type CropOverlayHandle } from "./CropOverlay";
import { boundsOf, CONTENT_LAYER_NAME, snapCandidatesFor } from "./snapCandidates";
import { useMarkPlacement } from "./useMarkPlacement";
import { setStage } from "./stageRef";
import { IMAGE_EDIT_SECTION_ID } from "@/lib/imageEdit/presets";
import { arrangeLayout } from "@/lib/layouts";
import {
  computeSnap,
  resizeSnapResult,
  snapPoint,
  SNAP_THRESHOLD_PX,
  type Bounds,
  type SnapCandidates,
} from "@/lib/snapping";
import { importImageFile } from "../../lib/importers";
import type { LayerElement, TextElement } from "@/types";
import { MIN_FRAME_SIZE } from "@/lib/constants";
import { FIXED_RATIO_SHAPES } from "@/lib/marks";

/* ------------------------------------------------------------------------ */

const isTransformerTarget = (node: Konva.Node) => {
  let current: Konva.Node | null = node;

  while (current) {
    if (current.getClassName() === "Transformer") return true;
    current = current.getParent();
  }

  return false;
};

const CORNER_ANCHORS = ["top-left", "top-right", "bottom-left", "bottom-right"];

const ALL_ANCHORS = [
  ...CORNER_ANCHORS,
  "top-center",
  "middle-left",
  "middle-right",
  "bottom-center",
];

/** Text has no height handles: its box is always as tall as its lines. */
const TEXT_ANCHORS = [...CORNER_ANCHORS, "middle-left", "middle-right"];

const MIN_TRANSFORM_SIZE = 8;

/** Half of each toolbar's width, so it stays on the canvas above an edge element. */
const TOOLBAR_HALF_WIDTH = { image: 235, text: 120 };

/** The element a clicked node belongs to: nodes draw inside an element's group. */
const elementIdOf = (node: Konva.Node, ids: Set<string>) => {
  let current: Konva.Node | null = node;
  while (current) {
    if (ids.has(current.id())) return current.id();
    current = current.getParent();
  }
  return null;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Whether a node is one of the document's elements, not the Transformer or an overlay. */
const isElementNode = (node: Konva.Node) => {
  const id = node.id();
  return !!id && useEditor.getState().elements.some((el) => el.id === id);
};

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
  const snapEnabled = useEditor((s) => s.snapEnabled);
  const watermark = useEditor((s) => s.watermark);
  const markTool = useEditor((s) => s.markTool);
  const editingId = useEditor((s) => s.editingId);
  const cropId = useEditor((s) => s.cropId);
  const setCropId = useEditor((s) => s.setCropId);
  const layout = useEditor((s) => s.layout);

  // Refs for Konva stage, transformer, and container div
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const guidesRef = useRef<SnapGuidesHandle>(null);
  const draftRef = useRef<MarkDraftHandle>(null);
  const cropRef = useRef<CropOverlayHandle>(null);
  const layoutFileRef = useRef<HTMLInputElement>(null);
  const layoutFileSlot = useRef<number | null>(null);
  const dropSlot = useLayoutDrag(stageRef);
  usePictureDrag(stageRef);
  const [draggingElement, setDraggingElement] = useState(false);
  const snapCandidates = useRef<SnapCandidates | null>(null);
  const resizeSnap = useRef<{ candidates: SnapCandidates; start: Bounds } | null>(null);
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

  // Brand logo for the watermark lockup
  const [logoImg] = useImage("/icons/logo.svg");

  // Attach transformer to selected nodes
  useEffect(() => {
    const stage = stageRef.current;
    const tr = transformerRef.current;
    if (!stage || !tr) return;
    const nodes = elements
      .filter(
        (el) =>
          selectedIds.includes(el.id) &&
          !el.locked &&
          !el.hidden &&
          el.id !== editingId &&
          el.id !== cropId &&
          // Connectors reshape from their own end handles.
          !(el.type === "shape" && el.connector),
      )
      .map((el) => stage.findOne(`#${el.id}`))
      .filter(Boolean) as Konva.Node[];
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, elements, editingId, cropId]);

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
        useEditor
          .getState()
          .elements.filter((el) => selectedIds.includes(el.id) && !el.locked)
          .forEach((el) => deleteElement(el.id));
      }
      if (e.key === "Enter" && useEditor.getState().cropId) {
        e.preventDefault();
        cropRef.current?.apply();
      }
      if (e.key === "Escape") {
        // Esc backs out of crop first, leaving the image selected.
        if (useEditor.getState().cropId) {
          setCropId(null);
          return;
        }
        selectElement(null);
        useEditor.getState().setMarkTool(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds, deleteElement, selectElement, setCropId]);

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

  const placement = useMarkPlacement(stageRef, draftRef, guidesRef, scale);

  // Deselect when clicking stage background or empty areas
  const onStagePointerDown = (
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    const target = e.target as Konva.Node;

    if (isTransformerTarget(target)) return;
    if (target.getLayer()?.name() === MARK_HANDLES_LAYER_NAME) return;
    // Crop mode ends with Apply or Cancel, not a stray click.
    if (cropId || target.getLayer()?.name() === CROP_LAYER_NAME) return;

    // Select on press, not release, so one gesture can select and drag. Shift
    // is left to the click handler, which toggles.
    const id = elementIdOf(target, new Set(elements.map((el) => el.id)));
    if (!id) {
      selectElement(null);
    } else if (!selectedIds.includes(id) && !e.evt.shiftKey) {
      selectElement(id);
    }
  };

  /*
    Snapping. The candidate set is built once per drag: nothing else moves
    while one element is being dragged, so rebuilding it on every pointer move
    would be pure waste.
  */
  const onElementDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (!isElementNode(e.target)) return;
    setDraggingElement(true);
    if (!snapEnabled) return;

    const stage = e.target.getStage();
    if (stage) snapCandidates.current = snapCandidatesFor(stage, e.target.id());
  };

  const onElementDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const candidates = snapCandidates.current;
    // The Transformer fires drag events of its own as it follows the element. Snapping
    // those would move the Transformer, and their empty guides would wipe the real ones.
    if (!candidates || !isElementNode(e.target)) return;

    const node = e.target;
    // The threshold is in screen px, so it divides through the stage scale —
    // otherwise the pull feels sticky zoomed out and dead zoomed in.
    const { dx, dy, guides } = computeSnap(
      boundsOf(node),
      candidates,
      SNAP_THRESHOLD_PX / scale,
    );

    if (dx !== 0 || dy !== 0) {
      node.position({ x: node.x() + dx, y: node.y() + dy });
    }
    guidesRef.current?.show(guides);
  };

  const onElementDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (!isElementNode(e.target)) return;
    setDraggingElement(false);
    snapCandidates.current = null;
    guidesRef.current?.clear();
  };

  const onTransformStart = () => {
    const stage = stageRef.current;
    const node = transformerRef.current?.nodes()[0];
    // A rotated box has no edges to line up, and a group has no one box to snap.
    if (!stage || !node || selectedIds.length !== 1 || node.rotation() !== 0) return;
    const candidates = snapCandidatesFor(stage, node.id());
    resizeSnap.current = candidates && { candidates, start: boundsOf(node) };
  };

  const onTransformEnd = () => {
    resizeSnap.current = null;
    guidesRef.current?.clear();
  };

  /** Pulls the handle being dragged to whatever it lines up with. Stage px in and out. */
  const snapResizeHandle = (
    _old: Konva.Vector2d,
    next: Konva.Vector2d,
    event?: MouseEvent,
  ) => {
    const snap = resizeSnap.current;
    const anchor = transformerRef.current?.getActiveAnchor() ?? "";
    if (!snap || anchor === "rotater" || event?.shiftKey) {
      guidesRef.current?.clear();
      return next;
    }

    const { point, guides } = snapPoint(
      [next.x / scale, next.y / scale],
      snap.candidates,
      SNAP_THRESHOLD_PX / scale,
    );
    const resized = resizeSnapResult(anchor, [next.x / scale, next.y / scale], point, snap.start, fixedRatio);
    guidesRef.current?.show(guides.filter((guide) => resized.axes.includes(guide.axis)));
    return { x: resized.point[0] * scale, y: resized.point[1] * scale };
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

  // Checks the whole selection: resizing a group scales every element in it, so
  // one free handle would stretch any image in the group.
  const hasImage = elements.some(
    (el) => selectedIds.includes(el.id) && el.type === "image",
  );

  const fixedRatio =
    hasImage ||
    selectedElement?.type === "text" ||
    (selectedElement?.type === "shape" &&
      FIXED_RATIO_SHAPES.has(selectedElement.shape));

  // The Transformer measures its box in screen pixels, so sizes scale with the stage.
  const framed =
    selectedElement?.type === "image" && !!selectedElement.deviceFrame;
  const minBoxWidth = framed ? MIN_FRAME_SIZE.width * scale : MIN_TRANSFORM_SIZE;
  const minBoxHeight = framed ? MIN_FRAME_SIZE.height * scale : MIN_TRANSFORM_SIZE;

  const cropElement =
    selectedElement?.type === "image" && selectedElement.id === cropId
      ? selectedElement
      : null;

  const arrangement = useMemo(
    () => (layout ? arrangeLayout(layout, elements, canvas) : null),
    [layout, elements, canvas],
  );

  // A slot decides where an image goes and how big it is, so there's nothing to drag.
  const selectionInLayout = !!layout?.slots.some(
    (slot) => slot.id && selectedIds.includes(slot.id),
  );

  const addToLayout = (slot: number) => {
    layoutFileSlot.current = slot;
    layoutFileRef.current?.click();
  };

  const onLayoutFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const files = Array.from(input.files ?? []);
    let slot = layoutFileSlot.current;
    for (const file of files) {
      const chosen = slot;
      await importImageFile(file, (src, width, height) =>
        chosen === null
          ? addImage(src, width, height)
          : useEditor.getState().fillSlot(chosen, src, width, height),
      );
      // The first file goes where the user clicked; the rest take the next free slots.
      slot = null;
    }
    input.value = "";
  };

  const anchors =
    selectedElement?.type === "text"
      ? TEXT_ANCHORS
      : fixedRatio
        ? CORNER_ANCHORS
        : ALL_ANCHORS;

  const handleElement =
    selectedElement?.type === "shape" &&
    !selectedElement.locked &&
    !selectedElement.hidden &&
    !draggingElement &&
    !markTool &&
    selectedElement.id !== editingId
      ? selectedElement
      : null;

  const selectedToolbarElement =
    (selectedElement?.type === "image" || selectedElement?.type === "text") &&
    !selectedElement.locked &&
    !selectedElement.hidden &&
    selectedElement.id !== editingId
      ? selectedElement
      : null;

  const toolbarHalfWidth = selectedToolbarElement
    ? TOOLBAR_HALF_WIDTH[selectedToolbarElement.type]
    : 0;

  const toolbarPosition = selectedToolbarElement
    ? {
        x: clamp(
          (selectedToolbarElement.x + selectedToolbarElement.width / 2) * scale,
          toolbarHalfWidth,
          Math.max(toolbarHalfWidth, displayW - toolbarHalfWidth),
        ),
        y: clamp(
          selectedToolbarElement.y * scale - 10,
          42,
          Math.max(42, displayH - 12),
        ),
      }
    : null;


  const updateSelectedText = (patch: Partial<TextElement>) => {
    if (!selectedToolbarElement || selectedToolbarElement.type !== "text")
      return;
    updateElement(selectedToolbarElement.id, patch as Partial<LayerElement>);
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
          style={{
            cursor: markTool
              ? markTool.kind === "text"
                ? "text"
                : "crosshair"
              : undefined,
          }}
          onMouseDown={onStagePointerDown}
          onTouchStart={onStagePointerDown}
          onPointerDown={placement.onPointerDown}
          onPointerMove={placement.onPointerMove}
        >
          {/* Background layer - non-interactive */}
          <Layer listening={false}>
            <Background
              bg={background}
              width={canvas.width}
              height={canvas.height}
            />
          </Layer>

          {/* Main content layer - elements, transformer, and watermark.
              Drag is handled here rather than per node: Konva bubbles drag
              events, so one handler covers every element type instead of
              repeating the snap logic in each of them. */}
          <Layer
            name={CONTENT_LAYER_NAME}
            listening={!markTool && !cropElement}
            onDragStart={onElementDragStart}
            onDragMove={onElementDragMove}
            onDragEnd={onElementDragEnd}
          >
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

            {arrangement && <LayoutDecorNodes arrangement={arrangement} />}

            {/* Transform handles for selected elements */}
            <Transformer
              ref={transformerRef}
              rotateEnabled={!selectionInLayout}
              keepRatio={fixedRatio}
              enabledAnchors={selectionInLayout ? [] : anchors}
              flipEnabled={false}
              ignoreStroke
              onTransformStart={onTransformStart}
              onTransformEnd={onTransformEnd}
              anchorDragBoundFunc={snapResizeHandle}
              boundBoxFunc={(oldBox, newBox) =>
                Math.abs(newBox.width) < minBoxWidth ||
                Math.abs(newBox.height) < minBoxHeight
                  ? oldBox
                  : newBox
              }
              borderStroke="#AFA9EC"
              borderStrokeWidth={1.5}
              anchorFill="#fff"
              anchorStroke="#534AB7"
              anchorSize={9}
            />

            {/* Watermark (Phase 1: composited in JS, always shown for non-Pro) */}
            {watermark && (
              <KGroup
                x={canvas.width - 144}
                y={canvas.height - 60}
                listening={false}
              >
                <KRect
                  x={0}
                  y={0}
                  width={120}
                  height={36}
                  cornerRadius={18}
                  fill="rgba(15,14,26,0.6)"
                />
                <KImage image={logoImg} x={14} y={8} width={22} height={20} />
                <KText
                  x={44}
                  y={6}
                  text="Layer"
                  fontSize={22}
                  fontFamily="Bricolage Grotesque"
                  fontStyle="bold"
                  fill="#FFFFFF"
                />
              </KGroup>
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

          {markTool && <MarkDraft ref={draftRef} />}

          {handleElement && (
            <MarkHandles el={handleElement} scale={scale} guidesRef={guidesRef} />
          )}

          {arrangement && !markTool && !cropElement && (
            <LayoutSlotsLayer
              arrangement={arrangement}
              dropSlot={dropSlot}
              scale={scale}
              onAdd={addToLayout}
            />
          )}

          {cropElement && (
            <CropOverlay
              key={cropElement.id}
              ref={cropRef}
              el={cropElement}
              scale={scale}
            />
          )}

          {/* Topmost: guides must read over both content and the grid. */}
          <SnapGuides ref={guidesRef} />
        </Stage>

        <input
          ref={layoutFileRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={onLayoutFiles}
          aria-label="Add images to layout slot"
        />

        {editingId && <TextEditor scale={scale} />}


        {selectedToolbarElement && toolbarPosition && (
          <SelectionToolbar
            element={selectedToolbarElement}
            canvas={canvas}
            cropping={!!cropElement}
            onCropStart={() => setCropId(selectedToolbarElement.id)}
            onCropApply={() => cropRef.current?.apply()}
            onCropReset={() => cropRef.current?.reset()}
            onCropCancel={() => setCropId(null)}
            onImageChange={(patch) =>
              updateElement(selectedToolbarElement.id, patch)
            }
            onEdit={() => {
              setActiveTool("images");
              // After the panel has rendered, since the section may not exist until then.
              requestAnimationFrame(() =>
                document
                  .getElementById(IMAGE_EDIT_SECTION_ID)
                  ?.scrollIntoView({ block: "start" }),
              );
            }}
            onHighlight={() => {
              setActiveTool("annotation");
              useEditor
                .getState()
                .setMarkTool({ kind: "stroke", shape: "highlight" });
            }}
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
