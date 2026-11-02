import { useRef, type RefObject } from "react";
import { Circle, Layer } from "react-konva";
import type Konva from "konva";
import { useEditor } from "@/store/editor";
import {
  constrainAngle,
  controlFromHandle,
  curveHandle,
  placeConnector,
} from "@/lib/connectors";
import {
  SNAP_THRESHOLD_PX,
  snapPoint,
  type SnapCandidates,
} from "@/lib/snapping";
import type { Connector, ShapeElement } from "@/types";
import { snapCandidatesFor } from "./snapCandidates";
import type { SnapGuidesHandle } from "./SnapGuides";

/** Konva name the exporter hides before capture. */
export const MARK_HANDLES_LAYER_NAME = "mark-handles";

type Point = [number, number];

const HANDLE_RADIUS_PX = 7;

const setCursor = (event: Konva.KonvaEventObject<MouseEvent>, cursor: string) => {
  const container = event.target.getStage()?.container();
  if (container) container.style.cursor = cursor;
};

const Handle = ({
  at,
  label,
  scale,
  ownerId,
  guidesRef,
  snaps = true,
  onMove,
}: {
  at: Point;
  label: string;
  scale: number;
  ownerId: string;
  guidesRef: RefObject<SnapGuidesHandle>;
  snaps?: boolean;
  onMove: (point: Point, shift: boolean) => void;
}) => {
  const candidates = useRef<SnapCandidates | null>(null);

  return (
    <Circle
      name={label}
      x={at[0]}
      y={at[1]}
      radius={HANDLE_RADIUS_PX / scale}
      fill="#FFFFFF"
      stroke="#534AB7"
      strokeWidth={2 / scale}
      draggable
      onMouseEnter={(event) => setCursor(event, "grab")}
      onMouseLeave={(event) => setCursor(event, "")}
      onDragStart={(event) => {
        const stage = event.target.getStage();
        candidates.current =
          snaps && stage ? snapCandidatesFor(stage, ownerId) : null;
      }}
      onDragMove={(event) => {
        const raw: Point = [event.target.x(), event.target.y()];
        const shift = event.evt.shiftKey;
        // Shift already pins the end to an angle; a snap would fight it.
        const snapped =
          candidates.current && !shift
            ? snapPoint(raw, candidates.current, SNAP_THRESHOLD_PX / scale)
            : null;
        guidesRef.current?.show(snapped?.guides ?? []);
        onMove(snapped?.point ?? raw, shift);
        // The store may not change if the point didn't, so place this directly.
        if (snapped) {
          event.target.position({ x: snapped.point[0], y: snapped.point[1] });
        }
      }}
      onDragEnd={() => {
        candidates.current = null;
        guidesRef.current?.clear();
      }}
    />
  );
};

const ConnectorHandles = ({
  el,
  connector,
  scale,
  guidesRef,
}: {
  el: ShapeElement;
  connector: Connector;
  scale: number;
  guidesRef: RefObject<SnapGuidesHandle>;
}) => {
  const update = useEditor((s) => s.updateElement);
  const toWorld = ([x, y]: Point): Point => [el.x + x, el.y + y];
  const toLocal = ([x, y]: Point): Point => [x - el.x, y - el.y];
  const place = (next: Connector) =>
    update(el.id, placeConnector(el.x, el.y, next));

  return (
    <>
      <Handle
        label="connector-start"
        ownerId={el.id}
        guidesRef={guidesRef}
        at={toWorld(connector.start)}
        scale={scale}
        onMove={(point, shift) =>
          place({
            ...connector,
            start: toLocal(
              shift ? constrainAngle(toWorld(connector.end), point) : point,
            ),
          })
        }
      />
      <Handle
        label="connector-end"
        ownerId={el.id}
        guidesRef={guidesRef}
        at={toWorld(connector.end)}
        scale={scale}
        onMove={(point, shift) =>
          place({
            ...connector,
            end: toLocal(
              shift ? constrainAngle(toWorld(connector.start), point) : point,
            ),
          })
        }
      />
      {connector.route === "curved" && (
        <Handle
          label="connector-curve"
          ownerId={el.id}
          guidesRef={guidesRef}
          snaps={false}
          at={toWorld(curveHandle(connector))}
          scale={scale}
          onMove={(point) =>
            place({
              ...connector,
              control: controlFromHandle(connector, toLocal(point)),
            })
          }
        />
      )}
    </>
  );
};

const CalloutHandle = ({
  el,
  tail,
  scale,
  guidesRef,
}: {
  el: ShapeElement;
  tail: Point;
  scale: number;
  guidesRef: RefObject<SnapGuidesHandle>;
}) => {
  const update = useEditor((s) => s.updateElement);
  const angle = (el.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return (
    <Handle
      label="callout-tail"
      ownerId={el.id}
      guidesRef={guidesRef}
      at={[el.x + tail[0] * cos - tail[1] * sin, el.y + tail[0] * sin + tail[1] * cos]}
      scale={scale}
      onMove={([x, y]) => {
        const dx = x - el.x;
        const dy = y - el.y;
        update(el.id, { tail: [dx * cos + dy * sin, -dx * sin + dy * cos] });
      }}
    />
  );
};

/** Drag points for marks a box can't describe: line ends, curves, callout tails. */
export const MarkHandles = ({
  el,
  scale,
  guidesRef,
}: {
  el: ShapeElement;
  scale: number;
  guidesRef: RefObject<SnapGuidesHandle>;
}) => {
  if (!el.connector && !el.tail) return null;

  return (
    <Layer name={MARK_HANDLES_LAYER_NAME}>
      {el.connector && (
        <ConnectorHandles
          el={el}
          connector={el.connector}
          scale={scale}
          guidesRef={guidesRef}
        />
      )}
      {el.tail && (
        <CalloutHandle el={el} tail={el.tail} scale={scale} guidesRef={guidesRef} />
      )}
    </Layer>
  );
};
