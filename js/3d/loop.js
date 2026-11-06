/* Animation loop. Owns requestAnimationFrame, pausing and the frame-rate governor.
   - Stops completely while the tab is hidden.
   - Drops to ~30 fps when the visitor is reading below the hero and not scrolling.
   - Steps quality down (never up) if the device cannot hold a usable frame rate. */

export class Loop {
  constructor({ update, render, onDegrade }) {
    this.update = update;
    this.render = render;
    this.onDegrade = onDegrade;
    this.raf = 0;
    this.running = false;
    this.wanted = false;
    this.last = 0;
    this.accum = 0;
    this.frames = 0;
    this.sampleStart = 0;
    this.slowSamples = 0;
    this.lowPower = false;
    this.fps = 0;
    this.renderedFrames = 0;
    this.tick = this.tick.bind(this);
    this.onVisibility = this.onVisibility.bind(this);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  start() {
    this.wanted = true;
    if (this.running || document.hidden) return;
    this.running = true;
    this.last = performance.now();
    this.sampleStart = this.last;
    this.frames = 0;
    this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    this.wanted = false;
    this.halt();
  }

  halt() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  onVisibility() {
    if (document.hidden) this.halt();
    else if (this.wanted) this.start();
  }

  /** Reading mode: half the frame rate saves power once the hero is off screen. */
  setLowPower(on) { this.lowPower = on; }

  tick(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);

    const dt = Math.min((now - this.last) / 1000, 0.1);
    if (this.lowPower) {
      this.accum += dt;
      this.last = now;
      if (this.accum < 1 / 31) return;
    } else {
      this.accum = dt;
      this.last = now;
    }
    const step = this.accum;
    this.accum = 0;

    this.update(step);
    this.render();
    this.renderedFrames++;

    // governor: judge the device in 2 second windows
    this.frames++;
    const elapsed = now - this.sampleStart;
    if (elapsed >= 2000) {
      this.fps = (this.frames * 1000) / elapsed;
      this.frames = 0;
      this.sampleStart = now;
      const floor = this.lowPower ? 22 : 34;
      if (this.fps < floor) {
        this.slowSamples++;
        if (this.slowSamples >= 2) { this.slowSamples = 0; this.onDegrade(this.fps); }
      } else {
        this.slowSamples = 0;
      }
    }
  }

  dispose() {
    this.stop();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
