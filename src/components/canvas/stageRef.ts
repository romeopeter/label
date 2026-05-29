import type Konva from "konva";

// Singleton stage ref so exporters can grab it.
let stage: Konva.Stage | null = null;

export const setStage = (s: Konva.Stage | null) => { stage = s; };
export const getStage = () => stage;
