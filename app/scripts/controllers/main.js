'use strict';

angular.module('depthyApp')
.controller('MainCtrl', function ($rootScope, $window, $scope, $timeout, ga, depthy, $element, $modal, $state, StateModal) {

  $rootScope.depthy = depthy;
  $rootScope.viewer = depthy.viewer; // shortcut
  $rootScope.Modernizr = window.Modernizr;
  $rootScope.Math = window.Math;
  $rootScope.screenfull = screenfull;

  $scope.version = depthy.getVersion();

  ga('set', 'dimension1', (Modernizr.webgl ? 'webgl' : 'no-webgl') + ' ' + (Modernizr.webp ? 'webp' : 'no-webp'));

  $rootScope.$safeApply = function(fn) {
    var phase = this.$root.$$phase;
    if(phase === '$apply' || phase === '$digest') {
      if(fn && (typeof(fn) === 'function')) {
        fn();
      }
    } else {
      this.$apply(fn);
    }
  };

  $scope.loadSample = function(name) {
    $state.go('sample', {id: name});
    // depthy.leftpaneOpen(true);
  };

  $scope.openImage = function(image) {
    $state.go(image.state, image.stateParams);
    // depthy.leftpaneOpen(true);
  };



  $scope.$watch('compoundFiles', function(files) {
    if (files && files.length) {
      depthy.loadLocalImage(files[0]).then(
        function() {
          ga('send', 'event', 'image', 'parsed', depthy.hasDepthmap() ? 'depthmap' : 'no-depthmap');
          depthy.leftpaneClose();
          depthy.opened.openState();
        },
        function(e) {
          ga('send', 'event', 'image', 'error', e);
          depthy.leftpaneClose();
        }
      );
      // depthy.handleCompoundFile(files[0]);
    }
  });


  $scope.$watch('depthy.useOriginalImage', function() {
    depthy.refreshOpenedImage();
  });


  $scope.imageOptions = function() {
    depthy.openPopup('image.options');
  };

  $scope.shareOptions = function() {
    depthy.openPopup('share.options');
  };

  $scope.imageInfo = function() {
    StateModal.showModal('image.info', {
      templateUrl: 'views/image-info-modal.html',
      windowClass: 'info-modal',
      controller: 'ImageInfoModalCtrl',
    });
  };

  $scope.exportAnimationOptions = function(type) {
    var oldAnimate = depthy.viewer.animate;
    depthy.viewer.animate = true;
    
    if (type === 'gif') {
      depthy.exportSize = Math.min(500, depthy.exportSize);
    }
    
    depthy.openPopup('export.' + type + '.options').promise.finally(function() {
      depthy.viewer.animate = oldAnimate;
    });

  };

  $scope.exportAnimationRun = function(type) {
    depthy.exportActive = true;
    StateModal.showModal('export.' + type + '.run', {
      // stateOptions: {location: 'replace'},
      templateUrl: 'views/export-' + type + '-modal.html',
      controller: 'Export' + type.substr(0,1).toUpperCase() + type.substr(1) + 'ModalCtrl',
      // backdrop: 'static',
      windowClass: 'export-' + type + '-modal',
    }).result.finally(function() {
      depthy.exportActive = false;
    });
  };

  $scope.exportPngRun = function() {
    StateModal.showModal('export.png', {
      // stateOptions: {location: 'replace'},
      templateUrl: 'views/export-png-modal.html',
      controller: 'ExportPngModalCtrl',
      windowClass: 'export-png-modal',
    }).result.finally(function() {
    });
  };

  $scope.exportJpgRun = function() {
    StateModal.showModal('export.jpg', {
      // stateOptions: {location: 'replace'},
      templateUrl: 'views/export-jpg-modal.html',
      controller: 'ExportJpgModalCtrl',
      windowClass: 'export-jpg-modal',
    }).result.finally(function() {
    });
  };

  $scope.exportAnaglyphRun = function() {
    StateModal.showModal('export.anaglyph', {
      // stateOptions: {location: 'replace'},
      templateUrl: 'views/export-anaglyph-modal.html',
      controller: 'ExportAnaglyphModalCtrl',
      windowClass: 'export-anaglyph-modal modal-lg',
    }).result.finally(function() {
    });
  };

  $scope.sharePngRun = function() {
    StateModal.showModal('share.png', {
      // stateOptions: {location: 'replace'},
      templateUrl: 'views/share-png-modal.html',
      controller: 'SharePngModalCtrl',
      // backdrop: 'static',
      // keyboard: false,
      windowClass: 'share-png-modal',
    }).result.finally(function() {
    });
  };

  $scope.drawDepthmap = function() {
    $state.go('draw');
  };

  $scope.debugClicksLeft = 2;
  $scope.debugClicked = function() {
    if (--$scope.debugClicksLeft === 0) depthy.enableDebug();
  };

  $scope.$watch('(depthy.activePopup.state === "export.gif.options" || depthy.activePopup.state === "export.webm.options" || depthy.exportActive) && depthy.exportSize', function(size) {
    if (size) {
      depthy.isViewerOverriden(true);
      depthy.viewer.size = {width: size, height: size};
      if (depthy.viewer.fit) $scope.oldFit = depthy.viewer.fit;
      depthy.viewer.fit = false;
      console.log('Store fit ' + $scope.oldFit)
    } else {
      if ($scope.oldFit) {
        depthy.viewer.fit = $scope.oldFit;
        console.log('Restore fit ' + $scope.oldFit)
      }
      $($window).resize();
      depthy.isViewerOverriden(false);
    }
  });

  $scope.$watch('viewer.fit', function(fit) {
    if (fit === 'cover') {
      depthy.viewer.upscale = 4;
    } else if (fit === 'contain') {
      depthy.viewer.upscale = 1;
    }
  });


  $scope.$on('pixi.webgl.init.exception', function(evt, exception) {
    console.error('WebGL Init Exception', exception);
    Modernizr.webgl = false;
    ga('send', 'event', 'webgl', 'exception', exception.toString(), {nonInteraction: 1});
  });

  $($window).on('resize', function() {
    var $viewer = $('#viewer');
    depthy.viewer.size = {
      width:  $viewer.width(),
      height: $viewer.height(),
    };
    console.log('Resize %dx%d', $viewer.width(), $viewer.height());
    $scope.$safeApply();
  });
  $($window).resize();

  $($window).on('online offline', function() {
    $scope.$safeApply();
  });

  $timeout(function() {
    $scope.scroll = new IScroll('#leftpane', {
      mouseWheel: true,
      scrollbars: 'custom',
      click: false,
      fadeScrollbars: true,
      interactiveScrollbars: true,
      resizeScrollbars: false,
      eventPassthrough: 'horizontal',
    });
    // refresh on every digest...
    $scope.$watch(function() {
      setTimeout(function() {
        $scope.scroll.refresh();
      }, 100);
    });
  });




});