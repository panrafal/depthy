'use strict';

angular.module('depthyApp')
.controller('MainCtrl', function ($rootScope, $window, $scope, $timeout, ga, depthy, $element, $modal, $state, StateModal) {

  $rootScope.depthy = depthy;
  $rootScope.viewer = depthy.viewer; // shortcut
  $rootScope.Modernizr = window.Modernizr;

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

  $scope.animateOption = function(obj, option, duration) {
    $(obj).animate(option, {
      duration: duration || 250,
      step: function() {$scope.$safeApply();},
      complete: function() {
        _.extend(obj, option);
        $scope.$safeApply();
      }
    });
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

  $scope.exportGifOptions = function() {
    var oldAnimate = depthy.viewer.animate;
    depthy.viewer.animate = true;
    
    depthy.openPopup('export.gif.options').promise.finally(function() {
      depthy.viewer.animate = oldAnimate;
    });

  };

  $scope.exportGifRun = function() {
    depthy.exportActive = true;
    StateModal.showModal('export.gif.run', {
      stateOptions: {location: 'replace'},
      templateUrl: 'views/export-modal.html',
      controller: 'ExportModalCtrl',
      // backdrop: 'static',
      keyboard: false,
      windowClass: 'export-modal',
    }).result.finally(function() {
      depthy.exportActive = false;
    });
  };

  $scope.exportPngRun = function() {
    StateModal.showModal('export.png', {
      stateOptions: {location: 'replace'},
      templateUrl: 'views/export-png-modal.html',
      controller: 'ExportPngModalCtrl',
      windowClass: 'export-png-modal',
    }).result.finally(function() {
    });
  };

  $scope.sharePngRun = function() {
    StateModal.showModal('share.png', {
      stateOptions: {location: 'replace'},
      templateUrl: 'views/share-png-modal.html',
      controller: 'SharePngModalCtrl',
      // backdrop: 'static',
      // keyboard: false,
      windowClass: 'share-png-modal',
    }).result.finally(function() {
    });
  };

  $scope.$watch('(depthy.activePopup.state === "export.gif.options" || depthy.exportActive) && depthy.exportSize', function(size) {
    if (size) {
      depthy.isViewerOverriden(true);
      depthy.viewer.size = {width: size, height: size};
      $scope.oldFit = depthy.viewer.fit;
      depthy.viewer.fit = false;
    } else {
      if ($scope.oldFit) depthy.viewer.fit = $scope.oldFit;
      $($window).resize();
      depthy.isViewerOverriden(false);
    }
  });


  $scope.$on('pixi.webgl.init.exception', function(evt, exception) {
    console.error('WebGL Init Exception', exception);
    Modernizr.webgl = false;
    ga('send', 'event', 'webgl', 'exception', exception.toString(), {nonInteraction: 1});
  });

  $($window).on('resize', function() {
    depthy.viewer.size = {
      width: $window.innerWidth,
      height: $window.innerHeight,
    };
    $scope.$safeApply();
  });
  $($window).resize();

  $($window).on('online offline', function() {
    $scope.$safeApply();
  });

});