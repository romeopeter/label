import type { ImageEdit } from "@/types";
import {
  colorOf,
  gradeOf,
  LENS_MODES,
  NO_ADJUST,
  styleOf,
  variantOf,
} from "./presets";
import { BLUR, GLOW_PREP, LENS, MAIN, VERTEX } from "./shader";

/*
  One WebGL context, shared. Browsers allow only a handful per page, so a context
  per image would start killing the oldest. Each result is copied out to the
  caller's own 2D canvas, which is what Konva and export actually read.
*/

/** The largest side an edited picture is worked on at. */
const MAX_SIDE = 4096;
/** Blur passes work small and scale back up: far faster, and it looks the same. */
const SOFT_SIDE = 256;
const GLOW_SIDE = 512;
const LENS_SIDE = 1024;
/** Lens blur radius at full strength, as a fraction of the longest side. */
const LENS_RADIUS = 0.035;

type Crop = NonNullable<import("@/types").ImageElement["crop"]>;

interface Program {
  program: WebGLProgram;
  uniform: (name: string) => WebGLUniformLocation | null;
}

interface Target {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  width: number;
  height: number;
}

const compile = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create a shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "Shader failed to compile");
  }
  return shader;
};

const link = (gl: WebGL2RenderingContext, fragment: string): Program => {
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create a program");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "Program failed to link");
  }

  const locations = new Map<string, WebGLUniformLocation | null>();
  return {
    program,
    uniform: (name) => {
      if (!locations.has(name)) {
        locations.set(name, gl.getUniformLocation(program, name));
      }
      return locations.get(name) ?? null;
    },
  };
};

const DOUBLE_EXPOSURE_CODE = 4;

/** The second image of a double exposure. */
export type EditOverlay = HTMLImageElement | HTMLCanvasElement;

const fitSide = (width: number, height: number, side: number): [number, number] => {
  const ratio = Math.min(side / Math.max(width, height), 1);
  return [
    Math.max(1, Math.round(width * ratio)),
    Math.max(1, Math.round(height * ratio)),
  ];
};

const createRenderer = () => {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;

  const programs = {
    blur: link(gl, BLUR),
    glowPrep: link(gl, GLOW_PREP),
    lens: link(gl, LENS),
    main: link(gl, MAIN),
  };

  // One triangle that covers the whole viewport.
  const buffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.disable(gl.BLEND);

  const newTexture = () => {
    const texture = gl.createTexture();
    if (!texture) throw new Error("Could not create a texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  };

  const sourceTexture = newTexture();
  const overlayTexture = newTexture();
  const blankTexture = newTexture();
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));

  // Re-uploading on every slider tick would be the slowest part of a render.
  let uploadedSource: TexImageSource | null = null;
  let uploadedOverlay: TexImageSource | null = null;

  const upload = (texture: WebGLTexture, source: TexImageSource) => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    // Mipmaps let the small blur passes read a clean, already shrunken picture.
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  };

  const targets = new Map<string, Target>();

  const targetOf = (name: string, width: number, height: number): Target => {
    const existing = targets.get(name);
    if (existing && existing.width === width && existing.height === height) return existing;

    const texture = existing?.texture ?? newTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    const framebuffer = existing?.framebuffer ?? gl.createFramebuffer();
    if (!framebuffer) throw new Error("Could not create a framebuffer");
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    const target = { texture, framebuffer, width, height };
    targets.set(name, target);
    return target;
  };

  /** Draws a program into a target, or onto the canvas when there's none. */
  const pass = (
    program: Program,
    to: Target | null,
    width: number,
    height: number,
    bind: (uniform: Program["uniform"]) => void,
  ) => {
    gl.useProgram(program.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, to?.framebuffer ?? null);
    gl.viewport(0, 0, width, height);
    gl.uniform1f(program.uniform("uFlip"), to ? 0 : 1);
    bind(program.uniform);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const bindTexture = (unit: number, texture: WebGLTexture) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  };

  /** Blurs a target in place. Each round spreads further than a bigger step could. */
  const blur = (target: Target, radius: number, rounds = 2) => {
    const spare = targetOf(`${target.width}x${target.height}:spare`, target.width, target.height);
    const { width, height } = target;
    for (let round = 0; round < rounds; round++) {
      bindTexture(0, target.texture);
      pass(programs.blur, spare, width, height, (u) => {
        gl.uniform1i(u("uTex"), 0);
        gl.uniform2f(u("uStep"), radius / 3 / width, 0);
      });
      bindTexture(0, spare.texture);
      pass(programs.blur, target, width, height, (u) => {
        gl.uniform1i(u("uTex"), 0);
        gl.uniform2f(u("uStep"), 0, radius / 3 / height);
      });
    }
  };

  const render = (
    source: HTMLCanvasElement,
    edit: ImageEdit,
    output: HTMLCanvasElement,
    overlay: EditOverlay | null,
  ) => {
    const { width, height } = source;
    const adjust = { ...NO_ADJUST, ...edit.adjust };

    if (uploadedSource !== source) {
      upload(sourceTexture, source);
      uploadedSource = source;
    }

    const style = edit.style ? styleOf(edit.style.id) : undefined;
    const variant = style && edit.style ? variantOf(style, edit.style.variant) : undefined;
    const strength = (edit.style?.strength ?? 0) / 100;
    const p = variant?.p ?? [0, 0, 0, 0];
    const q = variant?.q ?? [0, 0, 0, 0];

    // Only build what this edit reads: most edits skip most of these.
    let soft = blankTexture;
    if (adjust.ambience || adjust.highlights || adjust.shadows) {
      const [w, h] = fitSide(width, height, SOFT_SIDE);
      const target = targetOf("soft", w, h);
      bindTexture(0, sourceTexture);
      pass(programs.blur, target, w, h, (u) => {
        gl.uniform1i(u("uTex"), 0);
        gl.uniform2f(u("uStep"), 0, 0);
      });
      blur(target, 6);
      soft = target.texture;
    }

    let glow = blankTexture;
    if (style && (style.code === 1 || style.code === 6)) {
      const [w, h] = fitSide(width, height, GLOW_SIDE);
      const target = targetOf("glow", w, h);
      bindTexture(0, sourceTexture);
      pass(programs.glowPrep, target, w, h, (u) => {
        gl.uniform1i(u("uTex"), 0);
        gl.uniform1f(u("uThreshold"), p[0]);
        gl.uniform3f(u("uTint"), q[0], q[1], q[2]);
      });
      blur(target, p[1]);
      glow = target.texture;
    }

    let lens = blankTexture;
    const lensAmount = (edit.lensBlur?.amount ?? 0) / 100;
    const lensCode =
      lensAmount > 0
        ? (LENS_MODES.find((m) => m.id === edit.lensBlur?.mode)?.code ?? 0)
        : 0;
    if (lensCode) {
      const [w, h] = fitSide(width, height, LENS_SIDE);
      const target = targetOf("lens", w, h);
      const reach = Math.max(width, height) * LENS_RADIUS * lensAmount;
      bindTexture(0, sourceTexture);
      pass(programs.lens, target, w, h, (u) => {
        gl.uniform1i(u("uTex"), 0);
        gl.uniform2f(u("uRadius"), reach / width, reach / height);
      });
      lens = target.texture;
    }

    let overlayScale: [number, number] = [1, 1];
    if (overlay && style?.code === DOUBLE_EXPOSURE_CODE) {
      if (uploadedOverlay !== overlay) {
        upload(overlayTexture, overlay);
        uploadedOverlay = overlay;
      }
      // Cover: the overlay fills the picture without being stretched.
      const ratio =
        overlay instanceof HTMLImageElement
          ? width / height / (overlay.naturalWidth / overlay.naturalHeight)
          : width / height / (overlay.width / overlay.height);
      overlayScale = ratio > 1 ? [1, 1 / ratio] : [ratio, 1];
    }

    const color = edit.color ? colorOf(edit.color.id) : undefined;
    const grade = edit.grade ? gradeOf(edit.grade.id) : undefined;
    const gradeAmount = (edit.grade?.strength ?? 0) / 100;
    const scaled = (values: readonly number[] | undefined) =>
      [0, 1, 2].map((i) => (values?.[i] ?? 0) * gradeAmount) as [number, number, number];

    canvas.width = width;
    canvas.height = height;

    bindTexture(0, sourceTexture);
    bindTexture(1, soft);
    bindTexture(2, glow);
    bindTexture(3, lens);
    bindTexture(4, overlay ? overlayTexture : blankTexture);

    pass(programs.main, null, width, height, (u) => {
      gl.uniform1i(u("uSrc"), 0);
      gl.uniform1i(u("uSoft"), 1);
      gl.uniform1i(u("uGlow"), 2);
      gl.uniform1i(u("uLens"), 3);
      gl.uniform1i(u("uOverlay"), 4);
      gl.uniform2f(u("uRes"), width, height);
      gl.uniform2f(u("uOverlayScale"), overlayScale[0], overlayScale[1]);

      gl.uniform1f(u("uBrightness"), adjust.brightness / 100);
      gl.uniform1f(u("uContrast"), adjust.contrast / 100);
      gl.uniform1f(u("uHighlights"), adjust.highlights / 100);
      gl.uniform1f(u("uShadows"), adjust.shadows / 100);
      gl.uniform1f(u("uAmbience"), adjust.ambience / 100);
      gl.uniform1f(u("uSaturation"), adjust.saturation / 100);
      gl.uniform1f(u("uWarmth"), adjust.warmth / 100);

      const tint = color?.tint ?? [1, 1, 1];
      gl.uniform3f(u("uTint"), tint[0], tint[1], tint[2]);
      gl.uniform1f(u("uTintAmount"), color ? (edit.color?.strength ?? 0) / 100 : 0);

      gl.uniform3fv(u("uGradeShadows"), scaled(grade?.shadows));
      gl.uniform3fv(u("uGradeHighlights"), scaled(grade?.highlights));
      gl.uniform1f(u("uGradeContrast"), (grade?.contrast ?? 0) * gradeAmount);
      gl.uniform1f(u("uGradeSaturation"), 1 + ((grade?.saturation ?? 1) - 1) * gradeAmount);
      gl.uniform1f(u("uGradeLift"), (grade?.lift ?? 0) * gradeAmount);

      gl.uniform1i(u("uLensMode"), lensCode);
      gl.uniform1i(u("uStyle"), style?.code ?? 0);
      gl.uniform4f(u("uP"), p[0], p[1], p[2], p[3]);
      gl.uniform4f(u("uQ"), q[0], q[1], q[2], q[3]);
      gl.uniform1f(u("uStrength"), strength);
    });

    output.width = width;
    output.height = height;
    output.getContext("2d")?.drawImage(canvas, 0, 0);
  };

  return { canvas, render };
};

let renderer: ReturnType<typeof createRenderer> | undefined;

const getRenderer = () => {
  if (renderer !== undefined) return renderer;
  try {
    renderer = createRenderer();
  } catch (error) {
    console.error("Image editing is unavailable:", error);
    renderer = null;
  }
  // The GPU can drop the context, for example on sleep. Rebuild on the next render.
  renderer?.canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    renderer = undefined;
  });
  return renderer;
};

export const isImageEditSupported = () => !!getRenderer();

/**
 * The part of the image an edit works on. Baking the crop in first means effects
 * centred on the picture, like fish-eye, centre on what you can see.
 */
export const prepareSource = (image: HTMLImageElement, crop: Crop | undefined) => {
  const area = crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const sw = image.naturalWidth * area.width;
  const sh = image.naturalHeight * area.height;
  const [width, height] = fitSide(sw, sh, MAX_SIDE);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas
    .getContext("2d")
    ?.drawImage(
      image,
      image.naturalWidth * area.x,
      image.naturalHeight * area.y,
      sw,
      sh,
      0,
      0,
      width,
      height,
    );
  return canvas;
};

/** Returns false if the device can't run it, leaving `output` untouched. */
export const renderEdit = (
  source: HTMLCanvasElement,
  edit: ImageEdit,
  output: HTMLCanvasElement,
  overlay: EditOverlay | null = null,
) => {
  const active = getRenderer();
  if (!active) return false;
  active.render(source, edit, output, overlay);
  return true;
};
