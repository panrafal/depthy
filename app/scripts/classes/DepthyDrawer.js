/*
MIT Licensed

Copyright (c) 2014 Rafał Lindemann. http://panrafal.github.com/depthy
*/
(function(root){
  'use strict';

  var DepthyDrawer = root.DepthyDrawer = function(viewer) {

    var self = this,
        texture, undoTexture,
        lastUndoTime, redoMode = false,
        brush, brushCanvas, brushTexture, brushContainer, brushLastPos, brushDirty,
        options,
        renderer = viewer.getRenderer(),
        depthmap = viewer.getDepthmap(),
        image = viewer.getImage(),
        modified = false, canceled = false,
        unit;

    options = {
      depth: 0.5,
      size: 0.02,
      hardness: 0.0,
      opacity: 1.0,
      spacing: 0.1,
      slope: 0.5,
      blend: PIXI.blendModes.NORMAL,
      undoTimeout: 2000,
    };

    function initialize() {

      // always start with a new one...
      if (true || depthmap.texture instanceof PIXI.RenderTexture === false) {
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
      // brushCanvas.id = 'draw-brushcanvas';
      // viewer.getElement().appendChild(brushCanvas);
      brushDirty = true;
    }

    function updateBrush() {

      var ctx = brushCanvas.getContext('2d'),
          depth = options.depth,
          size = options.size * unit,
          hardness = Math.max(0, Math.min(0.99, options.hardness))
          
      brushCanvas.width = brushCanvas.height = size;
      ctx.clearRect(0, 0, size, size);


      var grd = ctx.createRadialGradient(size / 2, size / 2, size / 2 * hardness, size / 2, size / 2, size / 2),
          color = Math.round((depth) * 0xFF)
      grd.addColorStop(0, 'rgba(' + color + ',' + color + ',' + color + ',' + options.opacity + ')');
      grd.addColorStop(options.slope, 'rgba(' + color + ',' + color + ',' + color + ',' + (0.5 * options.opacity) + ')');
      grd.addColorStop(1, 'rgba(' + color + ',' + color + ',' + color + ',0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, size, size);

      // console.log('updateBrush!', options, color, grd);

      if (!brushTexture) {
        brushTexture = PIXI.Texture.fromCanvas(brushCanvas);
      } else {
        brushTexture.width = brushTexture.height = size;
        // PIXI.texturesToUpdate.push(brushTexture.baseTexture);
        PIXI.updateWebGLTexture(brushTexture.baseTexture, renderer.gl);
      }
      if (!brush) {
        brushContainer = new PIXI.DisplayObjectContainer();
        brush = new PIXI.Sprite(brushTexture);
        brush.anchor.x = 0.5;
        brush.anchor.y = 0.5;
        brushContainer.addChild(brush);
      }
      brush.width = brush.height = size;
      brushDirty = false;
    }

    function throttledStoreUndo(force) {
      if (force || redoMode || !lastUndoTime || new Date() - lastUndoTime > options.undoTimeout) {
        storeUndo();
      }
      lastUndoTime = new Date();
    }

    function storeUndo() {
      if (!undoTexture) {
        undoTexture = new PIXI.RenderTexture(texture.width, texture.height);
      }
      console.log('Undo stored!');
      redoMode = false;
      var sprite = new PIXI.Sprite(texture);
      undoTexture.render(sprite, null, true);
    }

    function toggleUndo() {
      if (!undoTexture) return;
      
      var tmp = undoTexture;
      undoTexture = texture;
      texture = tmp;
      redoMode = !redoMode;

      console.log('Toggle undo!', texture);

      depthmap.shared = true; // won't be destroyed
      viewer.setDepthmap(texture);
      depthmap = viewer.getDepthmap();
    }

    this.setOptions = function(newOptions) {
      for(var k in newOptions) {
        if (options[k] === newOptions[k]) continue;
        options[k] = newOptions[k];
        switch(k) {
          case 'depth':
          case 'size':
          case 'hardness':
          case 'opacity':
          case 'spacing':
          case 'slope':
            brushDirty = true;
            break;
        }
      }
    }

    this.getOptions = function() {
      var oc = {};
      for(var k in options) oc[k] = options[k];
      return oc;
    };    

    /* -1 undo, 1 redo, 0 no history */
    this.getUndoMode = function() {
      return redoMode ? 1 : undoTexture ? -1 : 0;
    }

    this.toggleUndo = toggleUndo;

    this.drawBrush = function(pos) {
      if (brushDirty) updateBrush();
      throttledStoreUndo();
      brushLastPos = {x: pos.x, y: pos.y};
      brush.x = pos.x * depthmap.size.width;
      brush.y = pos.y * depthmap.size.height;
      // brush.alpha = options.opacity;
      brush.blendMode = options.blend;
      // console.log('Draw', brush.x, brush.y);
      texture.render(brushContainer, null, false);
      depthmap.renderDirty = true;
      modified = true;
    };

    this.drawBrushTo = function(pos) {
      var from = {x: brushLastPos.x, y: brushLastPos.y},
          to = pos,
          dst = Math.sqrt(Math.pow((to.x - from.x) * depthmap.size.width, 2) + Math.pow((to.y - from.y) * depthmap.size.height, 2)),
          step = Math.round(Math.max(1, options.spacing * options.size * unit)),
          steps = dst / step;
      // console.log(dst, step, steps/*, from, to*/);
      for (var i = 1; i <= steps; ++i) {
        var prg = i / steps;
        this.drawBrush({x: from.x + (to.x - from.x) * prg, y: from.y + (to.y - from.y) * prg});
      }
    };

    this.getDepthAtPos = function(pos) {
      return PIXI.glReadPixels(renderer.gl, texture, pos.x * depthmap.size.width, pos.y * depthmap.size.height, 1, 1)[0] / 255;
    };

    this.isModified = function() {
      return modified;
    };

    this.isCanceled = function() {
      return canceled;
    };

    this.cancel = function() {
      canceled = true;
    };

    this.destroy = function(destroyTexture) {
      if (undoTexture) undoTexture.destroy();
      if (brushTexture) brushTexture.destroy();
      if (destroyTexture && texture) texture.destroy();
      depthmap.shared = false;
    };

    initialize();
  };

})(window);