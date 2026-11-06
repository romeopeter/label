/*
  Abstract backgrounds, as WebGL2 shaders. Positions are worked out in canvas pixels,
  so a background looks the same in the preview and in an export at any scale. Rows
  run with the top of the canvas at v = 1, both in textures and on screen.
*/

const COMMON = `
// Integer maths, not the usual fract(sin()) kind: the GPU may round a float hash
// differently at each place it's used, and neighbouring cells then disagree at their
// shared corner, which shows as seams.
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
/** A fixed random value, 0 to 1, for the whole-number cell that p is in. */
float hash(vec2 p) {
  uvec2 q = uvec2(ivec2(floor(p)));
  return float(pcg(q.x + pcg(q.y))) / 4294967295.0;
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
/** Canvas pixels, top left at 0. */
vec2 canvasPos(vec2 uv, vec2 size) { return vec2(uv.x, 1.0 - uv.y) * size; }
`;

/** Draws the style, in linear light, and hands it on in sRGB. */
export const BACKDROP_MAIN = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uSize;
/** One output pixel, in the shorter-side units the shapes use, for smooth edges. */
uniform float uPixel;
uniform int uStyle;
/** Deep, main, accent and highlight, in linear light. */
uniform vec3 uColors[4];
/** Where things go, worked out from the seed. */
uniform vec4 uP[16];
${COMMON}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + 17.0;
    a *= 0.5;
  }
  return v / 0.97;
}
mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}
vec3 toGamma(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

/** Blurred patches of colour, blending into each other. */
vec3 soft(vec2 p) {
  vec2 o = uP[6].xy;
  vec2 q = p + 0.24 * (vec2(fbm(p * 1.3 + o), fbm(p * 1.3 + o + 31.7)) - 0.5);
  vec3 col = uColors[0];
  for (int i = 0; i < 5; i++) {
    vec4 b = uP[i];
    vec2 d = q - b.xy;
    float w = exp(-dot(d, d) / (b.z * b.z));
    col = mix(col, uColors[int(b.w)], w * (b.w > 2.5 ? 0.6 : 0.92));
  }
  return col;
}

/** Layered folds, each lit along its edge and shading the one behind. */
vec3 waves(vec2 p) {
  vec4 g = uP[4];
  vec2 r = rot(g.x) * p;
  vec3 col = mix(uColors[0], mix(uColors[0], uColors[1], 0.4), smoothstep(-0.8, 0.8, r.y));
  for (int i = 0; i < 4; i++) {
    vec4 w = uP[i];
    float curve = w.x + w.y * sin(r.x * w.z + w.w)
      + 0.1 * (fbm(vec2(r.x * 1.2 + g.y, float(i) * 3.7 + g.z)) - 0.5);
    float d = r.y - curve;
    if (d < 0.0) col *= 1.0 - 0.42 * exp(d / 0.07);
    vec3 lc = i == 0 ? mix(uColors[0], uColors[1], 0.6)
      : i == 1 ? uColors[1]
      : i == 2 ? uColors[2]
      : mix(uColors[1], uColors[2], 0.5);
    vec3 body = mix(lc, mix(lc, uColors[0], 0.6), smoothstep(0.0, 0.45, d));
    float edge = max(d, 0.0);
    vec3 rim = uColors[3] * (0.55 * exp(-edge / 0.012) + 0.22 * exp(-edge / 0.08));
    col = mix(col, body + rim, smoothstep(-uPixel, uPixel, d));
  }
  return col;
}

/** Light pulled out along one direction, with a second colour drifting in from one side. */
vec3 streaks(vec2 p) {
  vec4 g = uP[0];
  vec2 r = rot(g.x) * p;
  float v = fbm(vec2(r.x * 0.55 + g.y, r.y * 6.5 + g.z));
  float fine = noise(vec2(r.x * 0.8 + g.z, r.y * 40.0 + g.y));
  float t = clamp((v - 0.3) * 2.1 + (fine - 0.5) * 0.3, 0.0, 1.0);
  vec3 main = t < 0.5 ? mix(uColors[0], uColors[1], t * 2.0) : mix(uColors[1], uColors[3], (t - 0.5) * 2.0);
  vec3 other = t < 0.5 ? mix(uColors[0], uColors[2], t * 2.0) : mix(uColors[2], uColors[3], (t - 0.5) * 2.0);
  vec2 dir = vec2(cos(g.w), sin(g.w));
  float drift = dot(p, dir) + 0.4 * (fbm(p * 1.1 + g.yz) - 0.5) + uP[1].x;
  vec3 col = mix(main, other, smoothstep(0.2, 0.75, drift));
  return col + uColors[3] * pow(t, 7.0) * 0.6;
}

/** Soft lights on a dark ground. */
vec3 glow(vec2 p) {
  vec3 col = uColors[0] * (1.0 - 0.4 * dot(p, p));
  for (int i = 0; i < 4; i++) {
    vec4 o = uP[i];
    vec2 d = p - o.xy;
    vec3 light = uColors[int(o.w)] * exp(-dot(d, d) / (o.z * o.z)) * 0.95;
    col = 1.0 - (1.0 - col) * (1.0 - light);
  }
  return col;
}

float roundBox(vec2 p, vec2 size, float r) {
  vec2 q = abs(p) - size + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

/** Clear panels over soft colour, bending what's behind them at their edges. Some are fluted. */
vec3 glass(vec2 p) {
  vec3 col = soft(p);
  vec2 light = vec2(cos(uP[14].x), sin(uP[14].x));
  for (int i = 0; i < 3; i++) {
    vec4 box = uP[8 + i * 2];
    vec4 look = uP[9 + i * 2];
    mat2 toLocal = rot(look.x);
    vec2 l = toLocal * (p - box.xy);
    float d = roundBox(l, box.zw, look.y);
    // A soft shadow, a little below the panel.
    float shadow = roundBox(toLocal * (p - box.xy - vec2(0.0, 0.03)), box.zw, look.y);
    col *= 1.0 - 0.3 * (1.0 - smoothstep(-0.04, 0.1, shadow));
    if (d > uPixel) continue;

    vec2 e = vec2(0.002, 0.0);
    vec2 n = vec2(roundBox(l + e.xy, box.zw, look.y) - roundBox(l - e.xy, box.zw, look.y),
                  roundBox(l + e.yx, box.zw, look.y) - roundBox(l - e.yx, box.zw, look.y));
    n /= max(length(n), 1e-5);
    // Thick at the edge, so what's behind is pulled in there.
    vec2 bend = n * exp(d / 0.05) * 0.1;
    float flute = 0.0;
    if (look.z > 0.0) {
      flute = fract(l.x * look.z) - 0.5;
      // Each flute is a little lens, turning what's behind it round.
      bend.x += flute * 1.4 / look.z;
    }
    vec2 q = box.xy + (p - box.xy) * 0.94 - transpose(toLocal) * bend;
    vec3 inside = mix(soft(q), uColors[3], 0.1);
    inside *= 1.0 + flute * 0.22;
    if (look.z > 0.0) {
      float groove = (0.5 - abs(flute)) / look.z;
      inside *= 1.0 - 0.3 * exp(-groove / max(2.0 * uPixel, 0.0012));
    }
    float lit = 0.3 + 0.7 * max(dot(transpose(toLocal) * n, -light), 0.0);
    inside += uColors[3] * (0.9 * lit * exp(d / max(0.004, 1.5 * uPixel)) + 0.1 * exp(d / 0.04));
    col = mix(col, inside, smoothstep(uPixel, -uPixel, d));
  }
  return col;
}

/** Curtains of light over a night sky. */
vec3 aurora(vec2 p, vec2 pos) {
  float low = smoothstep(-0.7, 0.7, p.y);
  vec3 col = uColors[0] * mix(0.08, 0.45, low);
  float lit = 0.0;
  for (int i = 0; i < 3; i++) {
    vec4 c = uP[i];
    float x = p.x + 0.1 * sin(p.x * 2.3 + c.w);
    float edge = c.x + c.y * sin(x * 1.7 + c.w) + 0.12 * (fbm(vec2(x * 1.1 + c.w, float(i) * 7.3)) - 0.5);
    // How far above the curtain's bright lower edge. Below it, the light dies away fast.
    float u = edge - p.y;
    float body = u > 0.0 ? exp(-u / c.z) : exp(u / 0.035);
    // Curtains come and go along their length.
    body *= smoothstep(0.3, 0.65, fbm(vec2(x * 0.7 - c.w, float(i) * 11.0)));
    float rays = 0.4 + 0.6 * noise(vec2(x * 30.0 + c.w * 10.0, u * 1.5 + float(i) * 3.0));
    rays *= 0.55 + 0.45 * noise(vec2(x * 6.0 - c.w, float(i) * 5.0));
    vec3 tint = mix(uColors[1], uColors[2], smoothstep(0.0, c.z * 2.0, u));
    tint = mix(tint, uColors[3], 0.4 * exp(-abs(u) / 0.025));
    col += tint * body * rays * (1.2 - 0.25 * float(i));
    lit += body;
  }
  // Stars, a canvas pixel or so across, so they're the same in every export.
  vec2 cell = floor(pos / 5.0);
  vec2 at = fract(pos / 5.0) - 0.5 - (vec2(hash(cell + 101.0), hash(cell + 211.0)) - 0.5) * 0.6;
  float star = step(0.986, hash(cell)) * exp(-dot(at, at) / 0.012) * (0.4 + 0.6 * hash(cell + 307.0));
  col += vec3(star) * (1.0 - min(lit, 1.0)) * (1.0 - low);
  return col;
}

float silkHeight(vec2 p) {
  vec4 g = uP[4];
  vec2 q = rot(g.w) * p;
  q += 0.2 * vec2(sin(q.y * 2.1 + g.x), sin(q.x * 1.7 + g.y));
  float h = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 w = uP[i];
    h += w.w * sin(dot(w.xy, q) + w.z);
  }
  return h;
}

/** Glossy folds of cloth, lit from one side. */
vec3 silk(vec2 p) {
  const float e = 0.0015;
  float h = silkHeight(p);
  float dx = (silkHeight(p + vec2(e, 0.0)) - silkHeight(p - vec2(e, 0.0))) / (2.0 * e);
  float dy = (silkHeight(p + vec2(0.0, e)) - silkHeight(p - vec2(0.0, e))) / (2.0 * e);
  vec3 n = normalize(vec3(-dx, -dy, 1.0));
  float a = uP[4].z;
  vec3 light = normalize(vec3(cos(a), sin(a), 0.75));
  float diffuse = max(dot(n, light), 0.0);
  float spec = pow(max(dot(n, normalize(light + vec3(0.0, 0.0, 1.0))), 0.0), 70.0);
  vec3 col = mix(uColors[0], uColors[1], smoothstep(0.1, 0.95, diffuse));
  // The turned-away side of each fold picks up the accent.
  col = mix(col, uColors[2], 0.45 * smoothstep(0.25, 0.75, length(n.xy)) * (1.0 - diffuse));
  col += uColors[3] * (0.85 * spec + 0.18 * pow(diffuse, 6.0));
  return col * (0.72 + 0.28 * smoothstep(-0.25, 0.25, h));
}

/** Stone with veins through it, light or dark to match the main colour. */
vec3 marble(vec2 p) {
  vec4 a = uP[0];
  vec4 b = uP[1];
  vec4 g = uP[2];
  vec2 q = p * g.z;
  vec2 w1 = vec2(fbm(q + a.xy), fbm(q + a.zw));
  vec2 w2 = vec2(fbm(q + 3.0 * w1 + b.xy), fbm(q + 3.0 * w1 + b.zw));
  float f = fbm(q + 3.0 * w2);
  // Veins run where a warped noise crosses one value, so they wander, branch and
  // thin out the way cracks in stone do.
  float d1 = abs(fbm(q * g.y + 2.0 * w1 + b.xy) - 0.5);
  float vein = 1.0 - smoothstep(0.0, 0.006 + 0.012 * w2.x, d1);
  vein = max(vein, 0.22 * exp(-d1 / 0.035));
  float d2 = abs(fbm(q * g.y * 2.3 + 1.5 * w2 + b.zw) - 0.5);
  float thin = (1.0 - smoothstep(0.0, 0.005, d2)) * smoothstep(0.35, 0.65, w1.x);
  float clouds = smoothstep(0.3, 0.85, f);
  vec3 pale = mix(uColors[3], mix(uColors[3], uColors[1], 0.5), clouds);
  pale = mix(pale, uColors[0], vein * 0.8);
  pale = mix(pale, uColors[2], thin * 0.55);
  vec3 dark = mix(uColors[0] * 0.5, mix(uColors[0], uColors[1], 0.35), clouds);
  dark = mix(dark, uColors[3], vein * 0.75);
  dark = mix(dark, uColors[2], thin * 0.6);
  float isPale = step(0.2, dot(uColors[1], vec3(0.2126, 0.7152, 0.0722)));
  return mix(dark, pale, isPale);
}

void main() {
  vec2 pos = canvasPos(vUv, uSize);
  vec2 p = (pos - 0.5 * uSize) / min(uSize.x, uSize.y);
  vec3 col = uStyle == 1 ? waves(p)
    : uStyle == 2 ? streaks(p)
    : uStyle == 3 ? glow(p)
    : uStyle == 4 ? glass(p)
    : uStyle == 5 ? aurora(p, pos)
    : uStyle == 6 ? silk(p)
    : uStyle == 7 ? marble(p)
    : soft(p);
  outColor = vec4(toGamma(clamp(col, 0.0, 1.0)), 1.0);
}`;

/** Frost, vignette and grain, over the drawn or blurred background. */
export const BACKDROP_FINISH = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uSize;
uniform float uFrost;
uniform float uGrain;
uniform float uVignette;
${COMMON}
/** How far frosted glass scatters what's behind it, in canvas pixels, at full frost. */
const float SCATTER = 14.0;

void main() {
  vec2 cell = floor(canvasPos(vUv, uSize));
  vec2 scatter = (vec2(hash(cell), hash(cell + vec2(0.0, 7919.0))) - 0.5) * uFrost * SCATTER / uSize;
  // A jittered sample has to name its level, or mipmaps blur it.
  vec3 col = textureLod(uTex, vUv + scatter, 0.0).rgb;

  // Frosted glass: paler, milkier and a little less colourful.
  vec3 milky = mix(col, vec3(1.0), 0.32);
  float light = dot(milky, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, mix(vec3(light), milky, 0.72), uFrost * 0.85);

  // Darker towards the corners, along the canvas's own shape.
  float edge = length((vUv - 0.5) * 2.0) / 1.41421356;
  col *= 1.0 - uVignette * 0.85 * smoothstep(0.3, 1.0, edge);

  col += (hash(cell + vec2(7919.0, 0.0)) - 0.5) * uGrain * 0.24;
  // A hair of noise in every background, so smooth gradients don't band.
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
