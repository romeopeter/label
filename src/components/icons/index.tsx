import type { CSSProperties, ReactNode } from "react";

interface IconProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
  viewBox?: string;
  children?: ReactNode;
}

export const Icon = ({
  children,
  size = 18,
  className = "",
  style,
  strokeWidth = 1.5,
  viewBox = "0 0 24 24",
}: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
  >
    {children}
  </svg>
);

type P = Omit<IconProps, "children" | "viewBox">;

export const IconSparkle = (p: P) => (
  <Icon {...p}>
    <path d="M12 3v4M12 17v4M5 12H1M23 12h-4M6.2 6.2l2.8 2.8M15 15l2.8 2.8M6.2 17.8 9 15M15 9l2.8-2.8" />
  </Icon>
);
export const IconUpload = (p: P) => (
  <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></Icon>
);
export const IconGrid = (p: P) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Icon>
);
export const IconImage = (p: P) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="1.6" />
    <path d="m21 15-5-5L5 21" />
  </Icon>
);
export const IconPen = (p: P) => (
  <Icon {...p}><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></Icon>
);
export const IconPattern = (p: P) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </Icon>
);
export const IconPhone = (p: P) => (
  <Icon {...p}><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></Icon>
);
export const IconCrosshair = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <circle cx="12" cy="12" r="1.5" />
  </Icon>
);
export const IconCube = (p: P) => (
  <Icon {...p}>
    <path d="m21 16.5-9 5-9-5V8l9-5 9 5v8.5Z" />
    <path d="m3.3 7.7 8.7 5 8.7-5M12 12.7V22" />
  </Icon>
);
export const IconShadow = (p: P) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="6" />
    <path d="M14 14a6 6 0 0 1-4 4 6 6 0 0 0 8-8 6 6 0 0 1-4 4Z" />
  </Icon>
);
export const IconBorder = (p: P) => (
  <Icon {...p}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /></Icon>
);
export const IconLayout = (p: P) => (
  <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></Icon>
);
export const IconType = (p: P) => (
  <Icon {...p}><path d="M4 7V5h16v2M9 5v14M15 19H9" /></Icon>
);
export const IconStamp = (p: P) => (
  <Icon {...p}><path d="M5 22h14M9 14V9a3 3 0 0 1 6 0v5M5 18h14a0 0 0 0 1 0 0v0a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v0Z" /></Icon>
);
export const IconBrand = (p: P) => (
  <Icon {...p}><path d="M12 3 4 7v5c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7l-8-4Z" /></Icon>
);
export const IconMotion = (p: P) => (
  <Icon {...p}><path d="M5 3v18l16-9-16-9Z" /></Icon>
);
export const IconGear = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Icon>
);
export const IconPlus = (p: P) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const IconUndo = (p: P) => <Icon {...p}><path d="M3 7v6h6M21 17a8 8 0 0 0-13.7-5.7L3 13" /></Icon>;
export const IconRedo = (p: P) => <Icon {...p}><path d="M21 7v6h-6M3 17a8 8 0 0 1 13.7-5.7L21 13" /></Icon>;
export const IconEye = (p: P) => (
  <Icon {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" /><circle cx="12" cy="12" r="3" /></Icon>
);
export const IconChevDown = (p: P) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>;
export const IconChevUp = (p: P) => <Icon {...p}><path d="m6 15 6-6 6 6" /></Icon>;
export const IconChevRight = (p: P) => <Icon {...p}><path d="m9 6 6 6-6 6" /></Icon>;
export const IconBell = (p: P) => (
  <Icon {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /></Icon>
);
export const IconDownload = (p: P) => (
  <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></Icon>
);
export const IconArrowRight = (p: P) => (
  <Icon {...p}><path d="M5 12h14M13 5l7 7-7 7" /></Icon>
);
export const IconLock = (p: P) => (
  <Icon {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 1 1 8 0v4" /></Icon>
);
export const IconInfo = (p: P) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></Icon>
);
export const IconClipboard = (p: P) => (
  <Icon {...p}>
    <rect x="8" y="3" width="8" height="4" rx="1" />
    <path d="M16 5h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
  </Icon>
);
export const IconClose = (p: P) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>;
export const IconTrash = (p: P) => (
  <Icon {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" /></Icon>
);
export const IconCrop = (p: P) => <Icon {...p}><path d="M6 2v16a2 2 0 0 0 2 2h16M2 6h16a2 2 0 0 1 2 2v16" /></Icon>;
export const IconHighlight = (p: P) => <Icon {...p}><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="9" /></Icon>;
export const IconPadding = (p: P) => (
  <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="1.5" /><rect x="7" y="7" width="10" height="10" rx="1" /></Icon>
);
export const IconBlur = (p: P) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" strokeDasharray="2 3" /></Icon>
);
export const IconDots = (p: P) => (
  <Icon {...p}><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></Icon>
);
export const IconArrowDR = (p: P) => <Icon {...p}><path d="M7 7h10v10M7 17 17 7" /></Icon>;
export const IconRect = (p: P) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="1.5" /></Icon>;
export const IconCircle = (p: P) => <Icon {...p}><circle cx="12" cy="12" r="9" /></Icon>;
export const IconBlob = (p: P) => <Icon {...p}><path d="M14 3c3 0 7 2 7 7s-2 5-3 8-3 3-7 3-9-2-9-8 5-5 6-7 3-3 6-3Z" /></Icon>;
export const IconLine = (p: P) => <Icon {...p}><path d="M4 20 20 4" /></Icon>;
export const IconHash = (p: P) => <Icon {...p}><path d="M9 3 6 21M18 3l-3 18M3 9h18M2 15h18" /></Icon>;
export const IconEmoji = (p: P) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M9 10h.01M15 10h.01M8 15s1.5 2 4 2 4-2 4-2" /></Icon>
);
export const IconBadge = (p: P) => <Icon {...p}><path d="M12 2 14.5 5l4 .5L16 8.5 17 13l-5-2-5 2 1-4.5L5.5 5.5l4-.5L12 2Z" /></Icon>;
export const IconQR = (p: P) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v3M14 18v3h3M21 21v0" />
  </Icon>
);
export const IconWireframe = (p: P) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M3 9h18M7 14h6M7 17h10" /></Icon>
);
export const IconLabel = (p: P) => (
  <Icon {...p}>
    <path d="M20 12a2 2 0 0 0-.6-1.4l-7-7A2 2 0 0 0 11 3H4a1 1 0 0 0-1 1v7a2 2 0 0 0 .6 1.4l7 7a2 2 0 0 0 2.8 0l5.2-5.2A2 2 0 0 0 20 12Z" />
    <circle cx="7.5" cy="7.5" r=".8" />
  </Icon>
);
export const IconText = (p: P) => (
  <Icon {...p}><path d="M6 4v16M2 4h8M10 12h12M16 12v8M12 20h8" /></Icon>
);
export const IconIconBox = (p: P) => (
  <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M12 8v8M8 12h8" /></Icon>
);
export const IconReset = (p: P) => <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></Icon>;
export const IconCheck = (p: P) => <Icon {...p}><path d="m5 12 5 5 9-12" /></Icon>;
export const IconSun = (p: P) => (
  <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>
);
export const IconMoon = (p: P) => <Icon {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></Icon>;
export const IconDragHandle = (p: P) => (
  <Icon {...p}><circle cx="9" cy="6" r="1.2" /><circle cx="9" cy="12" r="1.2" /><circle cx="9" cy="18" r="1.2" /><circle cx="15" cy="6" r="1.2" /><circle cx="15" cy="12" r="1.2" /><circle cx="15" cy="18" r="1.2" /></Icon>
);
export const IconEyeOff = (p: P) => (
  <Icon {...p}><path d="M2 2l20 20M10.6 10.6a3 3 0 0 0 4.2 4.2M9.4 5.2A11 11 0 0 1 12 5c7 0 11 7 11 7a18 18 0 0 1-3.4 4.3M6.6 6.6A18 18 0 0 0 1 12s4 7 11 7a11 11 0 0 0 5.5-1.6" /></Icon>
);
export const IconLink = (p: P) => (
  <Icon {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></Icon>
);
export const IconBrandIG = (p: P) => (
  <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17" cy="7" r=".8" /></Icon>
);
export const IconBrandX = (p: P) => <Icon {...p}><path d="m4 4 16 16M20 4 4 20" /></Icon>;
export const IconBrandBluesky = (p: P) => (
  <Icon {...p}><path d="M12 14c-2-4-5-8-8-8 0 4 1 7 4 8-3 1-4 4-4 8 4 0 6-3 8-7 2 4 4 7 8 7 0-4-1-7-4-8 3-1 4-4 4-8-3 0-6 4-8 8Z" /></Icon>
);
export const IconBrandLI = (p: P) => (
  <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 10v7M7 7v.01M11 17v-4a2 2 0 0 1 4 0v4M11 13v4" /></Icon>
);
export const IconBrandFB = (p: P) => (
  <Icon {...p}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z" /></Icon>
);
export const IconBrandYT = (p: P) => (
  <Icon {...p}><rect x="2" y="6" width="20" height="12" rx="3" /><path d="m10 9 5 3-5 3V9Z" fill="currentColor" stroke="none" /></Icon>
);
export const IconBrandDribbble = (p: P) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M8 3.5c4 4 7 9 8 17.5M3.5 11c6-.5 12 .5 17 4.5M21 9c-5 1.5-12 1.5-18-1" /></Icon>
);
export const IconBrandPH = (p: P) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M10 7v10M10 7h4a3 3 0 0 1 0 6h-4" /></Icon>
);
export const IconFigma = (p: P) => (
  <Icon {...p}><path d="M9 3h6v6H9zM9 9h6a3 3 0 0 1 0 6H9zM9 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" /></Icon>
);
export const IconChrome = (p: P) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /><path d="M21.2 8H12M3.4 7.5l4.4 7.6M14.5 21.5l4.3-7.5" /></Icon>
);
