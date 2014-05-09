'use strict';

angular.module('depthyApp').provider('depthy', function depthy() {

  // global settings object, synchronized with the remote profile, only simple values!
  var viewer = angular.extend({}, DepthyViewer.defaultOptions);

  this.$get = function(ga, $timeout, $rootScope, $document, $window, $q, $modal, $state) {
    viewer.hoverElement = 'body';

    function onViewerResolved(e) {
      $rootScope.$safeApply();
      console.log('onViewerResolved: ' + depthy.isLoading(), depthy.getViewer().isReady(), e);
    }
    function onViewerRejected(e) {
      $rootScope.$safeApply();
      console.log('onViewerRejected: ' + depthy.isLoading(), depthy.getViewer().isReady(), e);
    }

    function onFinallyOpened() {
      depthy.opened.loading = false;
      console.log('onFinallyOpened');
    }

    var depthy = {
      viewer: viewer,

      exportPopuped: false,

      exportSize: Modernizr.mobile ? 150 : 300,
      exportType: 'gif',

      imgurId: 'b4ca5b16efb904b',

      // true - opened fully, 'samples' opened on samples
      leftpaneOpened: false,

      movearoundShow: false,

      zenMode: false,

      opened: {},

      useOriginalImage: false,

      // used internally
      setOpened: function(opts) {
        if (opts) {
          this.getViewer().reset();
        }
        this.opened = angular.extend({
          imageUrl: null,
          depthUrl: null,
          originalUrl: null,

          // True if waiting for results
          loading: true,
          // loaded from this url
          url: null,
          // TRUE if local file
          local: false,
           // image was parsed
          parsed: false,
          // id of local sample
          sample: false,
          // 
          title: false,
          // url used for sharing
          shareUrl: false,
          // thumbnail url
          thumb: false,
          // storage service used
          store: false,
          // stored under this url
          storeUrl: false,

          isEmpty: function() {
            return !(this.url || this.local || this.sample || this.procesing);
          },
          markModified: function() {
            this.shareUrl = this.store = this.storeUrl = false;
            this.modified = true;
          }
        }, opts || {});
        return this.opened;
      },

      stores: {
        imgur: {
          name: 'imgur'
        }
      },

      isReady: function() {
        return this.getViewer().isReady();
      },
      isLoading: function() {
        return !!this.opened.loading;
      },
      hasImage: function() {
        return this.getViewer().hasImage();
      },
      hasDepthmap: function() {
        return this.getViewer().hasDepthmap();
      },
      hasOriginalImage: function() {
        return !!this.opened.originalUrl;
      },
      hasCompleteImage: function() {
        return this.hasImage() && this.hasDepthmap();
      },
      getLoadError: function() {
        return this.opened.error || this.getViewer().getLoadError();
      },

      getViewerCtrl: function() {
        if (!this._viewerCtrl) {
          this._viewerCtrl = angular.element('[depthy-viewer]').controller('depthyViewer');
        }
        return this._viewerCtrl;
      },

      getViewer: function() {
        if (!this._viewer) {
          this._viewer = this.getViewerCtrl().getViewer();
        }
        return this._viewer;
      },

      // sets proper image according to opened image and useOriginalImage setting
      refreshOpenedImage: function() {
        var opened = this.opened;
        this.getViewer().setImage((depthy.useOriginalImage ? opened.originalUrl : opened.imageUrl) || opened.imageUrl);
        return $q.when(depthy.getViewer().getPromise());
      },

      loadSampleImage: function(name) {
        if (depthy.opened.sample === name && !depthy.opened.modified) return;
        this.setOpened({
          sample: name,
          title: name,
          shareUrl: $state.href('sample', {id: name}, {absolute: true}),
          thumb: 'samples/'+name+'-thumb.jpg',
          imageUrl: 'samples/'+name+'-image.jpg',
          depthUrl: 'samples/'+name+'-depth.jpg',
          originalUrl: 'samples/'+name+'-alternative.jpg',
        });
        depthy.getViewer().setDepthmap(depthy.opened.depthUrl);
        return depthy.refreshOpenedImage().finally(onFinallyOpened);
      },

      loadLocalImage: function(file) {

        this.setOpened({
          local: true,
          parsed: true,
          title: (file.name || '').replace(/\.(jpe?g|png)$/i, ''),
        });

        var deferred = $q.defer();

        if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
          deferred.reject('Only JPEG and PNG files are supported!');
        } else {
          var reader = new FileReader();
          reader.onload = function() {
            deferred.resolve(reader.result);
          };
          reader.readAsArrayBuffer(file);
        }

        return deferred.promise.then(function(data) {
          return depthy._loadFromArrayBuffer(data);
        }).finally(onFinallyOpened);

      },

      loadUrlImage: function(url, openedInfo) {
        if (depthy.opened.url === url) return;

        this.setOpened(angular.extend({
          url: url,
          parsed: true,
        }, openedInfo || {}));

        var xhr = new XMLHttpRequest(),
            deferred = $q.defer();
        //todo: cors
        xhr.open( 'get', url );
        xhr.responseType = 'arraybuffer';
        xhr.onload = function() {
          deferred.resolve(this.response);
        };
        xhr.onerror = function() {
          deferred.reject();
        };
        xhr.send( null );

        return deferred.promise.then(function(data) {
          return depthy._loadFromArrayBuffer(data);
        }).finally(onFinallyOpened);

      },


      loadUrlDirectImage: function(url, isPng, openedInfo) {
        if (depthy.opened.url === url) return $q.resolve();

        this.setOpened(angular.extend({
          url: url,
          imageUrl: url,
          depthUrl: isPng ? url : false,
        }, openedInfo || {}));

        this.getViewer().setDepthmap(this.opened.depthUrl, isPng);
        return this.refreshOpenedImage().finally(onFinallyOpened);
      },

      _loadFromArrayBuffer: function(buffer) {
        var byteArray = new Uint8Array(buffer);
        if (isJpg(byteArray)) {
          var reader = new DepthReader(),
              deferred = $q.defer();

          var result = function(error) {
            // no matter what, we use it...
            console.log('DepthExtractor result', error);
            depthy.opened.imageUrl = URL.createObjectURL( new Blob([buffer], {type: 'image/jpeg'}) );
            depthy.opened.depthUrl = reader.depth.data ? 'data:' + reader.depth.mime + ';base64,' + reader.depth.data : false;
            depthy.opened.originalUrl = reader.image.data ? 'data:' + reader.image.mime + ';base64,' + reader.image.data : false;
            depthy.getViewer().setDepthmap(depthy.opened.depthUrl);
            deferred.resolve(depthy.refreshOpenedImage());
          };

          reader.parseFile(buffer, result, result);
          return deferred.promise;
        } else if (isPng(byteArray)) {
          // 8b signature, 4b chunk length, 4b chunk type
          // IHDR: 4b width, 4b height, 1b bit depth, 1b color type
          var bitDepth = byteArray[24],
              colorType = byteArray[25],
              isTransparent = colorType === 4 || colorType === 6,
              imageSource = URL.createObjectURL( new Blob([buffer], {type: 'image/jpeg'}) );
          console.log('PNG depth %d colorType %d transparent %s', bitDepth, colorType, isTransparent);

          depthy.opened.imageUrl = imageSource;
          depthy.opened.depthUrl = isTransparent ? imageSource : false;
          depthy.opened.originalUrl = false;

          depthy.getViewer().setDepthmap(depthy.opened.depthUrl, isTransparent);
          return depthy.refreshOpenedImage();

        } else {
          $q.reject('JPG required!');
        }
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
              depthy.opened.loading = true;
              var result = function() {
                depthy.getViewer().setDepthmap(depthReader.depth.data ?
                    'data:' + depthReader.depth.mime + ';base64,' + depthReader.depth.data :
                    URL.createObjectURL( new Blob([buffer], {type: 'image/jpeg'})));
                deferred.resolve(depthy.getViewer().getPromise());
                deferred.promise.finally(onFinallyOpened);
              };
              depthReader.parseFile(buffer, result, result);
            } else {
            }
          };
          reader.readAsArrayBuffer(file);
        } else if (file.type === 'image/png') {
          depthy.opened.loading = true;
          depthy.getViewer().setDepthmap(URL.createObjectURL( file ));
          deferred.resolve(depthy.getViewer().getPromise());
          deferred.promise.finally(onFinallyOpened);
        } else {
          deferred.reject('Only JPEG and PNG files are supported!');
        }
        deferred.promise.finally(function() {
          depthy.opened.markModified();
        });
        return deferred.promise;

      },

      exportAnimation: function() {
        var deferred = $q.defer(), promise = deferred.promise, gif;
        Modernizr.load({
          test: window.GIF,
          nope: 'bower_components/gif.js/dist/gif.js',
          complete: function() {
            var size = {width: depthy.exportSize, height: depthy.exportSize},
                duration = viewer.animateDuration,
                fps = Math.min(25, Math.max(8, (viewer.depthScale * (size < 300 ? 0.5 : 1) * 15) / duration)),
                frames = Math.max(4, Math.round(duration * fps)),
                delay = Math.round(duration * 1000 / frames),
                viewerObj = depthy.getViewer(),
                oldOptions = viewerObj.getOptions();

            gif = new GIF({
              workers: 2,
              quality: 10,
              workerScript: 'bower_components/gif.js/dist/gif.worker.js',
            });
            console.log('FPS %d Frames %d Delay %d Scale %d Size %d Duration %d', fps, frames, delay, viewer.depthScale, depthy.exportSize, duration);

            for(var frame = 0; frame < frames; ++frame) {
              viewerObj.setOptions({
                size: size,
                animate: true,
                fit: false,
                animatePosition: frame / frames,
              });
              viewerObj.render(true);
              gif.addFrame(viewerObj.getCanvas(), {copy: true, delay: delay});
            }

            gif.on('progress', function(p) {
              deferred.notify(p);
            });
            gif.on('abort', function() {
              promise.abort = function() {};
              deferred.reject();
            });
            gif.on('finished', function(blob) {
              promise.abort = function() {};
              deferred.resolve(blob);
              depthy.viewer.overrideStageSize = null;
              $rootScope.$safeApply();
            });

            promise.finally(function() {
              viewerObj.setOptions(oldOptions);
            });

            gif.render();
          }
        });
        promise.abort = function() {
          gif.abort();
        };
        return promise;
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
    depthy.setOpened();

    return depthy;
  };
});


