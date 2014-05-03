'use strict';

angular.module('depthyApp')
.controller('MainCtrl', function ($rootScope, $window, $scope, $timeout, ga, depthy, $element, $modal, $state) {

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

  $scope.hasImage = function() {
    return !!depthy.viewer.imageSource;
  };

  $scope.hasDepth = function() {
    return !!depthy.viewer.depthSource;
  };

  $scope.loadSample = function(name) {
    $state.go('sample', {id: name});
    depthy.leftpaneOpen(true);
  };

  $scope.getNextDepthScaleName = function() {
    var scale = depthy.viewer.depthScale;
    return scale > 1.05 ? 'Tranquilize' : scale < 0.95 ? 'Normalize' : 'Dramatize';
  };

  $scope.cycleDepthScale = function() {
    var scale = depthy.viewer.depthScale;
    scale = scale > 1.05 ? 0.5 : scale < 0.95 ? 1 : 2;
    $scope.animateOption(depthy.viewer, {depthScale: scale});
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


  // $scope.$on('fileselect', function(e, files) {
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
          depthy.showAlert(e);
        }
      );
      // depthy.handleCompoundFile(files[0]);
    }
  });

  $scope.$watch('depthy.viewer.sourcesDirty', function() {
    // it's not the angular way, but should save us some memory...
    var image = $element.find('[image-source="image"]')[0],
      depth = $element.find('[image-source="depth"]')[0];
    
    if (image && image.src !== depthy.viewer.imageSource) image.src = depthy.viewer.imageSource || '';
    if (depth && depth.src !== depthy.viewer.depthSource) depth.src = depthy.viewer.depthSource || '';

  });


  $scope.toggleAnimatePopup = function() {
    if (!depthy.animatePopuped) depthy.viewer.animate = true;
    depthy.exportPopuped = false;
    depthy.animatePopuped = !depthy.animatePopuped;
  };

  $scope.toggleExportPopup = function() {
    if (!depthy.exportPopuped) depthy.viewer.animate = true;
    depthy.animatePopuped = false;
    depthy.exportPopuped = !depthy.exportPopuped;
  };

  $scope.$watch('(depthy.exportPopuped || depthy.exportActive) && depthy.exportSize', function(size) {
    if (size) {
      depthy.viewer.overrideStageSize = {width: size, height: size};
    } else {
      depthy.viewer.overrideStageSize = null;
    }
  });

  $scope.startExport = function() {
    depthy.exportActive = true;
    $modal.open({
      templateUrl: 'views/export-modal.html',
      controller: 'ExportModalCtrl',
      backdrop: 'static',
      keyboard: false,
      windowClass: 'export-modal',
    }).result.finally(function() {
      depthy.exportActive = false;
    });
    depthy.exportPopuped = false;
    depthy.viewer.animate = false;
  };

  $scope.$on('pixi.webgl.init.exception', function(evt, exception) {
    console.error('WebGL Init Exception', exception);
    Modernizr.webgl = false;
    ga('send', 'event', 'webgl', 'exception', exception.toString(), {nonInteraction: 1});
  });

  $($window).on('resize', function() {
    depthy.viewer.maxSize = {
      width: $window.innerWidth * 1,
      height: $window.innerHeight * 0.8,
    };
    $scope.$safeApply();
  });
  $($window).resize();

});