
PIXI.glReadPixels = function(gl, frameBuffer, x, y, width, height, pixels) {
  if (!pixels) pixels = new Uint8Array(4 * width * height);

  if (frameBuffer instanceof PIXI.RenderTexture) {
    frameBuffer = frameBuffer.textureBuffer.frameBuffer;
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);        
  gl.viewport(0, 0, width, height);
  gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);    

  return pixels;
};

PIXI.glReadPixelsToCanvas = function(gl, frameBuffer, x, y, width, height) {
  var canvas = document.createElement('canvas'),
      ctx = canvas.getContext('2d'),
      imgdata = ctx.createImageData(width, height);

  canvas.width = width;
  canvas.height = height;

  PIXI.glReadPixels(gl, frameBuffer, x, y, width, height, new Uint8Array(imgdata.data.buffer));

  ctx.putImageData(imgdata, 0, 0);

  return canvas;
};

