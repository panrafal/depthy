/*
MIT Licensed

Copyright (c) 2014 Rafał Lindemann. http://panrafal.github.com/depthy
*/
(function(root){
  'use strict';

  // HELPER FUNCTIONS
  var extend = (root.$ && root.$.extend) || (root._ && root._.extend) || (root.angular && root.angular.extend),
      isNumber = (root.$ && root.$.isNumeric) || (root._ && root._.isNumber) || (root.angular && root.angular.isNumber),
      isMobile = function() {return root.Modernizr && root.Modernizr.isMobile;},
      Promise = (root.Q && root.Q.Promise) || (root.RSVP && root.RSVP.Promise) || root.Promise;

  var defaultOptions = {
      // preferred viewport size {width, height}
      size: null,
      // auto fitting: false, 'cover', 'contain'. False will disable retina and upscale
      fit: 'contain',
      // allow 2x upscale
      retina: true,
      // maximum upscaling to fit in viewport (through canvas stretching)
      upscale: 4,

      // animation options
      animate: false,
      animateDuration: 2,
      animatePosition: null,
      animateScale: {x: 1, y: 0.5},

      depthScale: 1,
      depthBlurSize: 4,
      depthFocus: 0.5,

      easeFactor: isMobile() ? 0.2 : 0.4,

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
        // renderUpscale = 1.05,
        readyResolver,

        imageTextureSprite, imageTextureContainer, imageRender,
        depthTextureSprite, depthTextureContainer, depthRender,

        depthFilter, compoundSprite,

        depthOffset = {x: 0, y: 0}, easedOffset = depthOffset;

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
      if (typeof(hoverElement) === 'string') hoverElement = element.ownerDocument.querySelector(hoverElement);
      if (!hoverElement) {
        console.warn('Hover element %s not found!', options.hoverElement);
        return;
      }

      hoverElement.addEventListener('mousemove', onHover, false);
      hoverElement.addEventListener('touchmove', onHover, false);
    }

    function onHover(event) {
      if (options.animate || !options.hover || !stageSize || !isReady()) return;
      // todo get rid off jQuery!
      var hoverElement = event.currentTarget,
          size = Math.min(stageSizeCPX.height, stageSizeCPX.width) * 0.9,
          pointerEvent = event.touches ? event.touches[0] : event,
          x = (pointerEvent.pageX - hoverElement.offsetLeft) / hoverElement.offsetWidth,
          y = (pointerEvent.pageY - hoverElement.offsetTop) / hoverElement.offsetHeight;
      x = Math.max(-1, Math.min(1, (x * 2 - 1) * hoverElement.offsetWidth / size));
      y = Math.max(-1, Math.min(1, (y * 2 - 1) *  hoverElement.offsetHeight / size));

      depthOffset = {x: -x, y: -y};
      renderDirty = true;
    }

    function initOrient() {
      if (window.DeviceMotionEvent) {
        window.addEventListener('devicemotion', onMotion);
      } else if (window.DeviceOrientationEvent) {
        console.warn('devicemotion unsupported!');
        window.addEventListener('deviceorientation', onOrientation);
      } else {
        console.warn('deviceorientation unsupported!');
      }
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
          renderDirty = true;
        }
        // console.log("offset %d %d ABG %d %d %d", depthOffset.x, depthOffset.y, event.alpha, event.beta, event.gamma)

      }
      lastOrientation = {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma
      };
    }

    function onMotion(event) {
      var rotation = event.rotationRate,
          gravity = event.accelerationIncludingGravity || {}
      if (!rotation) {
        // unsupported :(
        console.warn('devicemotion seems to be unsupported :(', event, rotation);
        window.removeEventListener('devicemotion', onMotion);
        window.addEventListener('deviceorientation', onOrientation);
        return;
      }
      if (options.animate || !options.orient || !isReady()) return;
      var rate = Modernizr.chrome && !Modernizr.ios ? 1 : 0.005, // Chrome doesn't give angle per second
          portrait = window.innerHeight > window.innerWidth,
          x = (portrait ? rotation.beta : rotation.alpha) * -rate,
          y = (portrait ? rotation.alpha : -rotation.beta) * -rate;

      // detect flipped orientation
      if (Math.abs(gravity.z) < 9 && (portrait ? gravity.y : gravity.x) < 0) {
        x *= -1;
        y *= -1;
      }

      if (x && y) {
        depthOffset = {
          x : Math.max(-1, Math.min(1, depthOffset.x + x)),
          y : Math.max(-1, Math.min(1, depthOffset.y + y))
        };
        renderDirty = true;
      }
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
      if (cover && size.height < max.height || !cover && size.height > max.height) {
        size.height = max.height;
        size.width = size.height * ratio;
      }
      if (cover && size.width < max.width || !cover && size.width > max.width) {
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

    function sizeFitScale(size, max, cover) {
      if (cover) {
        return max.width / max.height > size.width / size.height ?
          max.width / size.width :
          max.height / size.height;
      } else {
        return max.width / max.height > size.width / size.height ?
          max.height / size.height :
          max.width / size.width;
      }
    }

    function isReady() {
      return !!(renderer !== false && image.texture && image.size && (!depth.texture || depth.size));
    }

    // true when image and depth use the same texture...
    function isTextureShared() {
      return image.texture && depth.texture && image.texture === depth.texture;
    }

    function hasImage() {
      return !!image.texture;
    };

    function hasDepthmap() {
      return !!depth.texture;
    };


    function changeTexture(old, source) {
      if (old.url === source) return old;
      var current = {
        dirty: true
      };
      current.promise = new Promise(function(resolve, reject) {
        if (source) {
          current.url = source;
          current.texture = PIXI.Texture.fromImage(source);
          current.texture.baseTexture.premultipliedAlpha = false;
          if (current.texture.baseTexture.hasLoaded) {
            current.size = current.texture.frame;
            sizeDirty = true;
            resolve(current);
          } else {
            current.texture.addEventListener('update', function() {
              if (!current.texture) return;
              current.size = current.texture.frame;
              sizeDirty = true;
              resolve(current);
            });
            current.texture.baseTexture.source.onerror = function(error) {
              if (!current.texture) return;
              console.error('Texture load failed', error);
              current.error = true;
              current.texture.destroy(true);
              delete current.texture;
              reject(error);
            };
          }
        } else {
          console.log('Empty texture!');
          resolve(current);
        }
        // free up mem...
        if (old) {
          if (old.texture && !isTextureShared()) {
            old.texture.destroy(true);
          }
          old.texture = null;
        }
      });
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
          // 
          if (stageSize.height > options.size.height) stageSize.height = options.size.height;
          if (stageSize.width > options.size.width) stageSize.width = options.size.width;
        }
      }

      // console.log('Image %dx%d Stage %dx%d View %dx%d', image.size.width, image.size.height, stageSize.width, stageSize.height, options.size.width, options.size.height);

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

      // console.log('Stage %dx%d StageCPX %dx%d', stageSize.width, stageSize.height, stageSizeCPX.width, stageSizeCPX.height);

      canvas.style.width = stageSizeCPX.width + 'px';
      canvas.style.height = stageSizeCPX.height + 'px';
      canvas.style.marginLeft = Math.round(stageSizeCPX.width / -2) + 'px';
      canvas.style.marginTop = Math.round(stageSizeCPX.height / -2) + 'px';

      if (renderer && (renderer.width !== stageSize.width || renderer.height !== stageSize.height)) {
        renderer.resize(stageSize.width, stageSize.height);
        image.dirty = depth.dirty = true;
        stageDirty = true;
      }

      sizeDirty = false;
    }

    function updateImageTexture() {
      var scale = sizeFitScale(image.size, stageSize, true);

      // prepare image render
      imageTextureSprite = new PIXI.Sprite(image.texture);
      imageTextureSprite.scale = new PIXI.Point(scale, scale);

      imageTextureSprite.anchor = {x: 0.5, y: 0.5};
      imageTextureSprite.position = {x: stageSize.width / 2, y: stageSize.height / 2};

      // discard alpha channel
      imageTextureSprite.filters = [discardAlphaFilter];

      imageTextureContainer = new PIXI.DisplayObjectContainer();
      imageTextureContainer.addChild(imageTextureSprite);

      if (imageRender && (imageRender.width !== stageSize.width || imageRender.height !== stageSize.height)) {
        // todo: pixi errors out on this... why?
        // imageRender.resize(stageSize.width, stageSize.height);
        imageRender.destroy(true);
        imageRender = null;
      }
      imageRender = imageRender || new PIXI.RenderTexture(stageSize.width, stageSize.height);
      
      image.dirty = false;
      image.renderDirty = stageDirty = true;
    }

    function renderImageTexture() {
      imageRender.render(imageTextureContainer, null, true);
      image.renderDirty = false;
    }

    function updateDepthTexture() {
      var scale = depth.size ? sizeFitScale(depth.size, stageSize, true) : 1;

      depthTextureContainer = new PIXI.DisplayObjectContainer();

      if (hasDepthmap()) {
        // prepare depth render / filter
        depthTextureSprite = new PIXI.Sprite(depth.texture);
        depthTextureSprite.filters = [depthBlurFilter];
        depthTextureSprite.scale = new PIXI.Point(scale, scale);
        depthTextureSprite.renderable = !!depth.texture;

        depthTextureSprite.anchor = {x: 0.5, y: 0.5};
        depthTextureSprite.position = {x: stageSize.width / 2, y: stageSize.height / 2};

        if (depth.useAlpha) {
          // move inverted alpha to rgb, set alpha to 1
          depthTextureSprite.filters.push(invertedAlphaToRGBFilter);
          depthTextureSprite.filters = depthTextureSprite.filters;
        }
        depthTextureContainer.addChild(depthTextureSprite);
      } else {
        depthTextureSprite = null;
      }


      if (depthRender && (depthRender.width !== stageSize.width || depthRender.height !== stageSize.height)) {
        depthRender.destroy(true);
        depthRender = null;
      }
      depthRender = depthRender || new PIXI.RenderTexture(stageSize.width, stageSize.height);

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
      depthFilter = new PIXI.DepthPerspectiveFilter(depthRender);

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
      depthFilter.scale = (isMobile() ? 0.015 : 0.015) * (options.depthScale || 1);

      depthFilter.offset = {
        x : easedOffset.x || 0,
        y : easedOffset.y || 0
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

      if (hasDepthmap()) {
        updateOffset();
        updateAnimation();
      }

      if (readyResolver) {
        readyResolver();
        readyResolver = null;
      }

      if (renderDirty) {
        renderer.render(stage);
        renderDirty = false;
      }
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

    /** Returns a promise resolved when the viewer is ready, or rejected when any of the images are missing or failed on load.
        @param resolvedOnly TRUE - only wait for the isReady() to become true. Otherwise, the promise may be rejected
               but will be reset every time you change any of the images.
     */
    this.getPromise = function(resolvedOnly) {
      if (!resolvedOnly && (!this.hasImage() || this.getLoadError())) {
        return Promise.reject();
      }
      if (isReady()) {
        return Promise.resolve();
      }
      if (!readyResolver) {
        var promise = new Promise(function(resolve) {
          readyResolver = resolve;
        });
        readyResolver.promise = promise;
      }
      return resolvedOnly ? readyResolver.promise : Promise.all( [image.promise, depth.promise, readyResolver.promise] );
    };

    this.setImage = function(source) {
      image = changeTexture(image, source);
      return image.promise;
    };

    this.setDepthmap = function(source, useAlpha) {
      depth = changeTexture(depth, source);
      depth.useAlpha = !!useAlpha;
      return depth.promise;
    };

    this.render = render;

    this.reset = function() {
      this.setImage();
      this.setDepthmap();
    };

    this.hasImage = hasImage;

    this.hasDepthmap = hasDepthmap;

    this.getLoadError = function() {
      return image.error || depth.error;
    };

    this.setOffset = function(offset) {
      depthOffset = offset;
    };

    /** Exports image + depthmap as PNG file. Returns promise */
    this.exportToPNG = function(maxSize) {

      return this.getPromise().then(
        function() {
          if (!hasDepthmap()) return false;

          var size = sizeRound(sizeFit(image.size, maxSize || image.size)),
              localstage = new PIXI.Stage(),
              scale = size.width / image.size.width,
              localrenderer = new PIXI.WebGLRenderer(size.width, size.height, null, 'notMultiplied', true);

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
          var dataUrl = localrenderer.view.toDataURL('image/png');

          try {
            localrenderer.destroy();
          } catch(e) {
            console.error('Render destroy error', e);
          }
          return dataUrl;
        }
      );
    };


    /** Exports depthmap as is, or converts it to JPG. Returns promise */
    this.exportDepthmap = function() {

      return this.getPromise().then(
        function() {
          if (!hasDepthmap()) {
            return false;
          } else if (!depth.useAlpha && depth.url) {
            return depth.url;
          } else {
            var localstage = new PIXI.Stage(),
                localrenderer = new PIXI.WebGLRenderer(depth.size.width, depth.size.height, null, false, true);

            var depthSprite = new PIXI.Sprite(depth.texture);
            if (depth.useAlpha) depthSprite.filters = [createInvertedAlphaToRGBFilter()];

            localstage.addChild(depthSprite);

            localrenderer.render(localstage);
            var dataUrl = localrenderer.view.toDataURL('image/jpeg');

            try {
              localrenderer.destroy();
            } catch(e) {
              console.error('Render destroy error', e);
            }
            return dataUrl;
          }
        }
      );
    };


    /** Exports thumbnail as JPG file. Returns promise */
    this.exportThumbnail = function(size, quality) {
      size = size || {width: 50, height: 50};
      return this.getPromise().then(
        function() {
          var localstage = new PIXI.Stage(),
              scale = sizeFitScale(image.size, size, true),
              localrenderer = new PIXI.WebGLRenderer(size.width, size.height, null, false, true);

          var imageSprite = new PIXI.Sprite(image.texture);
          imageSprite.scale = new PIXI.Point(scale, scale);
          imageSprite.anchor = {x: 0.5, y: 0.5};
          imageSprite.position = {x: size.width / 2, y: size.height / 2};
          localstage.addChild(imageSprite);

          // discard alpha channel
          imageSprite.filters = [createDiscardAlphaFilter()];

          localrenderer.render(localstage);
          var dataUrl = localrenderer.view.toDataURL('image/jpeg', quality);

          try {
            localrenderer.destroy();
          } catch(e) {
            console.error('Render destroy error', e);
          }
          return dataUrl;
        }
      );
    };



    this.isReady = isReady;

    // STARTUP

    init();

  };

  DepthyViewer.defaultOptions = defaultOptions;

})(window);
