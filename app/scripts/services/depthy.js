'use strict';

angular.module('depthyApp').provider('depthy', function depthy() {

  // global settings object, synchronized with the remote profile, only simple values!
  var viewer = angular.extend({}, DepthyViewer.defaultOptions, {
    hoverElement: 'body',
    fit: Modernizr.mobile ? 'cover' : 'contain',
  });

  this.$get = function(ga, $timeout, $rootScope, $document, $window, $q, $modal, $state, StateModal) {

    var leftpaneDeferred, depthy,
      history = [];

    function createImageInfo(info) {

      var self = angular.extend({
        imageUrl: null,
        depthUrl: null,
        originalUrl: null,

        // state it was opened from
        state: null,
        stateParams: null,

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
        // thumbnail url
        thumb: false,
        // storage service used
        store: false,
        // stored under this url
        storeUrl: false,
        // store secret key, if any
        storeKey: false,

        // in history
        peristed: false,
        // time when first added to history
        added: false,
        // time last viewed
        viewed: false,
        // views count
        views: 0,
        sharedAs: null,

        // true if it's shareable directly
        isShareable: function() {
          return self.sample || self.url && !self.local;
        },
        isStoreable: function() {
          return self.isShareable();
        },
        isEmpty: function() {
          return !(self.url || self.local || self.sample || self.procesing);
        },
        isOpened: function() {
          return depthy.opened === self;
        },
        getStateUrl: function() {
          if (!self.state) return false;
          return $state.href(self.state, self.stateParams || {});
        },
        // returns shareUrl
        getShareUrl: function(followShares) {
          if (self.sharedAs && followShares) return self.sharedAs.getShareUrl(false);
          if (!self.isShareable()) return false;
          return self.getStateUrl();
        },
        getShareInfo: function(followShares) {
          if (self.sharedAs && followShares) return self.sharedAs.getShareInfo(false);
          var url = self.getShareUrl(false);
          if (!url) return null;
          return {
            url: url,
            title: (self.title ? self.title + ' ' : '') + '#depthy',
            img: self.thumb,
          };
        },
        // creates new image, based on this one, and sets it as sharedAs
        createShareImage: function(info) {
          info = angular.extend({
            sharedFrom: self,
            title: self.title,
            thumb: self.thumb,
          }, info);
          var share = populateImageHistory(info, true);
          return share;
        },
        markModified: function() {
          // self.shareUrl = self.store = self.storeUrl = false;
          // it's no longer shared here!
          self.sharedAs = null;
          self.modified = true;
        },
        onOpened: function() {
          self.loading = false;
          self._checkIfReady();
        },
        // fire when depthmap is opened later on
        onDepthmapOpened: function() {
          self.loading = false;
          self._checkIfReady();
        },
        _checkIfReady: function() {
          if (!self.state) return false;
          if (!self.isOpened() || !depthy.isReady() || !depthy.hasDepthmap()) return false;
          this.onViewed();
        },
        onViewed: function() {
          self.viewed = new Date().getTime();
          self.views += 1;
          self.storeHistory(true);
        },
        storeHistory: function(update) {
          if (!self.peristed) {
            self.peristed = true;
            self.added = new Date().getTime();
            history.push(self);
            if (update) updateImageGallery();
          }
          if (update) storeImageHistory();
        },
        onClosed: function() {
          // cleanup a bit
          self.imageUrl = self.depthUrl = self.originalUrl = self.loading = false;
        }
      }, info || {});
      return self;
    }

    function lookupImageHistory(info, create) {
      var image;
      if (info && info.state) {
        if (info.state === true) {
          info.state = $state.current.name;
          info.stateParams = $state.params;
          console.log('lookupImageHistory state detected as ', info.state, info.stateParams);
        }
        image = _.find(history, {state: info.state, stateParams: info.stateParams});
        console.log('%cFound %o in history when looking for %o', 'font-weight:bold', image, info);
      }
      return (image && angular.extend(image, info)) || (create && createImageInfo(info));
    }

    function populateImageHistory(info, update) {
      var image = lookupImageHistory(info, true);
      image.storeHistory(update);
      return image;
    }

    // used internally
    function openImage(info, stateInfo) {
      if (info) {
        depthy.getViewer().reset();
      } else {
        info = {};
      }
      if (stateInfo) info = angular.extend({}, info, stateInfo);

      if (depthy.opened) depthy.opened.onClosed();

      depthy.opened = lookupImageHistory(info, true);
      return depthy.opened;
    }

    function updateImageGallery() {
      console.log('updateImageGallery');
      var gallery = _.filter(history, function(image) {
        return true; //!!image.thumb;
      });
      gallery.sort(function(a, b) {
        if (a.added === b.added) return 0;
        return a.added > b.added ? -1 : 1;
      });
      depthy.gallery = gallery;
    }

    var storeImageHistory = _.throttle(function storeImageHistory() {
      var store = history.filter(function(image) {
        return image.isStoreable();
      }).map(function(image) {
        return _.pick(image, ['state', 'stateParams', 'title', 'thumb', 'added', 'viewed', 'views', 'storeKey']);
      });
      console.log('storeImageHistory', history, store);

    }, 500, {leading: false});

    function restoreImageHistory() {
      // recreate samples
      _.forEach(depthy.samples, function(title, name) {
        populateImageHistory({
          state: 'sample',
          stateParams: {id: name},
          sample: name,
          title: name,
          thumb: 'samples/'+name+'-thumb.jpg',
        });
      });
    }

    depthy = {
      viewer: viewer,

      exportSize: Modernizr.mobile ? 150 : 300,
      exportType: 'gif',

      imgurId: 'b4ca5b16efb904b',

      rootShareUrl: 'http://depthy.me/',
      share: {
        url: 'http://depthy.me/',
      },

      // true - opened fully, 'gallery' opened on gallery
      leftpaneOpened: false,

      movearoundShow: false,

      zenMode: false,

      opened: null,

      useOriginalImage: false,

      modalWait: 700,

      gallery: [],

      samples: {
        flowers: 'flowers',
        hut: 'hut',
        shelf: 'shelf',
        mango: 'mango',
        tunnel: 'tunnel',
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
        return !!this.opened.loading && Modernizr.webgl;
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
        return this.opened.error;
      },
      // true when leftpane is incollapsible
      isFullLayout: function() {
        return $window.innerWidth >= 1200;
      },
      isOffline: function() {
        return navigator.onLine === false;
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

      loadSampleImage: function(name, openedInfo) {
        if (depthy.opened.sample === name && !depthy.opened.modified) return;
        var opened = openImage({
          state: 'sample',
          stateParams: {id: name},
          sample: name,
          title: depthy.samples[name],
          thumb: 'samples/'+name+'-thumb.jpg',
          imageUrl: 'samples/'+name+'-image.jpg',
          depthUrl: 'samples/'+name+'-depth.jpg',
          originalUrl: 'samples/'+name+'-alternative.jpg',
        }, openedInfo);
        depthy.getViewer().setDepthmap(opened.depthUrl);
        return depthy.refreshOpenedImage()
          .catch(function() {
            opened.error = 'Sample not found!';
          })
          .finally(opened.onOpened);
      },

      loadLocalImage: function(file) {

        var opened = openImage({
          local: true,
          parsed: true,
          title: (file.name || '').replace(/\.(jpe?g|png)$/i, ''),
        });

        var deferred = $q.defer();

        if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
          deferred.reject('Only JPEG and PNG, please!');
        } else {
          var reader = new FileReader();
          reader.onload = function() {
            deferred.resolve(reader.result);
          };
          reader.readAsArrayBuffer(file);
        }

        return deferred.promise.then(function(data) {
          return depthy._loadFromArrayBuffer(data, opened);
        })
        .catch(function(err) {
          opened.error = err;
        })
        .finally(opened.onOpened);

      },

      loadUrlImage: function(url, openedInfo) {
        if (depthy.opened.url === url) return;

        var opened = openImage({
          url: url,
          parsed: true,
        }, openedInfo);

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
          return depthy._loadFromArrayBuffer(data, opened);
        })
        .catch(function(err) {
          opened.error = angular.isString(err) ? err : 'Image not found!';
        })
        .finally(opened.onOpened);

      },


      loadUrlDirectImage: function(url, isPng, openedInfo) {
        if (depthy.opened.url === url) return $q.resolve();

        var opened = openImage({
          url: url,
          imageUrl: url,
          depthUrl: isPng ? url : false,
        }, openedInfo);

        this.getViewer().setDepthmap(opened.depthUrl, isPng);
        return depthy.refreshOpenedImage()
          .catch(function(err) {
            opened.error = angular.isString(err) ? err : 'Image not found!';
          })
          .finally(opened.onOpened);
      },

      _loadFromArrayBuffer: function(buffer, opened) {
        var byteArray = new Uint8Array(buffer);
        if (isJpg(byteArray)) {
          var reader = new DepthReader(),
              deferred = $q.defer();

          var result = function(error) {
            // no matter what, we use it...
            console.log('DepthExtractor result', error);
            opened.imageUrl = URL.createObjectURL( new Blob([buffer], {type: 'image/jpeg'}) );
            opened.depthUrl = reader.depth.data ? 'data:' + reader.depth.mime + ';base64,' + reader.depth.data : false;
            opened.originalUrl = reader.image.data ? 'data:' + reader.image.mime + ';base64,' + reader.image.data : false;
            depthy.getViewer().setDepthmap(opened.depthUrl);
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

          opened.imageUrl = imageSource;
          opened.depthUrl = isTransparent ? imageSource : false;
          opened.originalUrl = false;

          depthy.getViewer().setDepthmap(opened.depthUrl, isTransparent);
          return depthy.refreshOpenedImage();

        } else {
          $q.reject('JPG required!');
        }
      },

      loadLocalDepthmap: function(file) {
        var reader = new FileReader(),
            deferred = $q.defer(),
            opened = depthy.opened;

        if (file.type === 'image/jpeg') {
          // look for depthmap
          reader.onload = function() {
            var buffer = reader.result,
                byteArray = new Uint8Array(buffer);
            if (isJpg(byteArray)) {
              var depthReader = new DepthReader();
              opened.loading = true;
              var result = function() {
                depthy.getViewer().setDepthmap(depthReader.depth.data ?
                    'data:' + depthReader.depth.mime + ';base64,' + depthReader.depth.data :
                    URL.createObjectURL( new Blob([buffer], {type: 'image/jpeg'})));
                deferred.resolve(depthy.getViewer().getPromise());
                deferred.promise.finally(opened.onDepthmapOpened);
              };
              depthReader.parseFile(buffer, result, result);
            } else {
            }
          };
          reader.readAsArrayBuffer(file);
        } else if (file.type === 'image/png') {
          opened.loading = true;
          depthy.getViewer().setDepthmap(URL.createObjectURL( file ));
          deferred.resolve(depthy.getViewer().getPromise());
          deferred.promise.finally(opened.onDepthmapOpened);
        } else {
          deferred.reject('Only JPEG and PNG files are supported!');
        }
        deferred.promise.finally(function() {
          opened.markModified();
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

      isLeftpaneOpened: function() {
        return this.leftpaneOpened || this.isFullLayout();
      },

      leftpaneToggle: function() {
        if (depthy.leftpaneOpened) {
          depthy.leftpaneClose();
        } else {
          depthy.leftpaneOpen();
        }
      },

      leftpaneOpen: function(gallery) {
        gallery = false;
        depthy.zenMode = false;
        if (this.isFullLayout()) return;
        
        if (!gallery && depthy.leftpaneOpen !== true && !leftpaneDeferred) {
          leftpaneDeferred = StateModal.stateDeferred('pane');
          leftpaneDeferred.promise.finally(function() {
            if (depthy.leftpaneOpened === true) depthy.leftpaneOpened = false;
            leftpaneDeferred = null;
          });
        }
        depthy.leftpaneOpened = gallery ? 'gallery' : true;
      },

      leftpaneClose: function() {
        if (this.isFullLayout()) return;
        if (leftpaneDeferred) {
          if (depthy.leftpaneOpened === true) {
            leftpaneDeferred.reject();
          }
          leftpaneDeferred = null;
        }
        depthy.leftpaneOpened = false;
      },

      zenModeToggle: function() {
        if (depthy.leftpaneOpened !== 'gallery') depthy.leftpaneClose();
        depthy.zenMode = !depthy.zenMode;
      },

    };

    openImage();
    restoreImageHistory();
    updateImageGallery();

    $rootScope.$on('$stateChangeSuccess', function() {
      depthy.zenMode = false;
    });

    return depthy;
  };
});


