/* Shared GLSL snippets. */

export const NOISE = /* glsl */`
  float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  vec2 hash22(vec2 p) { float n = hash21(p); return vec2(n, hash21(p + n + 17.0)); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p, int octaves) {
    float v = 0.0, a = 0.5;
    mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < octaves; i++) { v += a * vnoise(p); p = r * p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }
`;

/* Atmosphere colour used by everything that fades into distance, so depth stays consistent with the sky. */
export const ATMOSPHERE = /* glsl */`
  vec3 hazeColor(float dawn) {
    return mix(vec3(0.052, 0.040, 0.150), vec3(0.62, 0.32, 0.22), dawn * dawn);
  }
`;
