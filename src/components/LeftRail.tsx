import type { ReactNode } from "react";
import {
  // Sparkles,
  Upload,
  // LayoutGrid,
  // Image,
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
  Settings,
  Plus,
} from "lucide-react";
import { useEditor, type Tool } from "@/store/editor";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------------- */

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
  // {
  //   key: "images",
  //   label: "Images",
  //   icon: <Image className="h-4.5 w-4.5" />,
  // },
  {
    key: "annotation",
    label: "Annotation",
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
    label: "Border",
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

interface Props {
  hiddenTools: Record<string, boolean>;
}

export const LeftRail = ({ hiddenTools }: Props) => {
  const activeTool = useEditor((s) => s.activeTool);
  const setActiveTool = useEditor((s) => s.setActiveTool);
  const isPro = useEditor((s) => s.isPro);
  const visible = TOOLS.filter((t) => !hiddenTools[t.key]);

  return (
    <nav className="relative z-20 flex w-17 shrink-0 flex-col border-r border-hairline bg-panel">
      <div className="flex-1 overflow-y-auto px-1 py-1.5 [&::-webkit-scrollbar]:hidden scrollbar-none space-y-0.5">
        {visible.map((tool) => {
          const isActive = activeTool === tool.key;

          return (
            <button
              key={tool.key}
              type="button"
              onClick={() => setActiveTool(tool.key)}
              className={cn(
                "relative flex w-full flex-col items-center gap-0.75 rounded-lg px-0.5 py-2 text-[9.5px] font-medium tracking-[0.01em] transition-colors cursor-pointer",
                isActive
                  ? "rail-active-underline bg-p-200/[0.14] text-text [&_svg]:text-t-400"
                  : "text-text-muted hover:bg-p-200/10 hover:text-text [&:hover_svg]:text-t-400",
              )}
            >
              <span className="flex items-center justify-center">
                {tool.icon}
              </span>

              <span className="leading-[1.1]">{tool.label}</span>

              {tool.pro && !isPro && (
                <span className="absolute right-2 top-1.5 h-1.25 w-1.25 rounded-full bg-a-200" />
              )}

              {tool.exclusive && (
                <span className="absolute right-2 top-1.5 h-1.25 w-1.25 rounded-full bg-t-400 shadow-[0_0_0_2px_color-mix(in_srgb,#1D9E75_20%,transparent)]" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-2 px-1 pb-3 pt-2">
        <button
          type="button"
          title="Add"
          onClick={() => setActiveTool("annotation")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-t-400 text-white shadow-[0_4px_14px_color-mix(in_srgb,#1D9E75_35%,transparent),0_0_0_1px_rgba(255,255,255,0.08)_inset] transition-[background,transform] hover:-translate-y-px hover:bg-t-500 cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" />
        </button>
        <div className="my-0.5 h-px w-7 bg-hairline" />

        <button
          type="button"
          onClick={() => setActiveTool("customize")}
          className={cn(
            "relative flex w-full flex-col items-center gap-0.75 rounded-lg px-0.5 py-2 text-[9.5px] font-medium tracking-[0.01em] transition-colors cursor-pointer",
            activeTool === "customize"
              ? "bg-p-200/[0.14] text-text [&_svg]:text-t-400"
              : "text-text-muted hover:bg-p-200/10 hover:text-text [&:hover_svg]:text-t-400",
          )}
        >
          <span className="flex items-center justify-center">
            <Settings className="h-4.5 w-4.5" />
          </span>
          <span className="leading-[1.1]">Customize</span>
        </button>
      </div>
    </nav>
  );
};
