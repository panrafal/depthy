'use strict';

angular.module('depthyApp')
.controller('MainCtrl', function ($scope, $timeout, ga, depthy, $element) {

  var self = this;

  $scope.depthy = depthy;
  $scope.viewer = depthy.viewer; // shortcut
  $scope.Modernizr = window.Modernizr;

  depthy.loadSample('flowers', false);

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

  // $scope.$on('fileselect', function(e, files) {
  $scope.$watch('compoundFiles', function(files) {
    if (files && files.length) {
      depthy.handleCompoundFile(files[0]);
    }
  });

  $scope.$watch('depthy.viewer.dirty', function() {
    // it's not the angular way, but should save us some memory...
    var image = $element.find('[image-source="image"]')[0],
      depth = $element.find('[image-source="depth"]')[0];
    
    if (image && image.src !== depthy.viewer.imageSource) image.src = depthy.viewer.imageSource || '';
    if (depth && depth.src !== depthy.viewer.depthSource) depth.src = depthy.viewer.depthSource || '';

  });

  /*
  function watchImageSize(type) {
    $scope.$watch(type + 'Source', function(source) {
      $scope[type + 'Size'] = null;
      if (!source) return;
      var img = new Image();
      img.onload = function() {
        $scope[type + 'Size'] = {
          width: img.width,
          height: img.height,
        };
        img.onload = null;
        img.src = '';
        $scope.$apply();
      };
      img.src = source;
    });
  }

  watchImageSize('compound');
  watchImageSize('image');
  watchImageSize('depth');
  */
});