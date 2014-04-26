'use strict';

angular.module('depthyApp')
.directive('depthyViewer', function ($window) {
  return {
    // template: '<canvas></canvas>',
    restrict: 'A',
    scope: true,
    controller: function($scope, $element, $attrs) {
      var viewer = $scope.v = $scope.$parent.$eval($attrs.depthyViewer),
          imageTexture, imageTextureSprite, imageTextureDOC, imageRender, imageRenderSprite,
          depthTexture, depthTextureSprite, depthTextureDOC, depthRender,
          depthFilter, depthBlurFilter,
          stage, renderer,
          orientation = {},
          easedOffset = {x: 0, y: 0};

      _.defaults(viewer, {
        compoundSource: null,
        imageSource: null,
        depthSource: null,
        imageSize: null,
        depthSize: null,
        // *read-only stage size
        stageSize: null,
        // *read-only stage size in css pixels
        stageCssSize: null,
        // *read-only viewer size
        viewerSize: null,
        // maximum size to fit in
        maxSize: null,
        // stageSize override
        overrideStageSize: null,
        // set it when all sources are ready (they may be loaded earlier)
        sourcesReady: true,
        // increment when sources change
        sourcesDirty: null,
        useCompoundImage: true,
        animate: false,
        animDuration: 2,
        animPosition: null,
        animScale: {x: 1, y: 0.5},
        depthScale: 1,
        depthBlurSize: 16,
        offset: {x: 0, y: 0},
        easeFactor: Modernizr.mobile ? 0.2 : 0.9,
        update: 1,
        // TRUE when everything is loaded and initialized
        ready: false,
      });

      $scope.stage = null;
      $scope.sizeDirty = 0;

      function updateDepthScale() {
        if (!viewer.ready) return;
        var depthScale = (Modernizr.mobile ? 0.015 : 0.015) * (viewer.depthScale || 1),
            stageSize = viewer.stageSize;
        depthFilter.scale = {
          x: (stageSize.width > stageSize.height ? 1 : stageSize.height / stageSize.width) * depthScale,
          y: (stageSize.width < stageSize.height ? 1 : stageSize.width / stageSize.height) * depthScale
        };
      }


      function updateTexture(texture, url, sizeKey) {
        if (!texture || texture.baseTexture.imageUrl !== url) {
          // free up mem...
          if (texture) {
            PIXI.Texture.removeTextureFromCache(texture.baseTexture.imageUrl);
            texture = null;
          }
          viewer[sizeKey] = null;
          if (url) {
            texture = PIXI.Texture.fromImage(url);
            if (texture.baseTexture.hasLoaded) {
              viewer[sizeKey] = texture.frame;
              $scope.sizeDirty++;
            } else {
              texture.addEventListener('update', function() {
                viewer[sizeKey] = texture.frame;
                $scope.sizeDirty++;
                $scope.$apply();
              });
            }
          }
        }
        return texture;
      }

      function fitIn(size, max) {
        var ratio = size.width / size.height;
        size = {width: size.width, height: size.height};
        if (size.height > max.height) {
          size.height = max.height;
          size.width = size.height * ratio;
        }
        if (size.width > max.width) {
          size.width = max.width;
          size.height = size.width / ratio;
        }
        return size;
      }


      function resetStage() {
        if (imageRenderSprite) {
          stage.removeChild(imageRenderSprite);
          imageRenderSprite = null;
          viewer.update = true;
        }

      }

      function setupStage(_stage, _renderer) {
        // remember them...
        stage = _stage;
        renderer = _renderer;

        // watch image changes - exchange textures
        $scope.$watch('[viewer.sourcesDirty, viewer.useCompoundImage, viewer.sourcesReady]', function() {
          if (!viewer.sourcesReady) return;

          imageTexture = updateTexture(imageTexture, viewer[viewer.useCompoundImage && viewer.compoundSource ? 'compoundSource' : 'imageSource'], 'imageSize');
          depthTexture = updateTexture(depthTexture, viewer.depthSource, 'depthSize');

        }, true);

        // recalculate stage size
        $scope.$watch('[viewer.imageSize, viewer.depthSize, viewer.sourcesReady, viewer.maxSize, viewer.overrideStageSize, sizeDirty]', function() {
          if (!viewer.imageSize || !viewer.depthSize || !viewer.sourcesReady) return;

          var imageSize = viewer.imageSize,
              viewerSize = {width: imageSize.width, height: imageSize.height},
              stageSize = null,
              maxSize = viewer.maxSize;

          if (maxSize) viewerSize = fitIn(viewerSize, maxSize);

          stageSize = viewerSize;
          if (viewer.overrideStageSize) {
            stageSize = fitIn(imageSize, viewer.overrideStageSize);
          }

          viewerSize = {width: Math.round(viewerSize.width), height: Math.round(viewerSize.height)};
          stageSize = {width: Math.round(stageSize.width), height: Math.round(stageSize.height)};

          viewer.stageCssSize = {width: stageSize.width, height: stageSize.height};
          // retina
          if (!viewer.overrideStageSize && window.devicePixelRatio >= 2) {
            stageSize.width *= 2;
            stageSize.height *= 2;
          }

          viewer.viewerSize = viewerSize;
          viewer.stageSize = stageSize;
        }, true);

        // recreate stage on textures / stagesize change
        $scope.$watch('[viewer.stageSize, viewer.sourcesDirty, viewer.sourcesReady, viewer.depthBlurSize, viewer.error, sizeDirty]', function() {
          resetStage();

          viewer.ready = !viewer.error && imageTexture && depthTexture && viewer.imageSize && viewer.depthSize && viewer.stageSize && viewer.sourcesReady;

          if (!viewer.ready) return;

          var imageSize = viewer.imageSize,
              stageSize = viewer.stageSize,
              depthBlurSize = viewer.depthBlurSize;

          var stageScale = stageSize.width / imageSize.width;

          renderer.resize(stageSize.width, stageSize.height);

          // prepare depth render / filter
          depthTextureSprite = new PIXI.Sprite(depthTexture);
          depthBlurFilter = new PIXI.BlurFilter();
          depthBlurFilter.blur = depthBlurSize;
          depthTextureSprite.filters = [depthBlurFilter];
          depthTextureSprite.scale = new PIXI.Point(stageScale, stageScale);

          depthTextureDOC = new PIXI.DisplayObjectContainer();
          depthTextureDOC.addChild(depthTextureSprite);

          depthRender = new PIXI.RenderTexture(stageSize.width, stageSize.height);

          depthRender.render(depthTextureDOC);

          depthFilter = new PIXI.DepthmapFilter(depthRender);
          updateDepthScale();


          // prepare image render
          imageTextureSprite = new PIXI.Sprite(imageTexture);
          imageTextureSprite.scale = new PIXI.Point(stageScale, stageScale);

          imageTextureDOC = new PIXI.DisplayObjectContainer();
          imageTextureDOC.addChild(imageTextureSprite);

          imageRender = new PIXI.RenderTexture(stageSize.width, stageSize.height);
          imageRenderSprite = new PIXI.Sprite(imageRender);
          imageRenderSprite.filters= [depthFilter];

          imageRender.render(imageTextureDOC);

          stage.addChild(imageRenderSprite);

          //render on load events
          viewer.update = true;
        }, true);

        $scope.$watch('viewer.depthScale', updateDepthScale);

        $element.on('mousemove touchmove', function(e) {
          if (!viewer.ready || viewer.animate || angular.isNumber(viewer.animPosition)) return;

          var elOffset = $element.offset(),
              elWidth = $element.width(),
              elHeight = $element.height(),
              stageSize = viewer.stageSize.height * 0.8,
              pointerEvent = e.originalEvent.touches ? e.originalEvent.touches[0] : e,
              x = (pointerEvent.pageX - elOffset.left) / elWidth,
              y = (pointerEvent.pageY - elOffset.top) / elHeight;

          x = Math.max(-1, Math.min(1, (x * 2 - 1) * elWidth / stageSize));
          y = Math.max(-1, Math.min(1, (y * 2 - 1) * elHeight / stageSize));

          if (depthFilter) {
            viewer.offset = {x: -x, y: -y};
            viewer.update = true;
          }
          
        });

        $window.addEventListener('deviceorientation', function(event) {
          if (!viewer.ready || viewer.animate || angular.isNumber(viewer.animPosition)) return;
          if (event.beta === null || event.gamma === null) return;

          if (orientation) {
            var portrait = window.innerHeight > window.innerWidth,
                beta = (event.beta - orientation.beta) * 0.2,
                gamma = (event.gamma - orientation.gamma) * 0.2,
                x = portrait ? -gamma : -beta,
                y = portrait ? -beta : -gamma;

            if (x && y) {
              viewer.offset = {
                x : Math.max(-1, Math.min(1, viewer.offset.x + x)),
                y : Math.max(-1, Math.min(1, viewer.offset.y + y))
              };
            }
            // console.log("offset %d %d ABG %d %d %d", viewer.offset.x, viewer.offset.y, event.alpha, event.beta, event.gamma)
            viewer.update = true;

          }
          orientation = {
            alpha: event.alpha,
            beta: event.beta,
            gamma: event.gamma
          };
        });



      }


      var stageReady = false;
      $scope.pixiRender = function(stage, renderer) {
        if (!stageReady) {
          setupStage(stage, renderer);
          stageReady = true;
          $scope.$apply();
          return;
        }

        if (viewer.offset.x !== easedOffset.x || viewer.offset.y !== easedOffset.y) {
          
          if (viewer.easeFactor && !angular.isNumber(viewer.animPosition)) {
            easedOffset.x = easedOffset.x * viewer.easeFactor + viewer.offset.x * (1-viewer.easeFactor);
            easedOffset.y = easedOffset.y * viewer.easeFactor + viewer.offset.y * (1-viewer.easeFactor);
            if (Math.abs(easedOffset.x - viewer.offset.x) < 0.0001 && Math.abs(easedOffset.y - viewer.offset.y) < 0.0001) {
              easedOffset = viewer.offset;
            }
          } else {
            easedOffset = viewer.offset;
          }

          depthFilter.offset = {
            x : easedOffset.x,
            y : easedOffset.y
          };
          viewer.update = true;
        }

        if (viewer.animate || angular.isNumber(viewer.animPosition)) {
          var now = angular.isNumber(viewer.animPosition) ?
                      viewer.animPosition * viewer.animDuration * 1000
                      : (Modernizr.performance ? window.performance.now() : new Date().getTime());
          depthFilter.offset = {
            x : Math.sin(now * Math.PI * 2 / viewer.animDuration / 1000) * viewer.animScale.x,
            y : Math.cos(now * Math.PI * 2 / viewer.animDuration / 1000) * viewer.animScale.y
          };

          viewer.update = true;
        }


        if (!viewer.update) {
          return false;
        }

        viewer.update = false;
      };



    },
    link: function postLink() {

    }
  };

});
