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
      sizeDivisible: 1,
      // auto fitting: false, 'cover', 'contain'. False will disable retina and upscale
      fit: 'contain',
      // allow 2x upscale
      retina: true,
      // maximum upscaling to fit in viewport (through canvas stretching)
      upscale: 1,
      // image enlargment to protect from overflowing edges
      enlarge: 1.06,

      // animation options
      animate: false,
      animateDuration: 2,
      animatePosition: null,
      animateScale: {x: 1, y: 0.5},

      depthScale: 1,
      depthBlurSize: 4,
      depthFocus: 0.5,
      depthPreview: 0,

      easeFactor: isMobile() ? 0.2 : 0.4,

      orient: 2,

      hover: true,
      // element to control mouse movements
      hoverElement: false,

      // 1, 2, 3, 4, 5 or false for auto
      quality: false,
      qualityMin: 1,
      qualityMax: 5,
      qualityStart: isMobile() ? 3 : 4,

      alwaysRender: false,
      pauseRender: false,
    };

  var DepthyViewer = root.DepthyViewer = function(element, options) {
    var self = this,
        canvas, stage, renderer, stats,
        image = {}, depth = {},
        sizeDirty = true, stageDirty = true, renderDirty = true, depthFilterDirty = true, 
        discardAlphaFilter, resetAlphaFilter, invertedAlphaToRGBFilter, discardRGBFilter, invertedRGBToAlphaFilter, depthBlurFilter, grayscaleFilter,
        stageSize, stageSizeCPX,
        // renderUpscale = 1.05,
        readyResolver,
        quality = {current: options.qualityStart || 4, dirty: true, provenSlow: {}},

        imageTextureSprite, imageTextureContainer, imageRender,
        depthTextureSprite, depthTextureContainer, depthRender,

        depthFilter, compoundSprite, previewSprite,

        depthOffset = {x: 0, y: 0}, easedOffset = depthOffset;

    options = extend({}, defaultOptions, options || {});

    // PRIVATE FUNCTIONS
    function init() {

      canvas = element.getElementsByTagName('canvas')[0];
      if (!canvas) {
        canvas = element.ownerDocument.createElement('canvas');
        element.appendChild(canvas)
;      }

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
      var rate = (Modernizr.chrome && !Modernizr.ios ? 1 : 0.005) / options.orient, // Chrome doesn't give angle per second
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
        resetAlphaFilter = createDiscardAlphaFilter(1.0);
        invertedAlphaToRGBFilter = createInvertedAlphaToRGBFilter();
        discardRGBFilter = createDiscardRGBFilter();
        invertedRGBToAlphaFilter = createInvertedRGBToAlphaFilter();
        depthBlurFilter = createDepthBlurFilter();
        grayscaleFilter = createGrayscaleFilter();
      } catch (e) {
        console.error('WebGL failed', e);
        renderer = false;
        if (Modernizr) Modernizr.webgl = false;
      }

    }


    function createDiscardAlphaFilter(alphaConst) {
      var filter = new PIXI.ColorMatrixFilter2();
      filter.matrix = [1.0, 0.0, 0.0, 0.0,
                       0.0, 1.0, 0.0, 0.0,
                       0.0, 0.0, 1.0, 0.0,
                       0.0, 0.0, 0.0, 0.0];
      filter.shift =  [0.0, 0.0, 0.0, alphaConst || 0.0];
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

    function createGrayscaleFilter() {
      // move inverted alpha to rgb, set alpha to 1
      var filter = new PIXI.ColorMatrixFilter();
      filter.matrix = [0.333, 0.333, 0.333, 0.0,
                       0.333, 0.333, 0.333, 0.0,
                       0.333, 0.333, 0.333, 0.0,
                       0.0, 0.0, 0.0, 1.0];
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
      if ((old.texture === source)|| old.url === source) return old;
      var current = {
        dirty: true
      };
      current.promise = new Promise(function(resolve, reject) {
        if (source) {
          if (source instanceof PIXI.RenderTexture) {
            current.texture = source;
          } else {
            current.texture = PIXI.Texture.fromImage(source);
            current.url = source;
          }
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
          if (old.texture && !isTextureShared() && !old.shared) {
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

      if (options.sizeDivisible > 1) {
        stageSize.width -= stageSize.width % options.sizeDivisible;
        stageSize.height -= stageSize.height % options.sizeDivisible;
      }
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
      renderDirty = true;
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
      depthRender.render(depthTextureContainer, null, true);
      depth.renderDirty = false;
      renderDirty = true;
    }


    var depthFiltersCache = {};
    function updateStage() {
      // combine image with depthmap
      var q = options.quality || quality.current;
      if (!depthFilter || depthFilter.quality !== q) {
        depthFiltersCache[q] = depthFilter = depthFiltersCache[q] || 
            (q === 1 ? new PIXI.DepthDisplacementFilter(depthRender)
                    : new PIXI.DepthPerspectiveFilter(depthRender, q));
        depthFilter.quality = q;
        // depthFilter = new PIXI.DepthDisplacementFilter(depthRender);
      }
      if (depthFilter.map !== depthRender) {
        depthFilter.map = depthRender;
      }

      if (compoundSprite) {
        stage.removeChild(compoundSprite);
      }

      compoundSprite = new PIXI.Sprite(imageRender);
      compoundSprite.filters= [depthFilter];

      stage.addChild(compoundSprite);

      if (previewSprite) stage.removeChild(previewSprite);
      previewSprite = new PIXI.Sprite(depthRender);
      stage.addChild(previewSprite);

      stageDirty = false;
      renderDirty = depthFilterDirty = true;
      quality.dirty = true;
    }

    function updateDepthFilter() {
      depthFilter.scale = 0.02 * (options.depthScale);

      depthFilter.offset = {
        x : easedOffset.x || 0,
        y : easedOffset.y || 0
      };
      depthFilter.focus = options.depthFocus;
      depthFilter.enlarge = options.enlarge;

      previewSprite.visible = options.depthPreview != 0;
      previewSprite.alpha = options.depthPreview;

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

    function changeQuality(q) {
      quality.measured = true;
      q = Math.max(options.qualityMin, Math.min(options.qualityMax, q));
      if (q !== quality.current) {
        if (q > quality.current && quality.provenSlow[q] && stageSize.width * stageSize.height >= quality.provenSlow[q]) {
          console.warn('Quality %d proven to be slow for size %d >= %d at %d', q, stageSize.width * stageSize.height, quality.provenSlow[q], quality.avg);
        } else {
          console.warn('Quality change %d -> %d at %d fps', quality.current, q, quality.avg);
          quality.current = q;
          stageDirty = true;
        }
      } else {
        console.warn('Quality %d is ok at %d fps', q, quality.avg);
      }
      updateDebug();
    }

    function updateQuality() {
      if (!hasDepthmap() || !hasImage() || options.quality) return;
      if (quality.dirty) {
        console.log('Quality reset');
        quality.count = quality.slow = quality.fast = quality.sum = 0;
        quality.measured = false;
        quality.dirty = false;
        updateDebug();
      }
      quality.count++;
      quality.fps = 1000 / quality.ms;
      quality.sum += quality.fps;
      quality.avg = quality.sum / quality.count;
      if (quality.fps < 10) { // 20fps
        quality.slow++;
      } else if (quality.fps > 58) { // 50fps
        quality.fast++;
      }
      
      // console.log('Quality ', quality);

      if (quality.slow > 5 || (quality.count > 15 && quality.avg < (quality.current > 4 ? 55 : 25))) {
        // quality 5 is slow below 55
        // log this stagesize as slow...
        if (!options.quality) quality.provenSlow[quality.current] = stageSize.width * stageSize.height;
        changeQuality(quality.current - 1);
      } else if (/*quality.fast > 30 ||*/ quality.count > 40 && quality.avg > (quality.current > 3 ? 55 : 50)) {
        // quality 4 is fast above 55
        // log this 
        changeQuality(quality.current + 1);
      } else if (quality.count > 60) {
        changeQuality(quality.current);
      } else {
        // render a bit more please...
        renderDirty = true;
      }
    }

    function updateDebug() {
      if (stats) {
        stats.domElement.className = 'q' + quality.current + (quality.measured ? '' : ' qm');
        stats.infoElement.textContent = 'Q' + (options.quality || quality.current) + (quality.measured ? '' : '?') + ' <' + quality.slow + ' >' + quality.fast + ' n' + quality.count + ' ~' + Math.round(quality.avg);
      }
    }

    function renderStage() {
      renderer.render(stage);
      renderDirty = false;
    }

    function update() {
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
    }

    function render() {
      if (!isReady()) return;

      update();

      if (renderDirty || options.alwaysRender) {
        renderStage();
      }

      if (quality.dirty || !quality.measured) {
        updateQuality();
      }
      
    }

    var lastLoopTime = 0;
    function renderLoop() {
      if (!options.pauseRender) {
        quality.ms = lastLoopTime && (performance.now() - lastLoopTime);
        lastLoopTime = performance.now();

        stats && stats.begin();
        render();
        stats && stats.end();
      }
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
          case 'quality':
            stageDirty = true;
            updateDebug();
            break;
          case 'depthScale':
          case 'depthFocus':
          case 'depthPreview':
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
      var oc = {};
      for(var k in options) oc[k] = options[k];
      return oc;
    };

    this.getElement = function() {
      return element;
    };

    this.getCanvas = function() {
      return canvas;
    };

    this.getRenderer = function() {
      return renderer;
    };

    this.getSize = function() {
      return sizeCopy(stageSize);
    };

    this.getSizeCPX = function() {
      return sizeCopy(stageSizeCPX);
    };

    this.getQuality = function() {
      return quality.current;
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

    this.getImage = function() {
      return image;
    };

    this.setDepthmap = function(source, useAlpha) {
      depth = changeTexture(depth, source);
      depth.useAlpha = !!useAlpha;
      return depth.promise;
    };

    this.getDepthmap = function() {
      return depth;
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

    this.screenToImagePos = function(pos, clamp) {
      var rect = canvas.getBoundingClientRect();
      pos = {x: pos.x, y: pos.y};
      pos.x = (pos.x - rect.left) / rect.width;
      pos.y = (pos.y - rect.top) / rect.height;
      if (clamp) {
        pos.x = Math.max(0, Math.min(1, pos.x));
        pos.y = Math.max(0, Math.min(1, pos.y));
      }
      return pos;
    };

    /** Exports image + depthmap as PNG file. Returns promise */
    this.exportToPNG = function(maxSize) {

      return this.getPromise().then(
        function() {
          if (!hasDepthmap()) return false;

          var size = sizeRound(sizeFit(image.size, maxSize || image.size)),
              localstage = new PIXI.Stage(),
              scale = size.width / image.size.width,
              depthScale = size.width / depth.size.width,
              // we need unmultiplied canvas for this... 
              // it uploads images to the GPU once again, and won't work with local textures, but... well...
              localrenderer = new PIXI.WebGLRenderer(size.width, size.height, null, 'notMultiplied', true);

          var imageSprite = new PIXI.Sprite(image.texture);
          imageSprite.scale = new PIXI.Point(scale, scale);
          localstage.addChild(imageSprite);

          // discard alpha channel
          imageSprite.filters = [createDiscardAlphaFilter()];
          console.log(depth.texture);
          var depthSprite = new PIXI.Sprite(depth.texture);
          depthSprite.scale = new PIXI.Point(depthScale, depthScale);
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


    function exportTexture(source, options) {
      return source.promise.then(
        function() {
          if (!source.texture) {
            return false;
          } else if (options.allowDirect && source.url) {
            return source.url;
          } else {
            var size = sizeCopy(options.size || source.size);
            if (options.maxSize) size = sizeFit(size, options.maxSize);
            if (options.minSize) size = sizeFit(size, options.minSize, true);
            size = sizeRound(size);

            var localstage = new PIXI.Stage(),
                scale = sizeFitScale(source.size, size, true),
                renderTexture = new PIXI.RenderTexture(size.width, size.height);

            var sourceSprite = new PIXI.Sprite(source.texture);
            if (options.filters) sourceSprite.filters = options.filters;
            sourceSprite.scale = new PIXI.Point(scale, scale);
            sourceSprite.anchor = {x: 0.5, y: 0.5};
            sourceSprite.position = {x: size.width / 2, y: size.height / 2};

            localstage.addChild(sourceSprite);

            renderTexture.render(localstage, null, true);
            var canvas = PIXI.glReadPixelsToCanvas(renderer.gl, renderTexture, 0, 0, renderTexture.width, renderTexture.height),
                dataUrl = canvas.toDataURL(options.type || 'image/jpeg', options.quality || undefined);

            try {
              renderTexture.destroy();
            } catch(e) {
              console.error('Render destroy error', e);
            }
            return dataUrl;
          }
        }
      );
    }

    /** Exports depthmap as is, or converts it to JGP. Returns promise */
    this.exportDepthmap = function(options) {
      return exportTexture(depth, extend({
        // allowDirect: !depth.useAlpha,
        filters: depth.useAlpha ? [invertedAlphaToRGBFilter] : [grayscaleFilter],
      }, options));
    };

    this.exportImage = function(options) {
      return exportTexture(image, extend({
        filters: [resetAlphaFilter]
      }, options));
    };

    this.exportSourceImage = function(source, options) {
      source = changeTexture({}, source);
      return exportTexture(source, extend({
        filters: [resetAlphaFilter]
      }, options));
    };

    this.exportDepthmapAsTexture = function(maxSize) {
      var size = sizeCopy(image.size);
      if (maxSize) size = sizeFit(size, maxSize);
      size = sizeRound(size);

      var texture = new PIXI.RenderTexture(size.width, size.height);

      var container = new PIXI.DisplayObjectContainer();
      if (hasDepthmap()) {
        var scale = sizeFitScale(depth.size, size, true);
        
        var sprite = new PIXI.Sprite(depth.texture);
        sprite.scale = new PIXI.Point(scale, scale);
        sprite.anchor = {x: 0.5, y: 0.5};
        sprite.position = {x: size.width / 2, y: size.height / 2};
        if (depth.useAlpha) {
          sprite.filters = [invertedAlphaToRGBFilter];
        } else {
          sprite.filters = [grayscaleFilter];
        }
        container.addChild(sprite);
      } else {
        // flat is in the back
        var graphics = new PIXI.Graphics();
        graphics.beginFill(0xFFFFFF, 1);
        graphics.drawRect(0, 0, size.width, size.height);
        container.addChild(graphics);
      }

      texture.render(container, null, true);
      return texture;
    };

    /** Exports thumbnail as JPG file. Returns promise */
    this.exportThumbnail = function(size, quality) {
      size = size || {width: 50, height: 50};
      return this.getPromise().then(
        function() {
          var localstage = new PIXI.Stage(),
              scale = sizeFitScale(image.size, size, true),
              renderTexture = new PIXI.RenderTexture(size.width, size.height);

          var imageSprite = new PIXI.Sprite(image.texture);
          imageSprite.scale = new PIXI.Point(scale, scale);
          imageSprite.anchor = {x: 0.5, y: 0.5};
          imageSprite.position = {x: size.width / 2, y: size.height / 2};
          localstage.addChild(imageSprite);

          // discard alpha channel
          imageSprite.filters = [resetAlphaFilter];

          renderTexture.render(localstage, null, true);
          var canvas = PIXI.glReadPixelsToCanvas(renderer.gl, renderTexture, 0, 0, renderTexture.width, renderTexture.height),
              dataUrl = canvas.toDataURL('image/jpeg', quality);


          try {
            renderTexture.destroy();
          } catch(e) {
            console.error('Render destroy error', e);
          }
          return dataUrl;
        }
      );
    };

    this.exportAnaglyph = function(exportOpts) {
      return this.getPromise().then(
        function() {

          var size = sizeCopy(exportOpts.size || image.size);
          if (exportOpts.maxSize) size = sizeFit(size, exportOpts.maxSize);
          if (exportOpts.minSize) size = sizeFit(size, exportOpts.minSize, true);
          size = sizeRound(size);

          var oldOptions = self.getOptions();

          self.setOptions({
            animate: false,
            size: size,
            fit: false,
            orient: false,
            hover: false,
            depthPreview: 0,
            quality: 5,
          });

          // enforce settings
          update();

          var localstage = new PIXI.Stage(),
              leftEye, rightEye, filter;

          leftEye = compoundSprite;
          depthFilter.offset = {x: -1, y: 0.5};
          filter = new PIXI.ColorMatrixFilter2();
          filter.matrix = [1.0, 0.0, 0.0, 0.0,
                           0.0, 0.0, 0.0, 0.0,
                           0.0, 0.0, 0.0, 0.0,
                           0.0, 0.0, 0.0, 1.0];
          leftEye.filters.push(filter);
          leftEye.filters = leftEye.filters;
          localstage.addChild(leftEye);

          // right eye
          compoundSprite = null;
          depthFilter = new PIXI.DepthPerspectiveFilter(depthRender, options.quality); // independent copy
          depthFilter.quality = options.quality; // enforce it
          updateStage(); // recreate sprite
          updateDepthFilter();

          rightEye = compoundSprite;
          depthFilter.offset = {x: 1, y: 0.5};
          filter = new PIXI.ColorMatrixFilter2();
          filter.matrix = [0.0, 0.0, 0.0, 0.0,
                           0.0, 1.0, 0.0, 0.0,
                           0.0, 0.0, 1.0, 0.0,
                           0.0, 0.0, 0.0, 1.0];
          rightEye.filters.push(filter);
          rightEye.filters = rightEye.filters;

          PIXI.blendModesWebGL['one.one'] = [renderer.gl.ONE, renderer.gl.ONE];
          rightEye.blendMode = 'one.one';

          // rightEye.blendMode = PIXI.blendModes.NORMAL;
          localstage.addChild(rightEye);

          // render...
          renderer.render(localstage);
          // store
          var dataUrl = canvas.toDataURL('image/jpeg', exportOpts.quality || 0.9);

          // done!
          compoundSprite = null;
          depthFilter = null;

          self.setOptions(oldOptions);
          // make full render cycle
          render();

          return dataUrl;
        }
      );
    };

    this.enableDebug = function() {
      if (window.Stats) {
        stats = new window.Stats();
        stats.setMode(0); // 0: fps, 1: ms
        stats.infoElement = document.createElement( 'div' );
        stats.infoElement.className = 'info';
        stats.domElement.appendChild(stats.infoElement);
        document.body.appendChild( stats.domElement );
        updateDebug();
      }
    };

    this.isReady = isReady;

    // STARTUP

    init();

  };

  DepthyViewer.defaultOptions = defaultOptions;

})(window);
