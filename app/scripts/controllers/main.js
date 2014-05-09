'use strict';

angular.module('depthyApp')
.controller('MainCtrl', function ($rootScope, $window, $scope, $timeout, ga, depthy, $element, $modal, $state, StateModal) {

  $rootScope.depthy = depthy;
  $rootScope.viewer = depthy.viewer; // shortcut
  $rootScope.Modernizr = window.Modernizr;

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
    depthy.leftpaneOpen(true);
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
      $state.go('file');
      depthy.loadLocalImage(files[0]).then(
        function(withDepthmap) {
          ga('send', 'event', 'image', 'parsed', withDepthmap ? 'depthmap' : 'no-depthmap');
          depthy.leftpaneClose();
        },
        function(e) {
          ga('send', 'event', 'image', 'error', e);
          StateModal.showAlert(e);
        }
      );
      // depthy.handleCompoundFile(files[0]);
    }
  });



  $scope.zenModeToggle = function() {
    depthy.zenMode = !depthy.zenMode;
  };

  $scope.imageOptions = function() {
    StateModal.showModal('image.options', {
      templateUrl: 'views/options-popup.html',
      windowClass: 'options-popup',
      scope: $scope
    });
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
    depthy.exportPopuped = true;
    StateModal.showModal('export.gif.options', {
      templateUrl: 'views/export-popup.html',
      scope: $scope
    }).result.finally(function() {
      depthy.exportPopuped = false;
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
      templateUrl: 'views/export-png-modal.html',
      controller: 'ExportPngModalCtrl',
      windowClass: 'export-png-modal',
    }).result.finally(function() {
    });
  };

  $scope.sharePngRun = function() {
    StateModal.showModal('share.png', {
      templateUrl: 'views/share-png-modal.html',
      controller: 'SharePngModalCtrl',
      // backdrop: 'static',
      // keyboard: false,
      windowClass: 'share-png-modal',
    }).result.finally(function() {
    });
  };

  $scope.$watch('(depthy.exportPopuped || depthy.exportActive) && depthy.exportSize', function(size) {
    if (size) {
      depthy.viewer.size = {width: size, height: size};
      $scope.oldFit = depthy.viewer.fit;
      depthy.viewer.fit = false;
    } else {
      if ($scope.oldFit) depthy.viewer.fit = $scope.oldFit;
      $($window).resize();
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

});