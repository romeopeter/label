import type { ImageTilt } from "@/lib/tilt";

/*
  3D tilt, drawn by Layer. The picture is one quad, turned in 3D the way CSS turns
  an element (rotateX, then rotateY, then rotateZ, about its centre) and seen in
  perspective. The GPU interpolates across it with perspective correction, so
  straight lines stay straight: no slicing into strips, which is what went wrong
  before. Rounded corners, a border and the inner shadow are drawn in the same
  pass, so they tilt with it.

  It has its own small WebGL context, like the other renderers, and copies the
  result to a 2D canvas that Konva draws: on screen and in export alike.
*/

/** The largest side drawn. */
const MAX_SIDE = 4096;

export interface TiltBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TiltLook {
  tilt: ImageTilt;
  /** The element's box, in canvas units. */
  width: number;
  height: number;
  cornerRadius: number;
  border?: { color: string; width: number } | null;
}

interface Corner {
  /** Where it lands, element-local canvas units. */
  x: number;
  y: number;
  /** How far towards the viewer, before projection. */
  z: number;
  /** Perspective divide: 1 at the element's plane. */
  w: number;
}

/**
 * The perspective distance, in canvas units. It follows the element's size, so a
 * tilt looks the same on a big image as a small one, and at any zoom.
 */
export const perspectiveOf = (tilt: ImageTilt, width: number, height: number) =>
  (tilt.perspective * Math.max(width, height)) / 720;

/** Where the four corners land: top left, top right, bottom left, bottom right. */
export const tiltCorners = (look: TiltLook): Corner[] => {
  const { tilt, width, height } = look;
  const p = perspectiveOf(tilt, width, height);
  const [ax, ay, az] = [tilt.tiltX, tilt.tiltY, tilt.tiltZ].map((deg) => (deg * Math.PI) / 180);
  return [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ].map(([u, v]) => {
    // Scale, then rotateZ, rotateY, rotateX: CSS applies the rightmost first.
    let x = (u - 0.5) * width * tilt.scale;
    let y = (v - 0.5) * height * tilt.scale;
    let z = 0;
    [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
    [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
    [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
    // Never at or behind the eye.
    const w = Math.max(0.05, (p - z) / p);
    return { x: width / 2 + x / w, y: height / 2 + y / w, z, w };
  });
};

/** The box the tilted picture fills, element-local. */
export const tiltBoxOf = (corners: Corner[]): TiltBox => {
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const x = Math.floor(Math.min(...xs));
  const y = Math.floor(Math.min(...ys));
  return { x, y, width: Math.ceil(Math.max(...xs)) - x, height: Math.ceil(Math.max(...ys)) - y };
};

const VERTEX = `#version 300 es
in vec2 aPos;
in float aW;
in vec2 aUv;
in float aDepth;
out vec2 vUv;
out float vDepth;
void main() {
  vUv = aUv;
  vDepth = aDepth;
  // Handing the GPU w makes it interpolate in perspective.
  gl_Position = vec4(aPos * aW, 0.0, aW);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
in float vDepth;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uSize;
uniform float uRadius;
uniform float uBorder;
uniform vec3 uBorderColor;
uniform float uShade;

float roundBox(vec2 p, vec2 extent, float r) {
  vec2 q = abs(p) - extent + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 q = vUv * uSize;
  float d = roundBox(q - 0.5 * uSize, 0.5 * uSize, uRadius);
  float aa = max(fwidth(d), 1e-4);
  float alpha = clamp(0.5 - d / aa, 0.0, 1.0);
  vec3 col = texture(uTex, vUv).rgb;
  if (uBorder > 0.0) col = mix(col, uBorderColor, clamp(0.5 + (d + uBorder) / aa, 0.0, 1.0));
  // The far side a little darker, as if lit from in front.
  col *= 1.0 - uShade * 0.35 * clamp(vDepth, 0.0, 1.0);
  outColor = vec4(col * alpha, alpha);
}`;

const hexToRgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  return Number.isFinite(n) ? [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] : [1, 1, 1];
};

const createRenderer = () => {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true });
  if (!gl) return null;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Could not create a shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Shader failed");
    return shader;
  };
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Link failed");
  const at = (name: string) => gl.getUniformLocation(program, name);

  const buffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const stride = 6 * 4;
  const attribute = (name: string, size: number, offset: number) => {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset * 4);
  };
  attribute("aPos", 2, 0);
  attribute("aW", 1, 2);
  attribute("aUv", 2, 3);
  attribute("aDepth", 1, 5);

  const texture = gl.createTexture();
  const maxSide = Math.min(MAX_SIDE, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);

  /** Draws `picture` tilted into `out`, at `scale` pixels to each canvas unit. Returns where it goes. */
  const render = (picture: TexImageSource, look: TiltLook, requestedScale: number, out: HTMLCanvasElement) => {
    const corners = tiltCorners(look);
    const box = tiltBoxOf(corners);
    const scale = Math.min(requestedScale, maxSide / Math.max(box.width, box.height, 1));
    canvas.width = Math.max(1, Math.round(box.width * scale));
    canvas.height = Math.max(1, Math.round(box.height * scale));

    const reach = Math.max(look.width, look.height) * 0.5 * look.tilt.scale;
    const uvs = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    const vertices = new Float32Array(
      corners.flatMap((c, i) => [
        ((c.x - box.x) / box.width) * 2 - 1,
        1 - ((c.y - box.y) / box.height) * 2,
        c.w,
        uvs[i][0],
        uvs[i][1],
        -c.z / reach,
      ]),
    );

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, picture);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.uniform1i(at("uTex"), 0);
    gl.uniform2f(at("uSize"), look.width, look.height);
    gl.uniform1f(at("uRadius"), Math.min(look.cornerRadius, look.width / 2, look.height / 2));
    gl.uniform1f(at("uBorder"), look.border ? look.border.width : 0);
    gl.uniform3fv(at("uBorderColor"), hexToRgb(look.border?.color ?? "#ffffff"));
    gl.uniform1f(at("uShade"), look.tilt.innerShadow ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    out.width = canvas.width;
    out.height = canvas.height;
    const g = out.getContext("2d");
    g?.clearRect(0, 0, out.width, out.height);
    g?.drawImage(canvas, 0, 0);
    return box;
  };

  return { canvas, render };
};

let renderer: ReturnType<typeof createRenderer> | undefined;

const getRenderer = () => {
  if (renderer !== undefined) return renderer;
  try {
    renderer = createRenderer();
  } catch (error) {
    console.error("3D tilt is unavailable:", error);
    renderer = null;
  }
  renderer?.canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    renderer = undefined;
  });
  return renderer;
};

export const isTiltSupported = () => !!getRenderer();

export const renderTilt = (picture: TexImageSource, look: TiltLook, scale: number, out: HTMLCanvasElement) =>
  getRenderer()?.render(picture, look, scale, out) ?? null;
