/*
MIT Licensed

Copyright (c) 2014 Rafał Lindemann. http://panrafal.github.com/depthy
*/
(function(root){
  'use strict';

  var DepthyDrawer = root.DepthyDrawer = function(viewer) {

    var self = this,
        texture, undoTexture,
        brush, brushCanvas, brushTexture, brushContainer, brushLastPos,
        depthmap, image,
        unit;

    function initialize() {
      depthmap = viewer.getDepthmap();
      image = viewer.getImage();

      if (depthmap.texture instanceof PIXI.RenderTexture === false) {
        // replace the texture
        viewer.setDepthmap(viewer.exportDepthmapAsTexture({width: 1000, height: 1000}));
        depthmap = viewer.getDepthmap();
      }

      texture = depthmap.texture;

      unit = Math.max(image.size.width, image.size.height);

      // setup undo...
      // undoTexture = new PIXI.RenderTexture(texture.width, texture.height);

      // setup brush
      brushCanvas = document.createElement('canvas');
      // $('body').append(brushCanvas);
      self.setBrush(0.5, 0.02, 0.1);
    }

    this.setBrush = function(depth, size, hardness) {
      var ctx = brushCanvas.getContext('2d');

      size *= unit;

      brushCanvas.width = brushCanvas.height = size;
      ctx.clearRect(0, 0, size, size);

      var grd = ctx.createRadialGradient(size / 2, size / 2, size / 2 * hardness, size / 2, size / 2, size / 2),
          color = Math.round((depth) * 0xFF).toString(16)
      grd.addColorStop(0, 'rgba(' + color + ',' + color + ',' + color + ',1)');
      grd.addColorStop(1, 'rgba(' + color + ',' + color + ',' + color + ',0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, size, size);

      if (!brushTexture) {
        brushTexture = PIXI.Texture.fromCanvas(brushCanvas);
      } else {
        brushTexture.width = brushTexture.height = size;
        PIXI.texturesToUpdate.push(brushTexture.baseTexture);
      }
      if (!brush) {
        brushContainer = new PIXI.DisplayObjectContainer();
        brush = new PIXI.Sprite(brushTexture);
        brush.anchor.x = 0.5;
        brush.anchor.y = 0.5;
        brushContainer.addChild(brush);
      }
      brush.width = brush.height = size;
    };

    this.drawBrush = function(pos) {
      brushLastPos = {x: pos.x, y: pos.y};
      brush.x = pos.x * depthmap.size.width;
      brush.y = pos.y * depthmap.size.height;
      brush.alpha = 0.1;
      console.log('Draw', brush.x, brush.y);
      texture.render(brushContainer, null, false);
      depthmap.renderDirty = true;
    };

    this.drawBrushTo = function(pos) {
      var from = {x: brushLastPos.x, y: brushLastPos.y},
          to = pos,
          dst = Math.min(50, Math.sqrt(Math.pow((to.x - from.x) * depthmap.size.width, 2) + Math.pow((to.y - from.y) * depthmap.size.height, 2))),
          steps = Math.round(dst);
      console.log(dst, from, to);
      for (var i = 1; i <= steps; ++i) {
        var prg = i / steps;
        this.drawBrush({x: from.x + (to.x - from.x) * prg, y: from.y + (to.y - from.y) * prg});
      }
    };

    this.destroy = function() {
      if (undoTexture) undoTexture.destroy();
    };

    initialize();
  }

})(window);