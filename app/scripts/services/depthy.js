'use strict';

angular.module('depthyApp').provider('depthy', function depthy() {

  // global settings object, synchronized with the remote profile, only simple values!
  var viewer = {
      compoundSource: false,
      imageSource: false,
      depthSource: false,
      sourcesReady: false,
      sourcesDirty: 1,
    };



  this.$get = function(ga, $timeout, $rootScope, $document, $q) {
    var depthy = {
      viewer: viewer,

      animatePopuped: false,
      exportPopuped: false,

      exportSize: 150,
      exportType: 'gif',

      loadSample: function(name) {
        viewer.compoundSource = 'samples/'+name+'-compound.jpg';
        viewer.depthSource = 'samples/'+name+'-depth.jpg';
        viewer.imageSource = 'samples/'+name+'-image.jpg';
        viewer.sourcesReady = true;
        viewer.sourcesDirty++;
        viewer.metadata = {};
        viewer.error = false;
      },

      handleCompoundFile: function(file) {

        var onError = function(e) {
          viewer.imageSource = false;
          viewer.depthSource = false;
          viewer.compoundSource = false;
          viewer.sourcesReady = true;
          viewer.sourcesDirty++;
          viewer.metadata = {};
          viewer.error = e;
          ga('send', 'event', 'image', 'error', e);
        };

        if (file.type !== 'image/jpeg') {
          onError('Only JPEGs are supported!');
          return;
        }

        viewer.sourcesReady = false;
        viewer.error = false;
        viewer.sourcesDirty++;

        $timeout(function() {
          var imageReader = new FileReader(),
              loaded = 0;
          imageReader.onload = function(e) {
            viewer.error = false;

            try {
              var image = depthy.parseCompoundImage(e.target.result);

              ga('send', 'event', 'image', 'parsed');

              viewer.imageSource = image.imageUri;
              viewer.depthSource = image.depthUri;

              delete image.imageData;
              delete image.depthData;
              delete image.imageUri;
              delete image.depthUri;

              viewer.metadata = image;
              viewer.sourcesReady = ++loaded > 1;
              viewer.sourcesDirty++;
            } catch (e) {
              onError(e);
            }

            $rootScope.$apply();
          };

          imageReader.readAsBinaryString(file);

          var dataReader = new FileReader();
          dataReader.onload = function(e) {
            viewer.compoundSource = e.target.result;
            viewer.sourcesReady =  ++loaded > 1;
            viewer.sourcesDirty++;

            $rootScope.$apply();
          };
          dataReader.readAsDataURL(file);
        }, 100);
      },

      parseCompoundImage: function(data) {
        // this IS a really quick and HACKY way of extracting this info, 
        // please go to https://github.com/spite/android-lens-blur-depth-extractor 
        // for proper implementation! I'll be using it soon too ;)
        var extendedXmp = (data.match(/xmpNote:HasExtendedXMP="(.+?)"/i) || [])[1];
        if (extendedXmp) {
          // we need to clear out JPEG's block headers. Let's be juvenile and don't care about checking this for now, shall we?
          // 2b + 2b + http://ns.adobe.com/xmp/extension/ + 1b + extendedXmp + 4b + 4b
          data = data.replace(new RegExp('[\\s\\S]{4}http:\\/\\/ns\\.adobe\\.com\\/xmp\\/extension\\/[\\s\\S]' + extendedXmp + '[\\s\\S]{8}', 'g'), '');
        }

        var xmp = data.match(/<x:xmpmeta [\s\S]+?<\/x:xmpmeta>/g),
          result = {};
        if (!xmp) throw 'No XMP metadata found!';
        xmp = xmp.join('\n', xmp);


        result.imageMime = (xmp.match(/GImage:Mime="(.+?)"/i) || [])[1];
        result.imageData = (xmp.match(/GImage:Data="(.+?)"/i) || [])[1];
        result.depthMime = (xmp.match(/GDepth:Mime="(.+?)"/i) || [])[1];
        result.depthData = (xmp.match(/GDepth:Data="(.+?)"/i) || [])[1];

        if (result.imageMime && result.imageData) {
          result.imageUri = 'data:' + result.imageMime + ';base64,' + result.imageData;
        }
        if (result.depthMime && result.depthData) {
          result.depthUri = 'data:' + result.depthMime + ';base64,' + result.depthData;
        }

        if (!result.depthUri) throw 'No depth map found!';
        if (!result.imageUri) throw 'No original image found!';

        result.focalDistance = (xmp.match(/GFocus:FocalDistance="(.+?)"/i) || [])[1];

        return result;
      },


      exportAnimation: function() {
        var deferred = $q.defer();
        Modernizr.load({
          test: window.GIF,
          nope: 'bower_components/gif.js/dist/gif.js',
          complete: function() {
            var size = {width: depthy.exportSize, height: depthy.exportSize},
                fps = Math.round(viewer.animDuration >= 2 ? 30 : 30),
                frames = Math.round(viewer.animDuration * fps),
                delay = Math.round(1000 / fps),
                canvas = $document.find('[pixi]'),
                pixi = canvas.controller('pixi'),
                // gl = pixi.getContext(),
                gif;

            depthy.viewer.overrideStageSize = size;
            $rootScope.$safeApply();

            gif = new GIF({
              workers: 2,
              quality: 10,
              workerScript: 'bower_components/gif.js/dist/gif.worker.js',
              // width: size.width,
              // height: size.height,
            });
            console.log('FPS %d Frames %d Delay %d', fps, frames, delay);
            for(var frame = 0; frame < frames; ++frame) {
              viewer.animPosition = frame / frames;
              viewer.update = 1;
              pixi.render(true);
              console.log('Frame %d Position %f', frame, viewer.animPosition);

              gif.addFrame(canvas[0], {copy: true, delay: delay});
            }
            viewer.animPosition = null;

            gif.on('progress', function(p) {
              deferred.notify(p);
            });
            gif.on('abort', function() {
              deferred.reject();
            });
            gif.on('finished', function(blob) {
              deferred.resolve(blob);
              depthy.viewer.overrideStageSize = null;
              $rootScope.$safeApply();
            });

            gif.render();
          }
        });
        return deferred.promise;
      },

    };

    return depthy;
  };
});


