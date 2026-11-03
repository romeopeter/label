/*
  The image pipeline, as WebGL2 shaders. Everything works on premultiplied colour
  until MAIN un-premultiplies, so blurs don't pull a dark fringe in from transparent
  pixels. Texture coordinates run with row 0 of the image at v = 0.
*/

export const VERTEX = `#version 300 es
in vec2 aPos;
out vec2 vUv;
uniform float uFlip;
void main() {
  vUv = aPos * 0.5 + 0.5;
  if (uFlip > 0.5) vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/** One direction of a Gaussian blur. Run across and down, for a soft result. */
export const BLUR = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uStep;
void main() {
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = -6; i <= 6; i++) {
    float x = float(i);
    float w = exp(-x * x / 18.0);
    sum += texture(uTex, vUv + uStep * x) * w;
    total += w;
  }
  outColor = sum / total;
}`;

/** Keeps only the bright parts of the picture, ready to be blurred into a glow. */
export const GLOW_PREP = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform float uThreshold;
uniform vec3 uTint;
void main() {
  vec4 c = texture(uTex, vUv);
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  outColor = vec4(c.rgb * uTint * smoothstep(uThreshold, uThreshold + 0.25, l), 1.0);
}`;

/** Disc blur, weighted towards highlights so they bloom into round spots. */
export const LENS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uRadius;
void main() {
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = 0; i < 64; i++) {
    float r = sqrt((float(i) + 0.5) / 64.0);
    float a = float(i) * 2.39996;
    vec4 c = texture(uTex, vUv + vec2(cos(a), sin(a)) * r * uRadius);
    float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    float w = 1.0 + 4.0 * l * l * l * l;
    sum += c * w;
    total += w;
  }
  outColor = sum / total;
}`;

export const MAIN = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uSrc;
uniform sampler2D uSoft;
uniform sampler2D uGlow;
uniform sampler2D uLens;
uniform sampler2D uOverlay;
uniform vec2 uRes;
uniform vec2 uOverlayScale;

uniform float uBrightness, uContrast, uHighlights, uShadows, uAmbience, uSaturation, uWarmth;
uniform vec3 uTint;
uniform float uTintAmount;
uniform vec3 uGradeShadows, uGradeHighlights;
uniform float uGradeContrast, uGradeSaturation, uGradeLift;
uniform int uLensMode;
uniform int uStyle;
uniform vec4 uP;
uniform vec4 uQ;
uniform float uStrength;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    value += noise(p) * amp;
    p = p * 2.03 + 17.0;
    amp *= 0.5;
  }
  return value;
}

vec3 screen(vec3 a, vec3 b) {
  return 1.0 - (1.0 - a) * (1.0 - clamp(b, 0.0, 1.0));
}

// A coordinate that doesn't depend on the picture's resolution or shape, so
// textures look the same on the canvas, in an export and in a thumbnail.
vec2 pictureCoord(vec2 uv) {
  float aspect = uRes.x / uRes.y;
  return aspect > 1.0 ? vec2(uv.x * aspect, uv.y) : vec2(uv.x, uv.y / aspect);
}

float grainAt(vec2 uv) {
  float cell = max(1.0, max(uRes.x, uRes.y) / 1600.0);
  return hash(floor(uv * uRes / cell)) - 0.5;
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  float mask = 1.0;

  // Fish-eye. p.x: how far it bends. p.y: 1 clips to a circle.
  if (uStyle == 5) {
    float bend = uP.x * uStrength;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    float radius = uP.y > 0.5
      ? 0.5 * min(aspect, 1.0)
      : 0.5 * length(vec2(aspect, 1.0));
    float n = length(p) / radius;
    if (uP.y > 0.5) {
      float edge = 1.0 - smoothstep(0.995, 1.0, n);
      mask = mix(1.0, edge, smoothstep(0.0, 0.2, uStrength));
    }
    if (bend > 0.0 && n > 0.0001) p *= pow(min(n, 1.0), bend);
    uv = p / vec2(aspect, 1.0) + 0.5;
  }

  vec4 c;
  if (uStyle == 2) {
    // Motion. p.x: 0 straight, 1 zoom, 2 spin. p.yz: direction. p.w: distance.
    float amount = uP.w * uStrength;
    float jitter = hash(vUv * uRes);
    c = vec4(0.0);
    // textureLod: the jitter would otherwise read as a huge derivative and pick a
    // blurry mipmap for every sample.
    for (int i = 0; i < 48; i++) {
      float t = (float(i) + jitter) / 48.0 - 0.5;
      vec2 q = uv;
      if (uP.x < 0.5) {
        q += uP.yz * t * amount;
      } else if (uP.x < 1.5) {
        q = 0.5 + (uv - 0.5) * (1.0 + t * amount);
      } else {
        float a = t * amount;
        vec2 d = (uv - 0.5) * vec2(aspect, 1.0);
        d = vec2(d.x * cos(a) - d.y * sin(a), d.x * sin(a) + d.y * cos(a));
        q = d / vec2(aspect, 1.0) + 0.5;
      }
      c += textureLod(uSrc, q, 0.0);
    }
    c /= 48.0;
  } else if (uStyle == 3) {
    // Color split. p.x: 0 grows towards the edges, 1 straight across. p.y: distance.
    float amount = uP.y * uStrength;
    vec2 d = uP.x < 0.5 ? (uv - 0.5) * 2.0 * amount : vec2(amount, 0.0);
    vec4 middle = texture(uSrc, uv);
    c = vec4(texture(uSrc, uv + d).r, middle.g, texture(uSrc, uv - d).b, middle.a);
    c.rgb = min(c.rgb, vec3(c.a));
  } else {
    c = texture(uSrc, uv);
  }

  if (uLensMode > 0) {
    float focus = 1.0;
    if (uLensMode == 1) focus = smoothstep(0.14, 0.5, length((uv - 0.5) * vec2(min(aspect, 1.6), 1.0)));
    if (uLensMode == 2) focus = smoothstep(0.1, 0.34, abs(uv.y - 0.5));
    c = mix(c, texture(uLens, uv), focus);
  }

  float alpha = c.a * mask;
  vec3 col = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);

  // Adjust. Highlights and shadows read light from a blurred copy, so they lift
  // whole areas rather than flattening fine detail.
  float l = dot(col, LUMA);
  float soft = mix(l, dot(texture(uSoft, uv).rgb, LUMA), 0.35);

  if (uBrightness != 0.0) col = pow(max(col, 0.0), vec3(exp(-uBrightness * 0.9)));
  if (uShadows != 0.0) {
    col = pow(max(col, 0.0), vec3(exp(-uShadows * 1.1 * (1.0 - smoothstep(0.0, 0.6, soft)))));
  }
  if (uHighlights != 0.0) {
    col = pow(max(col, 0.0), vec3(exp(-uHighlights * 1.1 * smoothstep(0.4, 1.0, soft))));
  }
  if (uAmbience != 0.0) {
    col += (l - dot(texture(uSoft, uv).rgb, LUMA)) * uAmbience * 0.6;
    col = mix(vec3(dot(col, LUMA)), col, 1.0 + uAmbience * 0.15);
  }
  if (uContrast != 0.0) col = (col - 0.5) * (1.0 + uContrast * (uContrast > 0.0 ? 1.0 : 0.7)) + 0.5;
  if (uWarmth != 0.0) col *= vec3(1.0 + uWarmth * 0.22, 1.0 + uWarmth * 0.02, 1.0 - uWarmth * 0.22);
  if (uSaturation != 0.0) col = mix(vec3(dot(col, LUMA)), col, 1.0 + uSaturation);
  col = clamp(col, 0.0, 1.0);

  // Color: the picture's light, in one tint.
  if (uTintAmount > 0.0) {
    vec3 tinted = dot(col, LUMA) * uTint / max(dot(uTint, LUMA), 0.001);
    col = mix(col, clamp(tinted, 0.0, 1.0), uTintAmount);
  }

  // Color grade. Uniforms arrive already scaled by the grade's strength.
  {
    float g = dot(col, LUMA);
    col += uGradeShadows * (1.0 - g) * (1.0 - g) + uGradeHighlights * g * g;
    col = (col - 0.5) * (1.0 + uGradeContrast) + 0.5;
    col = mix(vec3(dot(col, LUMA)), col, uGradeSaturation);
    col = uGradeLift + col * (1.0 - uGradeLift);
    col = clamp(col, 0.0, 1.0);
  }

  // Glow and halo. p.z: gain.
  if (uStyle == 1 || uStyle == 6) {
    col = screen(col, texture(uGlow, uv).rgb * uP.z * uStrength);
  }

  // Double exposure. p.x: 0 default, 1 lighten, 2 darken, 3 add, 4 subtract, 5 overlay.
  // Where the second image is see-through, the picture is left as it is.
  if (uStyle == 4) {
    vec4 o = texture(uOverlay, (uv - 0.5) * uOverlayScale + 0.5);
    vec3 over = o.a > 0.0 ? o.rgb / o.a : vec3(0.0);
    vec3 blended = over;
    if (uP.x > 4.5) {
      blended = mix(2.0 * col * over, 1.0 - 2.0 * (1.0 - col) * (1.0 - over), step(0.5, col));
    } else if (uP.x > 3.5) {
      blended = col - over;
    } else if (uP.x > 2.5) {
      blended = col + over;
    } else if (uP.x > 1.5) {
      blended = min(col, over);
    } else if (uP.x > 0.5) {
      blended = max(col, over);
    }
    col = mix(col, clamp(blended, 0.0, 1.0), o.a * uStrength);
  }

  // Grunge. p: dust, scratches, wear.
  if (uStyle == 7) {
    vec2 pc = pictureCoord(uv);
    float blotch = smoothstep(0.42, 0.75, fbm(pc * 5.0));
    float edge = smoothstep(0.3, 0.75, length(uv - 0.5));
    float wear = clamp(blotch * 0.3 + edge * smoothstep(0.3, 0.6, fbm(pc * 9.0)) * 0.7, 0.0, 1.0);
    col *= 1.0 - wear * uP.z * uStrength * 0.8;
    col = mix(col, vec3(dot(col, LUMA)), wear * uP.z * uStrength * 0.5);

    float speck = step(0.994, noise(pc * 420.0)) + step(0.985, noise(pc * 170.0 + 9.0));
    col = mix(col, vec3(0.04), clamp(speck, 0.0, 1.0) * uP.x * uStrength);
    float light = step(0.992, noise(pc * 300.0 + 41.0));
    col = screen(col, vec3(light * uP.x * uStrength * 0.8));

    float streak = noise(vec2(pc.x * 190.0, pc.y * 2.2));
    float gaps = smoothstep(0.35, 0.6, noise(vec2(pc.x * 12.0, pc.y * 7.0)));
    float scratch = smoothstep(0.93, 0.975, streak) * gaps;
    col = screen(col, vec3(scratch * uP.y * uStrength * 0.8));

    col += grainAt(uv) * 0.08 * uStrength;
  }

  // Film. p: grain, faded blacks, warmth, saturation. q: edge darkening, black and white.
  if (uStyle == 8) {
    float g = dot(col, LUMA);
    vec3 film = mix(vec3(g), col, uP.w);
    film = mix(film, vec3(g), uQ.y);
    film *= vec3(1.0 + uP.z, 1.0 + uP.z * 0.25, 1.0 - uP.z);
    film = uP.y + film * (1.0 - uP.y);
    float vignette = smoothstep(0.35, 0.85, length(uv - 0.5));
    film *= 1.0 - vignette * uQ.x;
    // Grain sits most in the midtones, as it does on real film.
    film += grainAt(uv) * uP.x * 1.1 * (1.0 - abs(2.0 * g - 1.0) * 0.6);
    col = mix(col, film, uStrength);
  }

  col = clamp(col, 0.0, 1.0);
  outColor = vec4(col * alpha, alpha);
}`;
