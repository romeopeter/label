import type { ReactNode } from "react";
import {
  Circle,
  Cloud,
  CornerDownRight,
  Diamond,
  Heart,
  Hexagon,
  Link2,
  MessageCircle,
  MessageSquare,
  MoveHorizontal,
  MoveUpRight,
  Pentagon,
  Plus,
  RectangleHorizontal,
  Slash,
  Spline,
  Square,
  Star,
  Tag,
  Triangle,
  Zap,
} from "lucide-react";
import type { Connector, ShapeElement, ShapeKind } from "@/types";

/* ------------------------------------------------------------------------------------------- */

export interface MarkOption {
  icon: ReactNode;
  label: string;
  patch: Partial<ShapeElement> & { shape?: ShapeKind };
  matches: (subject: ShapeElement) => boolean;
}

const ICON = "h-4 w-4";

const shapeOption = (
  shape: ShapeKind,
  label: string,
  icon: ReactNode,
  extra: Partial<ShapeElement> = {},
): MarkOption => ({
  icon,
  label,
  patch: { shape, ...extra },
  matches: (subject) => subject.shape === shape,
});

export const SHAPE_OPTIONS: MarkOption[] = [
  shapeOption("rect", "Rectangle", <Square className={ICON} />, { cornerRadius: 0 }),
  shapeOption("rounded-rect", "Rounded", <RectangleHorizontal className={ICON} />, {
    cornerRadius: 40,
  }),
  shapeOption("ellipse", "Ellipse", <Circle className={ICON} />),
  shapeOption("triangle", "Triangle", <Triangle className={ICON} />),
  shapeOption("diamond", "Diamond", <Diamond className={ICON} />),
  shapeOption("pentagon", "Pentagon", <Pentagon className={ICON} />),
  shapeOption("hexagon", "Hexagon", <Hexagon className={ICON} />),
  shapeOption("star", "Star", <Star className={ICON} />),
  shapeOption("heart", "Heart", <Heart className={ICON} />),
  shapeOption("cross", "Cross", <Plus className={ICON} />),
];

const connectorOption = (
  label: string,
  icon: ReactNode,
  route: Connector["route"],
  headStart: Connector["headStart"],
  headEnd: Connector["headEnd"],
  extra: Partial<ShapeElement> = {},
): MarkOption => ({
  icon,
  label,
  // The panel merges these over the connector the option is applied to.
  patch: { connector: { route, headStart, headEnd } as Connector, ...extra },
  matches: ({ connector, dashed }) =>
    connector?.route === route &&
    connector.headStart === headStart &&
    connector.headEnd === headEnd &&
    (extra.dashed === undefined || dashed === extra.dashed),
});

export const ARROW_OPTIONS: MarkOption[] = [
  connectorOption("Straight", <MoveUpRight className={ICON} />, "straight", "none", "arrow"),
  connectorOption("Curved", <Spline className={ICON} />, "curved", "none", "arrow"),
  connectorOption("Elbow", <CornerDownRight className={ICON} />, "elbow", "none", "arrow"),
  connectorOption("Double", <MoveHorizontal className={ICON} />, "straight", "arrow", "arrow"),
];

export const LINE_OPTIONS: MarkOption[] = [
  connectorOption("Straight", <Slash className={ICON} />, "straight", "none", "none"),
  connectorOption("Curved", <Spline className={ICON} />, "curved", "none", "none"),
  connectorOption("Elbow", <CornerDownRight className={ICON} />, "elbow", "none", "none"),
  connectorOption("Ends", <Link2 className={ICON} />, "straight", "dot", "dot"),
];

const calloutOption = (
  label: string,
  icon: ReactNode,
  calloutKind: NonNullable<ShapeElement["calloutKind"]>,
  cornerRadius?: number,
): MarkOption => ({
  icon,
  label,
  patch: { calloutKind, ...(cornerRadius === undefined ? {} : { cornerRadius }) },
  matches: (subject) =>
    subject.calloutKind === calloutKind &&
    (cornerRadius === undefined || subject.cornerRadius === cornerRadius),
});

export const CALLOUT_OPTIONS: MarkOption[] = [
  calloutOption("Speech", <MessageSquare className={ICON} />, "speech", 28),
  calloutOption("Pill", <RectangleHorizontal className={ICON} />, "speech", 200),
  calloutOption("Square", <Square className={ICON} />, "speech", 0),
  calloutOption("Round", <MessageCircle className={ICON} />, "round"),
  calloutOption("Thought", <Cloud className={ICON} />, "thought"),
  calloutOption("Shout", <Zap className={ICON} />, "shout"),
  calloutOption("Label", <Tag className={ICON} />, "label", 12),
];
