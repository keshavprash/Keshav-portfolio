/* Creating a WebGL context can block for hundreds of milliseconds, so the capability check runs off the main thread. */
self.onmessage = () => {
  const result = { offscreen: false, hardware: false, renderer: '', canHalfFloat: false };
  try {
    const gl = new OffscreenCanvas(1, 1).getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (gl) {
      result.offscreen = true;
      result.hardware = true;
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      result.renderer = String((info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
      result.canHalfFloat = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    } else {
      // WebGL2 that only works without the performance check means software rendering
      result.offscreen = !!new OffscreenCanvas(1, 1).getContext('webgl2');
    }
  } catch (e) {
    result.offscreen = false;
  }
  self.postMessage(result);
};
