import type { Tool } from "../../store/editor";
import { UploadsPanel } from "./UploadsPanel";
import { BackgroundPanel } from "./BackgroundPanel";
import { MockupPanel } from "./MockupPanel";
import { AnnotationPanel } from "./AnnotationPanel";
import { HeaderPanel } from "./HeaderPanel";
import { PositionPanel } from "./PositionPanel";
import { ShadowPanel } from "./ShadowPanel";
import { BorderPanel } from "./BorderPanel";
import { WatermarkPanel } from "./WatermarkPanel";
import {
  AiPanel, TemplatesPanel, ImagesPanel, ThreeDPanel, LayoutPanel,
  BrandsPanel, MotionPanel, CustomizePanel,
} from "./StubPanels";

interface Props {
  activeTool: Tool;
  onOpenCustomizeModal: () => void;
}

export const PanelHost = ({ activeTool, onOpenCustomizeModal }: Props) => {
  switch (activeTool) {
    case "ai": return <AiPanel />;
    case "uploads": return <UploadsPanel />;
    case "templates": return <TemplatesPanel />;
    case "images": return <ImagesPanel />;
    case "annotation": return <AnnotationPanel />;
    case "background": return <BackgroundPanel />;
    case "mockup": return <MockupPanel />;
    case "position": return <PositionPanel />;
    case "3d": return <ThreeDPanel />;
    case "shadow": return <ShadowPanel />;
    case "border": return <BorderPanel />;
    case "layout": return <LayoutPanel />;
    case "header": return <HeaderPanel />;
    case "watermark": return <WatermarkPanel />;
    case "brands": return <BrandsPanel />;
    case "motion": return <MotionPanel />;
    case "customize": return <CustomizePanel onOpenModal={onOpenCustomizeModal} />;
    default: return null;
  }
};
