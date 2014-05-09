

(function(root){
  'use strict';

  // HELPER FUNCTIONS
  var extend = ($ && $.extend) || (_ && _.extend) || (angular && angular.extend),
      isNumber = ($ && $.isNumeric) || (_ && _.isNumber) || (angular && angular.isNumber),
      isMobile = function() {return Modernizr.isMobile;},
      defer = window.Deferred || ($ && $.Deferred),
      when = (window.Deferred && root.Deferred.when) || ($ && $.when);

  var defaultOptions = {
      // preferred viewport size {width, height}
      size: null,
      // auto fitting: false, 'cover', 'contain'. False will disable retina and upscale
      fit: 'contain',
      // allow 2x upscale
      retina: true,
      // maximum upscaling to fit in viewport (through canvas stretching)
      upscale: 2,

      // animation options
      animate: false,
      animateDuration: 2,
      animatePosition: null,
      animateScale: {x: 1, y: 0.5},

      depthScale: 1,
      depthBlurSize: 16,
      depthFocus: 0.5,

      easeFactor: isMobile() ? 0.2 : 0.9,

      orient: true,

      hover: true,
      // element to control mouse movements
      hoverElement: false,
    };

  var DepthyViewer = root.DepthyViewer = function(element, options) {
    var //self = this,
        canvas, stage, renderer,
        image = {}, depth = {},
        sizeDirty = true, stageDirty = true, renderDirty = true, depthFilterDirty,
        discardAlphaFilter, invertedAlphaToRGBFilter, invertedRGBToAlphaFilter, depthBlurFilter,
        stageSize, stageSizeCPX,
        renderUpscale = 1.05,
        readyDeferred,

        imageTextureSprite, imageTextureContainer, imageRender,
        depthTextureSprite, depthTextureContainer, depthRender,

        depthFilter, compoundSprite,

        depthOffset = {x: 0, y: 0}, easedOffset = depthOffset;



    /*
    TO MOVE:

      offset: {x: 0, y: 0},
      update: 1,
      ready: false,

    MOVED:
      alternativeSource: null,
      imageSource: null,
      depthSource: null,
      useAlternativeImage: false,
      depthFromAlpha: false,
      sourcesReady: true,
      sourcesDirty: null,
      imageSize: null,
      depthSize: null,
      stageSize: null,
      stageSizeCPX: null,
      viewerSize: null,


    CHANGED:

      viewportSize: null,
      coverFit: false,
      overrideStageSize: null,

      animateDuration: 2,
      animatePosition: null,
      animateScale: {x: 1, y: 0.5},
      movementElement

    */

    options = extend({}, defaultOptions, options || {});

    // PRIVATE FUNCTIONS
    function init() {

      canvas = element.getElementsByTagName('canvas')[0];
      if (!canvas) {
        canvas = element.ownerDocument.createElement('canvas');
        element.appendChild(canvas);
      }

      initHover();
      initOrient();
      initRenderer();

      if (renderer) requestAnimFrame( renderLoop );

    }
    
    function initHover() {
      var hoverElement = options.hoverElement || element;
      if (typeof(hoverElement) === 'string') hoverElement = element.ownerDocument.querySelector();
      if (!hoverElement) {
        console.warn('Hover element %s not found!', options.hoverElement);
        return;
      }

      // hoverElement.addEventListener('mousemove', onHover);
      // hoverElement.addEventListener('touchmove', onHover);
    }

    function onHover(event) {
      if (options.animate || !options.hover || !isReady()) return;
      // todo get rid off jQuery!
      var hoverElement = event.currentTarget,
          elOffset = hoverElement.offset(),
          elWidth = hoverElement.width(),
          elHeight = hoverElement.height(),
          stageSize = stageSize.height * 0.8,
          pointerEvent = event.touches ? event.touches[0] : event,
          x = (pointerEvent.pageX - elOffset.left) / elWidth,
          y = (pointerEvent.pageY - elOffset.top) / elHeight;

      x = Math.max(-1, Math.min(1, (x * 2 - 1) * elWidth / stageSize));
      y = Math.max(-1, Math.min(1, (y * 2 - 1) * elHeight / stageSize));

      depthOffset = {x: -x, y: -y};
      renderDirty = true;
    }

    function initOrient() {
      window.addEventListener('deviceorientation', onOrientation);
    }

    var lastOrientation;
    function onOrientation(event) {
      if (options.animate || !options.orient || !isReady()) return;
      if (event.beta === null || event.gamma === null) return;

      if (lastOrientation) {
        var portrait = window.innerHeight > window.innerWidth,
            beta = (event.beta - lastOrientation.beta) * 0.2,
            gamma = (event.gamma - lastOrientation.gamma) * 0.2,
            x = portrait ? -gamma : -beta,
            y = portrait ? -beta : -gamma;

        if (x && y) {
          depthOffset = {
            x : Math.max(-1, Math.min(1, depthOffset.x + x)),
            y : Math.max(-1, Math.min(1, depthOffset.y + y))
          };
        }
        // console.log("offset %d %d ABG %d %d %d", depthOffset.x, depthOffset.y, event.alpha, event.beta, event.gamma)
        renderDirty = true;

      }
      lastOrientation = {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma
      };
    }

    function initRenderer() {

      stage = new PIXI.Stage();
      try {
        renderer = new PIXI.WebGLRenderer(800, 600, canvas, false, true);

        discardAlphaFilter = createDiscardAlphaFilter();
        invertedAlphaToRGBFilter = createInvertedAlphaToRGBFilter();
        invertedRGBToAlphaFilter = createInvertedRGBToAlphaFilter();
        depthBlurFilter = createDepthBlurFilter();
      } catch (e) {
        console.error('WebGL failed', e);
        renderer = false;
        if (Modernizr) Modernizr.webgl = false;
      }


    }

    function createDiscardAlphaFilter() {
      var filter = new PIXI.ColorMatrixFilter2();
      filter.matrix = [1.0, 0.0, 0.0, 0.0,
                       0.0, 1.0, 0.0, 0.0,
                       0.0, 0.0, 1.0, 0.0,
                       0.0, 0.0, 0.0, 0.0];
      filter.shift =  [0.0, 0.0, 0.0, 0.0];
      return filter;
    }

    function createDiscardRGBFilter() {
      var filter = new PIXI.ColorMatrixFilter2();
      filter.matrix = [0.0, 0.0, 0.0, 0.0,
                       0.0, 0.0, 0.0, 0.0,
                       0.0, 0.0, 0.0, 0.0,
                       0.0, 0.0, 0.0, 1.0];
      filter.shift =  [0.0, 0.0, 0.0, 0.0];
      return filter;
    }

    function createInvertedAlphaToRGBFilter() {
      // move inverted alpha to rgb, set alpha to 1
      var filter = new PIXI.ColorMatrixFilter2();
      filter.matrix = [0.0, 0.0, 0.0,-1.0,
                       0.0, 0.0, 0.0,-1.0,
                       0.0, 0.0, 0.0,-1.0,
                       0.0, 0.0, 0.0, 0.0];
      filter.shift =  [1.0, 1.0, 1.0, 1.0];
      return filter;
    }

    function createInvertedRGBToAlphaFilter() {
      // move inverted alpha to rgb, set alpha to 1
      var filter = new PIXI.ColorMatrixFilter2();
      filter.matrix = [0.0, 0.0, 0.0, 0.0,
                       0.0, 0.0, 0.0, 0.0,
                       0.0, 0.0, 0.0, 0.0,
                      -1.0, 0.0, 0.0, 0.0];
      filter.shift =  [0.0, 0.0, 0.0, 1.0];
      return filter;
    }

    function createDepthBlurFilter() {
      return new PIXI.BlurFilter();
    }

    function sizeCopy(size, expand) {
      expand = expand || 1;
      return {width: size.width * expand, height: size.height * expand};
    }

    function sizeFit(size, max, cover) {
      var ratio = size.width / size.height;
      size = sizeCopy(size);
      if (cover && size.height < max.height || size.height > max.height) {
        size.height = max.height;
        size.width = size.height * ratio;
      }
      if (cover && size.width < max.width || size.width > max.width) {
        size.width = max.width;
        size.height = size.width / ratio;
      }
      return size;
    }

    function sizeRound(size) {
      return {
        width: Math.round(size.width),
        height: Math.round(size.height)
      };
    }

    function isReady() {
      return renderer !== false && image.texture && image.size && depth.texture && depth.size;
    }

    // true when image and depth use the same texture...
    function isTextureShared() {
      return image.texture && depth.texture && image.texture === depth.texture;
    }



    function changeTexture(old, source) {
      var current = {
        dirty: true
      };
      if (source) {
        current.texture = PIXI.Texture.fromImage(source);
        current.texture.baseTexture.premultipliedAlpha = false;
        if (current.texture.baseTexture.hasLoaded) {
          current.size = current.texture.frame;
          sizeDirty = true;
        } else {
          current.texture.addEventListener('update', function() {
            if (!current.texture) return;
            current.size = current.texture.frame;
            sizeDirty = true;
          });
          current.texture.baseTexture.source.onerror = function(error) {
            if (!current.texture) return;
            console.error('Texture load failed', error);
            current.error = true;
            current.texture.destroy(true);
            if (readyDeferred) readyDeferred.reject();
            if (options.onError) options.onError();
          };
        }
      }
      // free up mem...
      if (old) {
        if (old.texture && !isTextureShared()) {
          old.texture.destroy(true);
        }
        old.texture = null;
      }
      return current;
    }


    function updateSize() {
      var maxSize = sizeCopy(image.size, (options.fit && options.upscale) || 1);

      stageSize = sizeCopy(maxSize);

      // preferred size
      if (options.size) {
        stageSize = sizeFit(stageSize, options.size);
        if (options.fit === 'cover') {
          stageSize = sizeFit(stageSize, options.size, true);
          stageSize = sizeFit(stageSize, maxSize);
        }
      }

      // remember target size
      stageSizeCPX = sizeRound(stageSize);

      // retina
      if (options.retina && options.fit && window.devicePixelRatio >= 2) {
        stageSize.width *= 2;
        stageSize.height *= 2;
      }

      // don't upscale the canvas beyond image size
      stageSize = sizeFit(stageSize, image.size);
      stageSize = sizeRound(stageSize);

      canvas.style.width = stageSizeCPX.width + 'px';
      canvas.style.height = stageSizeCPX.height + 'px';
      canvas.style.marginLeft = Math.round(stageSizeCPX.width / -2) + 'px';
      canvas.style.marginTop = Math.round(stageSizeCPX.height / -2) - 2 + 'px';

      if (renderer && (renderer.width !== stageSize.width || renderer.height !== stageSize.height)) {
        renderer.resize(stageSize.width, stageSize.height);
        image.dirty = depth.dirty = true;
      }

      sizeDirty = false;
    }

    function updateImageTexture() {
      var scale = stageSize.width / image.size.width;

      // prepare image render
      imageTextureSprite = new PIXI.Sprite(image.texture);
      imageTextureSprite.scale = new PIXI.Point(scale * renderUpscale, scale * renderUpscale);

      // discard alpha channel
      imageTextureSprite.filters = [discardAlphaFilter];

      imageTextureContainer = new PIXI.DisplayObjectContainer();
      imageTextureContainer.addChild(imageTextureSprite);

      if (imageRender) {
        // todo: pixi errors out on this... why?
        // imageRender.resize(stageSize.width, stageSize.height);
        imageRender.destroy(true);
      }
      imageRender = new PIXI.RenderTexture(stageSize.width, stageSize.height);
      

      image.dirty = false;
      image.renderDirty = stageDirty = true;
    }

    function renderImageTexture() {
      imageRender.render(imageTextureContainer, null, true);
      image.renderDirty = false;
    }

    function updateDepthTexture() {
      var scale = stageSize.width / depth.size.width;

      // prepare depth render / filter
      depthTextureSprite = new PIXI.Sprite(depth.texture);
      depthTextureSprite.filters = [depthBlurFilter];
      depthTextureSprite.scale = new PIXI.Point(scale * renderUpscale, scale * renderUpscale);

      if (depth.useAlpha) {
        // move inverted alpha to rgb, set alpha to 1
        depthTextureSprite.filters.push(invertedAlphaToRGBFilter);
        depthTextureSprite.filters = depthTextureSprite.filters;
      }

      depthTextureContainer = new PIXI.DisplayObjectContainer();
      depthTextureContainer.addChild(depthTextureSprite);

      if (depthRender) {
        depthRender.destroy(true);
      }
      depthRender = new PIXI.RenderTexture(stageSize.width, stageSize.height);

      depth.dirty = false;
      depth.renderDirty = stageDirty = true;
    }

    function renderDepthTexture() {
      depthBlurFilter.blur = options.depthBlurSize;
      depthRender.render(depthTextureContainer);
      depth.renderDirty = false;
    }


    function updateStage() {
      // combine image with depthmap
      depthFilter = new PIXI.DepthmapFilter(depthRender);

      if (compoundSprite) {
        stage.removeChild(compoundSprite);
      }

      compoundSprite = new PIXI.Sprite(imageRender);
      compoundSprite.filters= [depthFilter];

      stage.addChild(compoundSprite);

      stageDirty = false;
      renderDirty = depthFilterDirty = true;
    }

    function updateDepthFilter() {
      var depthScale = (isMobile() ? 0.015 : 0.015) * (options.depthScale || 1);
      depthFilter.scale = {
        x: (stageSize.width > stageSize.height ? 1 : stageSize.height / stageSize.width) * depthScale,
        y: (stageSize.width < stageSize.height ? 1 : stageSize.width / stageSize.height) * depthScale
      };
      depthFilter.focus = options.depthFocus;

      depthFilterDirty = false;
      renderDirty = true;
    }

    function updateOffset() {
      if (depthOffset.x !== easedOffset.x || depthOffset.y !== easedOffset.y) {
        
        if (options.easeFactor && !options.animate) {
          easedOffset.x = easedOffset.x * options.easeFactor + depthOffset.x * (1-options.easeFactor);
          easedOffset.y = easedOffset.y * options.easeFactor + depthOffset.y * (1-options.easeFactor);
          if (Math.abs(easedOffset.x - depthOffset.x) < 0.0001 && Math.abs(easedOffset.y - depthOffset.y) < 0.0001) {
            easedOffset = depthOffset;
          }
        } else {
          easedOffset = depthOffset;
        }

        depthFilter.offset = {
          x : easedOffset.x,
          y : easedOffset.y
        };

        renderDirty = true;
      }

    }

    function updateAnimation() {
      if (options.animate) {
        var now = isNumber(options.animatePosition) ?
                    options.animatePosition * options.animateDuration * 1000
                    : (window.performance && window.performance.now ? window.performance.now() : new Date().getTime());
        depthFilter.offset = {
          x : Math.sin(now * Math.PI * 2 / options.animateDuration / 1000) * options.animateScale.x,
          y : Math.cos(now * Math.PI * 2 / options.animateDuration / 1000) * options.animateScale.y
        };

        renderDirty = true;
      }
    }

    function render() {
      if (!isReady()) return;
      if (sizeDirty) updateSize();

      if (image.dirty) updateImageTexture();
      if (image.renderDirty) renderImageTexture();

      if (depth.dirty) updateDepthTexture();
      if (depth.renderDirty) renderDepthTexture();

      if (stageDirty) updateStage();
      if (depthFilterDirty) updateDepthFilter();

      updateOffset();
      updateAnimation();

      if (readyDeferred) {
        readyDeferred.resolve();
        readyDeferred = null;
      }

      if (renderDirty) renderer.render(stage);
    }

    function renderLoop() {
      render();
      requestAnimFrame( renderLoop );
    }

    // PUBLIC FUNCTIONS

    this.setOptions = function(newOptions) {
      for(var k in newOptions) {
        if (options[k] === newOptions[k]) continue;
        options[k] = newOptions[k];
        switch(k) {
          case 'size':
          case 'fit':
          case 'retina':
          case 'upscale':
            sizeDirty = true;
            break;
          case 'depthScale':
          case 'depthFocus':
            depthFilterDirty = true;
            break;
          case 'depthBlurSize':
            depth.renderDirty = true;
            break;
          default:
            renderDirty = true;
        }
      }
    };

    this.getOptions = function() {
      return options;
    };

    this.getElement = function() {
      return element;
    };

    this.getCanvas = function() {
      return canvas;
    };

    this.getSize = function() {
      return sizeCopy(stageSize);
    };

    this.getSizeCPX = function() {
      return sizeCopy(stageSizeCPX);
    };

    this.getPromise = function() {
      if (isReady()) {
        return defer().resolve().promise();
      }
      readyDeferred = defer();
      return readyDeferred.promise();
    };

    this.setImage = function(source) {
      image = changeTexture(image, source);
    };

    this.setDepthmap = function(source, useAlpha) {
      depth = changeTexture(depth, source);
      depth.useAlpha = !!useAlpha;
    };

    this.render = render;

    this.reset = function() {
      this.setImage();
      this.setDepthmap();
    };

    this.hasImage = function() {
      return !!image.texture;
    };

    this.hasDepthmap = function() {
      return !!depth.texture;
    };

    this.getLoadError = function() {
      return image.error || depth.error;
    };

    this.setOffset = function(offset) {
      depthOffset = offset;
    };

    /** Exports image + depthmap as PNG file */
    this.exportToPNG = function(maxSize) {
      var deferred = defer();

      this.getPromise().then(
        function() {
          var size = sizeRound(sizeFit(image.size, maxSize || image.size)),
              localstage = new PIXI.Stage(),
              scale = size.width / image.size.width,
              localrenderer = new PIXI.WebGLRenderer(size.width, size.height, null, 'notMultiplied', true);

          deferred.promise().always(function() {
            try {
              localrenderer.destroy();
            } catch(e) {
              console.error('Render destroy error', e);
            }
          });

          var imageSprite = new PIXI.Sprite(image.texture);
          imageSprite.scale = new PIXI.Point(scale, scale);
          localstage.addChild(imageSprite);

          // discard alpha channel
          imageSprite.filters = [createDiscardAlphaFilter()];

          var depthSprite = new PIXI.Sprite(depth.texture);
          depthSprite.scale = new PIXI.Point(scale, scale);
          depthSprite.filters = [depth.useAlpha ? createDiscardRGBFilter() : createInvertedRGBToAlphaFilter()];

          // copy alpha using custom blend mode
          PIXI.blendModesWebGL['one.one'] = [localrenderer.gl.ONE, localrenderer.gl.ONE];
          depthSprite.blendMode = 'one.one';

          localstage.addChild(depthSprite);

          localrenderer.render(localstage);
          deferred.resolve( localrenderer.view.toDataURL('image/png') );
          
        },
        function() {
          deferred.reject();
        }
      );

      return deferred.promise();
    };


    this.isReady = isReady;

    // STARTUP

    init();

  };

  DepthyViewer.defaultOptions = defaultOptions;

})(window);
