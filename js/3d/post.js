/* HDR render pipeline: scene -> half-float target -> dual-filter bloom -> tone-mapped composite.
   Hand-written instead of EffectComposer + UnrealBloomPass because the progressive
   down/up-sample chain is far cheaper on integrated GPUs for the same look. */
import * as THREE from '../vendor/three.custom.min.js';

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const DOWN = /* glsl */`
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
    c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
    c += texture2D(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
    c += texture2D(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
    c += texture2D(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
    c /= 8.0;
    if (uThreshold > 0.0) {
      float l = max(c.r, max(c.g, c.b));
      float k = smoothstep(uThreshold, uThreshold * 1.6, l);
      c = min(c * k, vec3(24.0));
    }
    gl_FragColor = vec4(c, 1.0);
  }
`;

const UP = /* glsl */`
  uniform sampler2D tSrc; uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-2.0, 0.0)).rgb;
    c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb * 2.0;
    c += texture2D(tSrc, vUv + uTexel * vec2( 0.0, 2.0)).rgb;
    c += texture2D(tSrc, vUv + uTexel * vec2( 1.0, 1.0)).rgb * 2.0;
    c += texture2D(tSrc, vUv + uTexel * vec2( 2.0, 0.0)).rgb;
    c += texture2D(tSrc, vUv + uTexel * vec2( 1.0,-1.0)).rgb * 2.0;
    c += texture2D(tSrc, vUv + uTexel * vec2( 0.0,-2.0)).rgb;
    c += texture2D(tSrc, vUv + uTexel * vec2(-1.0,-1.0)).rgb * 2.0;
    gl_FragColor = vec4(c / 12.0, 1.0);
  }
`;

const COMPOSITE = /* glsl */`
  uniform sampler2D tHdr; uniform sampler2D tBloom;
  uniform float uBloom, uExposure, uTime, uHasBloom, uDawn;
  varying vec2 vUv;
  float grainNoise(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec3 c = texture2D(tHdr, vUv).rgb;
    if (uHasBloom > 0.5) c += texture2D(tBloom, vUv).rgb * uBloom;
    c *= uExposure;
    // cinematic grade: cool shadows at night, warming slightly toward dawn
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec3 shadowTint = mix(vec3(0.92, 0.97, 1.12), vec3(1.05, 0.98, 0.95), uDawn);
    c *= mix(shadowTint, vec3(1.0), smoothstep(0.0, 0.6, l));
    // vignette
    vec2 q = vUv - 0.5;
    c *= 1.0 - dot(q, q) * 0.62;
    // film grain keeps the dark gradients from banding
    c += (grainNoise(vUv * 917.0 + fract(uTime) * 61.0) - 0.5) * 0.012;
    gl_FragColor = vec4(max(c, 0.0), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class Post {
  constructor(renderer, quality) {
    this.renderer = renderer;
    this.levels = quality.bloomLevels;
    this.bloomEnabled = this.levels > 0;

    const opts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.hdr = new THREE.WebGLRenderTarget(4, 4, { ...opts, depthBuffer: true, samples: quality.samples });
    this.down = [];
    this.up = [];
    for (let i = 0; i < this.levels; i++) {
      this.down.push(new THREE.WebGLRenderTarget(4, 4, opts));
      if (i < this.levels - 1) this.up.push(new THREE.WebGLRenderTarget(4, 4, opts));
    }

    this.tri = new THREE.BufferGeometry();
    this.tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));

    const shared = { depthTest: false, depthWrite: false, vertexShader: VERT };
    this.downMat = new THREE.ShaderMaterial({ ...shared, fragmentShader: DOWN, uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0 } }, toneMapped: false });
    this.upMat = new THREE.ShaderMaterial({ ...shared, fragmentShader: UP, uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }, blending: THREE.AdditiveBlending, transparent: true, toneMapped: false });
    this.copyMat = new THREE.ShaderMaterial({ ...shared, fragmentShader: `uniform sampler2D tSrc; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0); }`, uniforms: { tSrc: { value: null } }, toneMapped: false });
    this.compositeMat = new THREE.ShaderMaterial({
      ...shared,
      fragmentShader: COMPOSITE,
      uniforms: {
        tHdr: { value: this.hdr.texture }, tBloom: { value: null },
        uBloom: { value: 0.75 / Math.max(this.levels, 1) }, uExposure: { value: 1 }, uTime: { value: 0 }, uHasBloom: { value: this.bloomEnabled ? 1 : 0 }, uDawn: { value: 0 },
      },
    });

    this.quad = new THREE.Mesh(this.tri, this.copyMat);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /** Compiles the full-screen shaders ahead of the first frame. */
  async warmUp() {
    const r = this.renderer;
    for (const m of [this.downMat, this.upMat, this.copyMat]) {
      this.quad.material = m;
      r.setRenderTarget(this.hdr);
      await r.compileAsync(this.quadScene, this.quadCam);
    }
    r.setRenderTarget(null);
    this.quad.material = this.compositeMat;
    await r.compileAsync(this.quadScene, this.quadCam);
  }

  setSize(w, h) {
    this.hdr.setSize(w, h);
    let lw = w, lh = h;
    for (let i = 0; i < this.levels; i++) {
      lw = Math.max(2, lw >> 1); lh = Math.max(2, lh >> 1);
      this.down[i].setSize(lw, lh);
      if (i < this.levels - 1) this.up[i].setSize(lw, lh);
    }
  }

  setBloom(enabled) {
    this.bloomEnabled = enabled && this.levels > 0;
    this.compositeMat.uniforms.uHasBloom.value = this.bloomEnabled ? 1 : 0;
  }

  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  render(scene, camera, frame) {
    const r = this.renderer;
    r.setRenderTarget(this.hdr);
    r.clear();
    r.render(scene, camera);

    const comp = this.compositeMat.uniforms;
    comp.uTime.value = frame.time;
    comp.uExposure.value = frame.exposure;
    comp.uDawn.value = frame.dawn;

    if (this.bloomEnabled) {
      // progressive downsample, first level applies the highlight threshold
      let src = this.hdr.texture, w = this.hdr.width, h = this.hdr.height;
      for (let i = 0; i < this.levels; i++) {
        const u = this.downMat.uniforms;
        u.tSrc.value = src;
        u.uTexel.value.set(0.5 / w, 0.5 / h);
        u.uThreshold.value = i === 0 ? 1.15 : 0;
        this.pass(this.downMat, this.down[i]);
        src = this.down[i].texture; w = this.down[i].width; h = this.down[i].height;
      }
      // progressive upsample, accumulating into the previous level's copy
      let cur = this.down[this.levels - 1];
      for (let i = this.levels - 2; i >= 0; i--) {
        const target = this.up[i];
        this.copyMat.uniforms.tSrc.value = this.down[i].texture;
        this.pass(this.copyMat, target);
        const u = this.upMat.uniforms;
        u.tSrc.value = cur.texture;
        u.uTexel.value.set(0.5 / cur.width, 0.5 / cur.height);
        r.autoClear = false;
        this.pass(this.upMat, target);
        r.autoClear = true;
        cur = target;
      }
      comp.tBloom.value = cur.texture;
    }

    this.pass(this.compositeMat, null);
  }

  dispose() {
    this.hdr.dispose();
    this.down.forEach((t) => t.dispose());
    this.up.forEach((t) => t.dispose());
    this.tri.dispose();
    [this.downMat, this.upMat, this.copyMat, this.compositeMat].forEach((m) => m.dispose());
  }
}
