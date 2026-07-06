import {
  Type,
  ArrowUpRight,
  Square as SquareIcon,
  Circle as CircleIcon,
  Highlighter,
  MessageCircle,
  PenLine,
  QrCode,
  Smile,
  Image,
  Pencil,
  BadgeCheck,
  PlusSquare,
  Hash,
  LucideSpline as Line,
} from "lucide-react";
import { useEditor } from "@/store/editor";
import type { ShapeKind } from "@/types";
import { PanelTitle, SectionLabel, PanelHelp } from "./primitives";

/* ------------------------------------------------------------------------------------------- */

const ITEMS: {
  icon: React.ReactNode;
  label: string;
  action: "shape" | "text" | "image" | "vector" | "other";
  shape?: ShapeKind;
  variant?: "heading" | "body";
}[] = [
  {
    icon: <Type className="h-4 w-4" />,
    label: "Text",
    action: "text",
    variant: "heading",
  },
  {
    icon: <SquareIcon className="h-4 w-4" />,
    label: "Rectangle",
    action: "shape",
    shape: "rect",
  },
  {
    icon: <CircleIcon className="h-4 w-4" />,
    label: "Ellipse",
    action: "shape",
    shape: "ellipse",
  },
  {
    icon: <ArrowUpRight className="h-4 w-4" />,
    label: "Arrow",
    action: "shape",
    shape: "arrow",
  },
  {
    icon: <Line className="h-4 w-4" />,
    label: "Line",
    action: "shape",
    shape: "line",
  },
  {
    icon: <Highlighter className="h-4 w-4" />,
    label: "Highlight",
    action: "shape",
    shape: "highlight",
  },
  {
    icon: <MessageCircle className="h-4 w-4" />,
    label: "Callout",
    action: "shape",
    shape: "callout",
  },
  {
    icon: <QrCode className="h-4 w-4" />,
    label: "QR Code",
    action: "shape",
    shape: "qr-code",
  },
  {
    icon: <Smile className="h-4 w-4" />,
    label: "Emoji",
    action: "vector",
    shape: "vector",
  },
  {
    icon: <Image className="h-4 w-4" />,
    label: "Image",
    action: "image",
    shape: "image",
  },
  {
    icon: <Pencil className="h-4 w-4" />,
    label: "Draw",
    action: "shape",
    shape: "pencil",
  },
  {
    icon: <Hash className="size-4" />,
    label: "Number",
    action: "shape",
    shape: "number",
  },
  {
    icon: <BadgeCheck className="size-4.5" />, // badges and labels
    label: "Badge",
    action: "other",
    shape: "other",
  },
  {
    icon: <PlusSquare className="size-4.5" />,
    label: "Icons",
    action: "image",
    shape: "image",
  },
];

export const AnnotationPanel = () => {
  const addText = useEditor((s) => s.addText);
  const addShape = useEditor((s) => s.addShape);

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
      <PanelTitle>
        <div className="flex items-center gap-1">
          <span>ANNOTATION</span> <PenLine className="h-4.5 w-4.5" />
        </div>
      </PanelTitle>

      <SectionLabel>ADD ANNOTATION</SectionLabel>

      <div className="grid grid-cols-5 gap-1">
        {ITEMS.map((it) => (
          <button
            key={it.label}
            type="button"
            onClick={() => {
              if (it.action === "text" && it.variant) addText(it.variant);
              if (it.action === "shape" && it.shape) addShape(it.shape);
            }}
            className="flex flex-col items-center gap-1 rounded-md px-0.5 py-2 text-[9.5px] text-text-muted transition-colors hover:bg-p-200/10 hover:text-text [&:hover_.annot-ic]:text-t-400 cursor-pointer group"
          >
            <span className="annot-ic flex h-[30px] w-[30px] items-center justify-center rounded-md bg-p-50/[0.04]">
              {it.icon}
            </span>
            <span className="leading-none">{it.label}</span>
          </button>
        ))}
      </div>

      <PanelHelp>
        Click to add — then drag, resize, or double-click text to edit.
      </PanelHelp>
    </div>
  );
};
