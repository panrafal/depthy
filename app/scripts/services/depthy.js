'use strict';

angular.module('depthyApp').provider('depthy', function depthy() {

  // global settings object, synchronized with the remote profile, only simple values!
  var viewer = angular.extend({}, DepthyViewer.defaultOptions);

  this.$get = function(ga, $timeout, $rootScope, $document, $window, $q, $modal, $state) {
    viewer.onError = function() {
      $rootScope.$safeApply();
    };

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
      loadError: false,

      useOriginalImage: false,

      // used internally
      setOpened: function(opts) {
        if (opts) {
          this.getViewer().reset();
          this.getViewer().getPromise().then(function() {
            $rootScope.$safeApply();
          });
        }
        this.opened = angular.extend({
          imageUrl: null,
          depthUrl: null,
          originalUrl: null,

          // True if waiting for results
          processing: false,
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
      isProcessing: function() {
        return !this.isReady() && !this.getLoadError();
      },
      hasImage: function() {
        return this.getViewer().hasImage();
      },
      hasDepthmap: function() {
        return this.getViewer().hasDepthmap();
      },
      hasOriginalImage: function() {
        return this.opened.originalUrl;
      },
      hasCompleteImage: function() {
        return this.hasImage() && this.hasDepthmap();
      },
      getLoadError: function() {
        return this.loadError || this.getViewer().getLoadError();
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
        depthy.refreshOpenedImage();
        depthy.getViewer().setDepthmap(depthy.opened.depthUrl);
      },

      loadLocalImage: function(file) {
        var reader = new FileReader(),
            deferred = $q.defer();

        this.setOpened({
          local: true,
          parsed: true,
          processing: true,
          title: (file.name || '').replace(/\.(jpe?g|png)$/i, ''),
        });

        if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
          viewer.sourcesReady = true;
          deferred.reject('Only JPEG and PNG files are supported!');
        } else {
          reader.onload = function() {
            depthy._loadFromArrayBuffer(reader.result, deferred);
          };
          reader.readAsArrayBuffer(file);
        }

        return deferred.promise;
      },

      loadUrlImage: function(url, openedInfo) {
        if (depthy.opened.url === url) return;

        this.setOpened(angular.extend({
          url: url,
          parsed: true,
          processing: true,
        }, openedInfo || {}));

        var xhr = new XMLHttpRequest(),
            deferred = $q.defer();
        //todo: cors
        xhr.open( 'get', url );
        xhr.responseType = 'arraybuffer';
        xhr.onload = function() {
          depthy._loadFromArrayBuffer(this.response, deferred);
        };
        xhr.send( null );
        return deferred.promise;
      },


      loadUrlDirectImage: function(url, isPng, openedInfo) {
        if (depthy.opened.url === url) return;

        this.setOpened(angular.extend({
          url: url,
          imageUrl: url,
          depthUrl: isPng ? url : false,
        }, openedInfo || {}));

        this.refreshOpenedImage();
        this.getViewer().setDepthmap(this.opened.depthUrl, isPng);
      },

      _loadFromArrayBuffer: function(buffer, deferred) {
        var byteArray = new Uint8Array(buffer);
        if (isJpg(byteArray)) {
          var reader = new DepthReader();

          var result = function(error) {
            // no matter what, we use it...
            console.log('DepthExtractor result', error);
            depthy.opened.imageUrl = URL.createObjectURL( new Blob([buffer], {type: 'image/jpeg'}) );
            depthy.opened.depthUrl = reader.depth.data ? 'data:' + reader.depth.mime + ';base64,' + reader.depth.data : false;
            depthy.opened.originalUrl = reader.image.data ? 'data:' + reader.image.mime + ';base64,' + reader.image.data : false;
            depthy.opened.processing = false;
            depthy.refreshOpenedImage();
            depthy.getViewer().setDepthmap(depthy.opened.depthUrl);
            deferred.resolve(!!reader.depth.data);
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

          depthy.opened.imageUrl = imageSource;
          depthy.opened.depthUrl = isTransparent ? imageSource : false;
          depthy.opened.originalUrl = false;
          depthy.refreshOpenedImage();
          depthy.getViewer().setDepthmap(depthy.opened.depthUrl, isTransparent);
          deferred.resolve(isTransparent);

        } else {
          deferred.reject('JPG required!');
        }
        deferred.promise.finally(function() {
          $rootScope.$safeApply();
        });
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
                depthy.getViewer().setDepthmap(depthReader.depth.data ?
                    'data:' + depthReader.depth.mime + ';base64,' + depthReader.depth.data :
                    URL.createObjectURL( new Blob([buffer], {type: 'image/jpeg'})));
                depthy.getViewer().getPromise().then(function() {
                  $rootScope.$safeApply();
                });
                deferred.resolve(!!depthReader.depth.data);
              };
              depthReader.parseFile(buffer, result, result);
            } else {
            }
          };
          reader.readAsArrayBuffer(file);
        } else if (file.type === 'image/png') {
          depthy.getViewer().setDepthmap(URL.createObjectURL( file ));
          depthy.getViewer().getPromise().then(function() {
            $rootScope.$safeApply();
          });
          deferred.resolve();
        } else {
          deferred.reject('Only JPEG and PNG files are supported!');
        }
        deferred.promise.then(function() {
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


