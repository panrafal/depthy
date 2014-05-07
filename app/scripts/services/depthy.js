'use strict';

angular.module('depthyApp').provider('depthy', function depthy() {

  // global settings object, synchronized with the remote profile, only simple values!
  var viewer = {
      imageSource: false,
      depthSource: false,
      alternativeSource: false,
      sourcesReady: true,
      sourcesDirty: 1,
      coverFit: false,
      movementElement: 'body'
    };



  this.$get = function(ga, $timeout, $rootScope, $document, $window, $q, $modal, $state, $location) {
    var depthy = {
      viewer: viewer,

      loaded: {},

      animatePopuped: false,
      exportPopuped: false,

      exportSize: Modernizr.mobile ? 150 : 300,
      exportType: 'gif',

      imgurId: 'b4ca5b16efb904b',

      // true - opened fully, 'samples' opened on samples
      leftpaneOpened: false,

      movearoundShow: false,

      zenMode: false,

      isProcessing: function() {
        return !viewer.sourcesReady;
      },
      hasImage: function() {
        return !!viewer.imageSource;
      },
      hasDepthmap: function() {
        return !!viewer.depthSource;
      },
      hasAlternativeImage: function() {
        return !!viewer.alternativeSource;
      },
      hasCompleteImage: function() {
        return this.hasImage() && this.hasDepthmap();
      },

      getViewerCtrl: function() {
        return angular.element('[depthy-viewer]').controller('depthyViewer');
      },


      showModal: function(state, options) {
        // push state for back button
        state = state;
        if (state && $state.current.name !== state && !options.stateCurrent) $state.go(state, options.stateParams, options.stateOptions);
        var modal, deregister;
        modal = $modal.open(options || {});

        modal.result.then(
          function() {
            if (deregister) deregister();
            if (state) $location.replace();
          },
          function() {
            if (deregister) deregister();
            if (state) $window.history.back();
          }
        );

        if (state) {
          deregister = $rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState) {
            if (fromState.name === state) {
              deregister();
              deregister = null;
              state = false;
              modal.close();
            }
          });
        }
        return modal;
      },

      showAlert: function(message, options, state) {
        return this.showModal(state || 'alert', angular.extend({
          templateUrl: 'views/alert-modal.html',
          windowClass: 'alert-modal',
          scope: angular.extend($rootScope.$new(), {message: message}),
        }, options || {}));
      },

      loadSampleImage: function(name) {
        if (depthy.loaded.sample === name) return;
        this._resetSources();
        this._changeSource('alternativeSource', 'samples/'+name+'-alternative.jpg');
        this._changeSource('depthSource', 'samples/'+name+'-depth.jpg');
        this._changeSource('imageSource', 'samples/'+name+'-image.jpg');
        viewer.sourcesReady = true;
        depthy.loaded = {
          sample: name,
          name: name,
          shareUrl: $state.href('sample', {id: name}, {absolute: true}),
          thumb: 'samples/'+name+'-thumb.jpg',
        };
      },

      loadLocalImage: function(file) {
        var reader = new FileReader(), 
            deferred = $q.defer(); 

        this._resetSources();
        depthy.loaded = {
          local: true,
          parsed: true,
          name: (file.name || '').replace(/\.(jpe?g|png)$/i, ''),
        };

        if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
          viewer.sourcesReady = true;
          deferred.reject('Only JPEG and PNG files are supported!');
        } else {
          reader.onload = function() {
            depthy._parseArrayBuffer(reader.result, deferred);
          };
          reader.readAsArrayBuffer(file);
        }

        return deferred.promise;
      },

      loadUrlImage: function(url, loadedInfo) {
        if (depthy.loaded.url === url) return;

        this._resetSources();
        depthy.loaded = angular.extend({
          url: url,
          parsed: true,
        }, loadedInfo || {});

        var xhr = new XMLHttpRequest(),
            deferred = $q.defer(); 
        //todo: cors
        xhr.open( 'get', url );
        xhr.responseType = 'arraybuffer';
        xhr.onload = function() {
          depthy._parseArrayBuffer(this.response, deferred);
        };
        xhr.send( null );
        return deferred.promise;
      },


      loadUrlDirectImage: function(url, isPng, loadedInfo) {
        if (depthy.loaded.url === url) return;

        this._resetSources();

        this._changeSource('alternativeSource', false);
        this._changeSource('depthSource', isPng ? url : false);
        this._changeSource('imageSource', url);
        viewer.depthFromAlpha = isPng;
        viewer.sourcesReady = true;
        depthy.loaded = angular.extend({
          url: url,
          parsed: false,
        }, loadedInfo || {});
      },

      _changeSource: function(type, source) {
        //todo: release blob url
        viewer[type] = source;
        viewer.sourcesDirty++;
      },

      _resetSources: function() {
        this._changeSource('imageSource', false);
        this._changeSource('depthSource', false);
        this._changeSource('alternativeSource', false);
        viewer.depthFromAlpha = false;
        viewer.sourcesReady = false;
        this.markImageAsNew();
      },

      markImageAsNew: function() {
        delete this.loaded.shareUrl;
      },

      _parseArrayBuffer: function(buffer, deferred) {
        var byteArray = new Uint8Array(buffer);
        if (isJpg(byteArray)) {
          var reader = new DepthReader();

          var result = function(error) {
            // no matter what, we use it...
            console.log('DepthExtractor result', error);
            depthy._changeSource('imageSource', URL.createObjectURL( new Blob([buffer], {type: 'image/jpeg'}) ));
            depthy._changeSource('depthSource', reader.depth.data ? 'data:' + reader.depth.mime + ';base64,' + reader.depth.data : false);
            depthy._changeSource('alternativeSource', reader.image.data ? 'data:' + reader.image.mime + ';base64,' + reader.image.data : false);
            viewer.sourcesReady = true;
            deferred.resolve(!!viewer.depthSource);
          };

          reader.parseFile(buffer, result, result);
        } else if (isPng(byteArray)) {
          // 8b signature, 4b chunk length, 4b chunk type
          // IHDR: 4b width, 4b height, 1b bit depth, 1b color type
          var bitDepth = byteArray[24],
              colorType = byteArray[25],
              isTransparent = colorType === 4 || colorType === 6, 
              imageSource = URL.createObjectURL( new Blob([buffer], {type: 'image/jpeg'}) );
          console.log('PNG depth %d colorType %d transparent %s', bitDepth, colorType, isTransparent);

          depthy._changeSource('imageSource', imageSource);
          depthy._changeSource('depthSource', isTransparent ? imageSource : false);
          depthy._changeSource('alternativeSource', false);
          viewer.depthFromAlpha = isTransparent;
          viewer.sourcesReady = true;
          deferred.resolve(isTransparent);

        } else {
          viewer.sourcesReady = true;
          viewer.sourcesDirty++;
          deferred.reject('JPG required!');
        }
        deferred.promise.finally(function() {
          $scope.$safeApply();
        })
      },

      loadLocalDepthmap: function(file) {
        var reader = new FileReader(), 
            deferred = $q.defer(); 

        if (file.type === 'image/jpeg') {
          // look for depthmap
          reader.onload = function() {
            var buffer = reader.result,
                byteArray = new Uint8Array(buffer);
            if (isJpg(byteArray)) {
              var depthReader = new DepthReader();

              var result = function() {
                depthy._changeSource('depthSource', depthReader.depth.data ? 
                  'data:' + depthReader.depth.mime + ';base64,' + depthReader.depth.data : 
                  URL.createObjectURL( new Blob([buffer], {type: 'image/jpeg'}))
                );
                viewer.depthFromAlpha = false;
                deferred.resolve(!!depthReader.depth.data);
              };
              depthReader.parseFile(buffer, result, result);
            } else {
            }
          };
          reader.readAsArrayBuffer(file);
        } else if (file.type === 'image/png') {
          depthy._changeSource('depthSource', URL.createObjectURL( file ));
          viewer.depthFromAlpha = false;
          deferred.resolve();
        } else {
          deferred.reject('Only JPEG and PNG files are supported!');
        }
        deferred.promise.then(function() {
          depthy.markImageAsNew();
        });
        return deferred.promise;

      },

      exportAnimation: function() {
        var deferred = $q.defer(), result = deferred.promise, gif;
        Modernizr.load({
          test: window.GIF,
          nope: 'bower_components/gif.js/dist/gif.js',
          complete: function() {
            var size = {width: depthy.exportSize, height: depthy.exportSize},
                duration = viewer.animDuration,
                fps = Math.min(25, Math.max(8, (viewer.depthScale * (size < 300 ? 0.5 : 1) * 15) / duration)),
                frames = Math.max(4, Math.round(duration * fps)),
                delay = Math.round(duration * 1000 / frames),
                canvas = $document.find('[pixi]'),
                pixi = canvas.controller('pixi');

            depthy.viewer.overrideStageSize = size;
            $rootScope.$safeApply();

            gif = new GIF({
              workers: 2,
              quality: 10,
              workerScript: 'bower_components/gif.js/dist/gif.worker.js',
              // width: size.width,
              // height: size.height,
            });
            console.log('FPS %d Frames %d Delay %d Scale %d Size %d Duration %d', fps, frames, delay, viewer.depthScale, depthy.exportSize, duration);

            for(var frame = 0; frame < frames; ++frame) {
              viewer.animPosition = frame / frames;
              viewer.update = 1;
              pixi.render(true);
              gif.addFrame(canvas[0], {copy: true, delay: delay});
            }
            viewer.animPosition = null;

            gif.on('progress', function(p) {
              deferred.notify(p);
            });
            gif.on('abort', function() {
              result.abort = function() {};
              deferred.reject();
            });
            gif.on('finished', function(blob) {
              result.abort = function() {};
              deferred.resolve(blob);
              depthy.viewer.overrideStageSize = null;
              $rootScope.$safeApply();
            });

            gif.render();
          }
        });
        result.abort = function() {
          gif.abort();
        };
        return result;
      },

      leftpaneToggle: function() {
        depthy.leftpaneOpened = depthy.leftpaneOpened !== true;
      },

      leftpaneOpen: function(samples) {
        depthy.leftpaneOpened = samples ? 'samples' : true;
      },

      leftpaneClose: function() {
        depthy.leftpaneOpened = false;
      },


    };

    return depthy;
  };
});


