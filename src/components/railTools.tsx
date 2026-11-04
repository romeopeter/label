import type { ReactNode } from "react";
import {
  // Sparkles,
  Upload,
  // LayoutGrid,
  Image,
  PenLine,
  LayoutDashboard,
  Smartphone,
  Crosshair,
  Box,
  CircleDashed,
  Square,
  // Columns,
  Type,
  Stamp,
  // Award,
  // Play,
} from "lucide-react";
import type { Tool } from "@/store/editor";

interface ToolDef {
  key: Tool;
  label: string;
  icon: ReactNode;
  pro?: boolean;
  exclusive?: boolean;
}

export const TOOLS: ToolDef[] = [
  // { key: "ai", label: "AI", icon: <Sparkles className="h-[18px] w-[18px]" /> },
  {
    key: "uploads",
    label: "Uploads",
    icon: <Upload className="h-4.5 w-4.5" />,
  },
  // {
  //   key: "templates",
  //   label: "Templates",
  //   icon: <LayoutGrid className="h-4.5 w-4.5" />,
  // },
  {
    key: "images",
    label: "Images",
    icon: <Image className="h-4.5 w-4.5" />,
  },
  {
    key: "annotation",
    label: "Mark",
    icon: <PenLine className="h-4.5 w-4.5" />,
  },
  {
    key: "background",
    label: "Background",
    icon: <LayoutDashboard className="h-4.5 w-4.5" />,
  },
  {
    key: "mockup",
    label: "Mockup",
    icon: <Smartphone className="h-4.5 w-4.5" />,
  },
  {
    key: "position",
    label: "Position",
    icon: <Crosshair className="h-4.5 w-4.5" />,
  },
  { key: "3d", label: "3D", icon: <Box className="h-4.5 w-4.5" /> },
  {
    key: "shadow",
    label: "Shadow",
    icon: <CircleDashed className="h-4.5 w-4.5" />,
  },
  {
    key: "border",
    label: "Corner",
    icon: <Square className="h-4.5 w-4.5" />,
  },
  // {
  //   key: "layout",
  //   label: "Layout",
  //   icon: <Columns className="h-4.5 w-4.5" />,
  //   pro: true,
  // },
  {
    key: "header",
    label: "Text",
    icon: <Type className="h-4.5 w-4.5" />,
  },
  {
    key: "watermark",
    label: "Watermark",
    icon: <Stamp className="h-4.5 w-4.5" />,
  },
  // {
  //   key: "brands",
  //   label: "Brands",
  //   icon: <Award className="h-4.5 w-4.5" />,
  //   pro: true,
  // },
  // {
  //   key: "motion",
  //   label: "Motion",
  //   icon: <Play className="h-4.5 w-4.5" />,
  //   exclusive: true,
  // },
];
