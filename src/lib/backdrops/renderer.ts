import { BLUR, VERTEX } from "@/lib/imageEdit/shader";
import type { BackdropLook, BackdropStyle } from "@/types/backdrop";
import type { BackgroundEffects } from "@/types";
import { hexToLinear, randomFrom } from "./colors";
import { BACKDROP_FINISH, BACKDROP_MAIN } from "./shader";

/*
  A WebGL context of its own, separate from image editing's, so the two never wait
  on or overwrite each other's work. Like that one, it's shared by every background
  and copies each result out to the caller's 2D canvas, which is what Konva and
  export read.

  It draws abstract backgrounds, and it puts the background effects (blur, frost,
  grain and vignette) on any background: another type is drawn to a 2D canvas
  first and comes in as the source.
*/

/** What to put the effects on: an abstract background, or a picture of another type. */
export type BackgroundSource = { look: BackdropLook } | { canvas: HTMLCanvasElement };

/** The largest side drawn, whatever the export scale asks for. */
const MAX_SIDE = 8192;
/** Blurs work at a size where they need at most this many pixels of radius. */
const BLUR_WORKING_RADIUS = 6;

const STYLE_CODE: Record<BackdropStyle, number> = {
  soft: 0,
  waves: 1,
  streaks: 2,
  glow: 3,
  glass: 4,
  aurora: 5,
  silk: 6,
  marble: 7,
};

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

/**
 * Where the shapes go, from the seed. Positions are in units of the canvas's
 * shorter side, measured from its middle, so they reach the edges of any shape.
 */
const placesOf = (style: BackdropStyle, seed: number, half: [number, number]) => {
  const random = randomFrom(seed);
  const places = new Float32Array(64);
  const set = (i: number, x: number, y: number, z: number, w: number) => places.set([x, y, z, w], i * 4);
  const spread = (side: number) => (random() * 2 - 1) * side * 0.9;
  const between = (from: number, to: number) => from + random() * (to - from);

  const softPatches = () => {
    const colors = [1, 2, 3, 1, 2];
    colors.forEach((color, i) => set(i, spread(half[0]), spread(half[1]), 0.3 + random() * 0.45, color));
    set(6, random() * 40, random() * 40, 0, 0);
  };

  if (style === "soft") {
    softPatches();
  } else if (style === "waves") {
    for (let i = 0; i < 4; i++) {
      const offset = half[1] * (-0.55 + i * 0.38) + (random() - 0.5) * 0.08;
      set(i, offset, 0.05 + random() * 0.1, 1.6 + random() * 3, random() * Math.PI * 2);
    }
    set(4, (random() - 0.5) * 1.2, random() * 40, random() * 40, 0);
  } else if (style === "streaks") {
    // Always on a diagonal, one way or the other.
    const angle = (0.45 + random() * 0.5) * (random() < 0.5 ? 1 : -1);
    set(0, angle, random() * 40, random() * 40, random() * Math.PI * 2);
    set(1, (random() - 0.5) * 0.4, 0, 0, 0);
  } else if (style === "glass") {
    softPatches();
    // Three panels, tilted together, spread from one side to the other.
    const tilt = between(-0.35, 0.35);
    const fluted = Math.floor(random() * 4);
    for (let i = 0; i < 3; i++) {
      const across = (i - 1) * half[0] * 0.55 + (random() - 0.5) * 0.15;
      set(8 + i * 2, across, (random() - 0.5) * half[1] * 0.6, between(0.14, 0.26), between(0.25, half[1] * 0.85));
      // Usually one panel is fluted; one time in four, none is.
      set(9 + i * 2, tilt + (random() - 0.5) * 0.2, between(0.03, 0.08), i === fluted ? between(18, 30) : 0, 0);
    }
    set(14, between(-2.6, -0.6), 0, 0, 0);
  } else if (style === "aurora") {
    for (let i = 0; i < 3; i++) {
      set(i, between(-0.12, 0.12) - i * 0.06, between(0.06, 0.14), between(0.12, 0.26), random() * 40);
    }
  } else if (style === "silk") {
    const along = random() * Math.PI;
    const wave = (i: number, angle: number, frequency: number, height: number) =>
      set(i, Math.cos(angle) * frequency, Math.sin(angle) * frequency, random() * Math.PI * 2, height / frequency);
    wave(0, along, between(4.5, 6), 1.0);
    wave(1, along + between(0.2, 0.4), between(8, 11), 0.55);
    wave(2, along + between(1.1, 1.5), between(2, 3), 0.45);
    wave(3, along - between(0.1, 0.3), between(13, 16), 0.25);
    set(4, random() * 6, random() * 6, between(-2.5, -0.6), between(-0.4, 0.4));
  } else if (style === "marble") {
    set(0, random() * 40, random() * 40, random() * 40, random() * 40);
    set(1, random() * 40, random() * 40, random() * 40, random() * 40);
    set(2, 0, between(0.8, 1.2), between(1.1, 1.6), 0);
  } else {
    const colors = [1, 2, 3, 2];
    colors.forEach((color, i) => set(i, spread(half[0]), spread(half[1]), 0.22 + random() * 0.3, color));
  }
  return places;
};

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
      if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));
      return locations.get(name) ?? null;
    },
  };
};

const createRenderer = () => {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;

  const programs = {
    main: link(gl, BACKDROP_MAIN),
    blur: link(gl, BLUR),
    finish: link(gl, BACKDROP_FINISH),
  };
  const maxSide = Math.min(MAX_SIDE, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);

  // One triangle that covers the whole viewport.
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.BLEND);

  const targets = new Map<string, Target>();
  const targetOf = (name: string, width: number, height: number): Target => {
    const existing = targets.get(name);
    if (existing && existing.width === width && existing.height === height) return existing;
    if (existing) {
      gl.deleteTexture(existing.texture);
      gl.deleteFramebuffer(existing.framebuffer);
    }
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!texture || !framebuffer) throw new Error("Could not create a render target");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(width, height))) + 1, gl.RGBA8, width, height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    const target = { texture, framebuffer, width, height };
    targets.set(name, target);
    return target;
  };

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
    gl.uniform1f(program.uniform("uFlip"), 0);
    bind(program.uniform);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const readFrom = (texture: WebGLTexture, smooth: boolean) => {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, smooth ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  };

  const render = (
    source: BackgroundSource,
    effects: BackgroundEffects,
    size: { width: number; height: number },
    requestedScale: number,
    out: HTMLCanvasElement,
  ) => {
    const scale = Math.min(requestedScale, maxSide / Math.max(size.width, size.height));
    const width = Math.max(1, Math.round(size.width * scale));
    const height = Math.max(1, Math.round(size.height * scale));
    const shorter = Math.min(size.width, size.height);
    const half: [number, number] = [size.width / shorter / 2, size.height / shorter / 2];

    const drawn = targetOf("drawn", width, height);
    if ("look" in source) {
      const { look } = source;
      pass(programs.main, drawn, width, height, (u) => {
        gl.uniform2f(u("uSize"), size.width, size.height);
        gl.uniform1f(u("uPixel"), 1 / (shorter * scale));
        gl.uniform1i(u("uStyle"), STYLE_CODE[look.style]);
        gl.uniform3fv(u("uColors"), look.colors.flatMap(hexToLinear));
        gl.uniform4fv(u("uP"), placesOf(look.style, look.seed, half));
      });
    } else {
      // Brought to the exact size first, since the caller's rounding may differ.
      let picture = source.canvas;
      if (picture.width !== width || picture.height !== height) {
        const sized = document.createElement("canvas");
        sized.width = width;
        sized.height = height;
        sized.getContext("2d")?.drawImage(picture, 0, 0, width, height);
        picture = sized;
      }
      gl.bindTexture(gl.TEXTURE_2D, drawn.texture);
      // The top row goes to v = 1, as everything here expects.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, picture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }

    let result = drawn;
    const radius = effects.blur * scale;
    if (radius > 0.25) {
      // Shrunk first, so a wide blur costs no more than a narrow one.
      const shrink = Math.max(1, radius / BLUR_WORKING_RADIUS);
      const smallWidth = Math.max(1, Math.ceil(width / shrink));
      const smallHeight = Math.max(1, Math.ceil(height / shrink));
      const across = targetOf("across", smallWidth, smallHeight);
      const down = targetOf("down", smallWidth, smallHeight);
      // The blur's 13 taps are three steps to each standard deviation, and the radius is two.
      const step = radius / shrink / 2 / 3;

      gl.bindTexture(gl.TEXTURE_2D, drawn.texture);
      gl.generateMipmap(gl.TEXTURE_2D);
      readFrom(drawn.texture, true);
      pass(programs.blur, across, smallWidth, smallHeight, (u) => {
        gl.uniform1i(u("uTex"), 0);
        gl.uniform2f(u("uStep"), step / smallWidth, 0);
      });
      readFrom(across.texture, false);
      pass(programs.blur, down, smallWidth, smallHeight, (u) => {
        gl.uniform1i(u("uTex"), 0);
        gl.uniform2f(u("uStep"), 0, step / smallHeight);
      });
      result = down;
    }

    canvas.width = width;
    canvas.height = height;
    readFrom(result.texture, false);
    pass(programs.finish, null, width, height, (u) => {
      gl.uniform1i(u("uTex"), 0);
      gl.uniform2f(u("uSize"), size.width, size.height);
      gl.uniform1f(u("uFrost"), effects.frost);
      gl.uniform1f(u("uGrain"), effects.grain);
      gl.uniform1f(u("uVignette"), effects.vignette);
    });

    out.width = width;
    out.height = height;
    out.getContext("2d")?.drawImage(canvas, 0, 0);
  };

  return { canvas, render };
};

let renderer: ReturnType<typeof createRenderer> | undefined;

const getRenderer = () => {
  if (renderer !== undefined) return renderer;
  try {
    renderer = createRenderer();
  } catch (error) {
    console.error("Abstract backgrounds are unavailable:", error);
    renderer = null;
  }
  // The GPU can drop the context, for example on sleep. Rebuild on the next render.
  renderer?.canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    renderer = undefined;
  });
  return renderer;
};

export const isBackdropSupported = () => !!getRenderer();

/** Draws a background with its effects into `out`, at `scale` pixels to each canvas pixel. */
export const renderBackground = (
  source: BackgroundSource,
  effects: BackgroundEffects,
  size: { width: number; height: number },
  scale: number,
  out: HTMLCanvasElement,
) => {
  const active = getRenderer();
  if (!active) return false;
  active.render(source, effects, size, scale, out);
  return true;
};

/** Gallery pictures, as made once. */
const thumbs = new Map<string, string>();
const THUMB_SIZE = { width: 1200, height: 900 };
const THUMB_SCALE = 0.14;

export const backdropThumb = (look: BackdropLook, effects: BackgroundEffects) => {
  const key = JSON.stringify([look.style, look.seed, look.colors, effects]);
  const cached = thumbs.get(key);
  if (cached) return cached;
  const out = document.createElement("canvas");
  if (!renderBackground({ look }, effects, THUMB_SIZE, THUMB_SCALE, out)) return null;
  const url = out.toDataURL("image/png");
  thumbs.set(key, url);
  return url;
};
