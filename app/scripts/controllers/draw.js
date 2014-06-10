'use strict';

angular.module('depthyApp')
.controller('DrawCtrl', function ($scope, $element, depthy, $window) {

  var drawer = depthy.drawMode,
      viewer = depthy.getViewer(),
      lastPointerPos = null

  angular.extend(depthy.viewer, {
    animate: false,
    fit: 'contain',
    upscale: 2,
    depthBlurSize: 0,
    depthPreview: 0.75,
    enlarge: 1.0,
    // orient: false,
    // hover: false,
  });

  $scope.drawOpts = drawer.getOptions();

  $scope.$watch('drawOpts', function(options) {
    if (drawer && options) {
      drawer.setOptions(options);
    }
  }, true);

  $scope.close = function() {
    $window.history.back();
  };

  $element.on('touchstart mousedown', function(e) {
    var event = e.originalEvent,
        pointerEvent = event.touches ? event.touches[0] : event

    if (event.target.id !== 'draw') return;

    lastPointerPos = viewer.screenToImagePos({x: pointerEvent.pageX, y: pointerEvent.pageY});

    drawer.drawBrush(lastPointerPos);
    event.preventDefault();
    event.stopPropagation();
  });

  $element.on('touchmove mousemove', function(e) {
    if (lastPointerPos) {
      var event = e.originalEvent,
          pointerEvent = event.touches ? event.touches[0] : event,
          pointerPos = viewer.screenToImagePos({x: pointerEvent.pageX, y: pointerEvent.pageY});

      drawer.drawBrushTo(pointerPos);

      lastPointerPos = pointerPos;
    }
  });

  $element.on('touchend mouseup', function(event) {
    // console.log(event);
    lastPointerPos = null;
  });

  $element.on('$destroy', function() {
    console.log('DESTROY!');
  });



});