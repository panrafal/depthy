'use strict';

angular.module('depthyApp')
.controller('MainCtrl', function ($rootScope, $window, $scope, $timeout, ga, depthy, $element, $modal) {

  $rootScope.depthy = depthy;
  $rootScope.viewer = depthy.viewer; // shortcut
  $rootScope.Modernizr = window.Modernizr;

  depthy.loadSample('flowers', false);

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
    depthy.loadSample(name);
    ga('send', 'event', 'sample', name);
  };

  $scope.getNextDepthScaleName = function() {
    var scale = depthy.viewer.depthScale;
    return scale > 1.05 ? 'Calmize' : scale < 0.95 ? 'Normalize' : 'Dramatize';
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
      depthy.handleCompoundFile(files[0]);
    }
  });

  $scope.$watch('depthy.viewer.sourcesDirty', function() {
    // it's not the angular way, but should save us some memory...
    var image = $element.find('[image-source="image"]')[0],
      depth = $element.find('[image-source="depth"]')[0];
    
    if (image && image.src !== depthy.viewer.imageSource) image.src = depthy.viewer.imageSource || '';
    if (depth && depth.src !== depthy.viewer.depthSource) depth.src = depthy.viewer.depthSource || '';

  });

  // wait for DOM

  // animatePopover = $popover($element.find('#button-animate'), {
  //   placement: 'top',
  //   trigger: 'manual',
  //   // title: 'How do you want your GIF?',
  //   contentTemplate: 'views/animate-popover.html',
  // });

  // exportPopover = $popover($element.find('#button-export'), {
  //   placement: 'top',
  //   trigger: 'manual',
  //   // title: 'How do you want your GIF?',
  //   contentTemplate: 'views/export-popover.html',
  // });

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

  $scope.$watch('[depthy.exportPopuped, depthy.exportSize]', function() {
    if (depthy.exportPopuped) {
      depthy.viewer.overrideStageSize = {width: depthy.exportSize, height: depthy.exportSize};
    } else {
      depthy.viewer.overrideStageSize = null;
    }
  }, true);

  $scope.startExport = function() {
    $modal.open({
      templateUrl: 'views/export-modal.html',
      controller: 'ExportModalCtrl',
      backdrop: 'static',
      keyboard: false,
      windowClass: 'modal-export',
    });
    depthy.exportPopuped = false;
    depthy.viewer.animate = false;
  };

  $($window).on('resize', function() {
    depthy.viewer.maxSize = {
      width: $window.innerWidth * 1,
      height: $window.innerHeight * 0.8,
    };
    $scope.$safeApply();
  });
  $($window).resize();

});