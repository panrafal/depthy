'use strict';

angular.module('depthyApp')
.controller('DrawCtrl', function ($scope, $element, depthy, $window, $timeout) {

  var drawer = depthy.drawMode,
      viewer = depthy.getViewer(),
      lastPointerPos = null,
      oldViewerOpts = angular.extend({}, depthy.viewer);
      
  drawer.setOptions(depthy.drawOptions || {
    depth: 0.5,
    size: 0.05,
    hardness: 0.5,
    opacity: 0.25,
  });

  angular.extend(depthy.viewer, {
    animate: false,
    fit: 'contain',
    upscale: 2,
    // depthPreview: 0.75,
    // orient: false,
    // hover: false,
  });

  $scope.drawer = drawer;
  $scope.drawOpts = drawer.getOptions();

  $scope.preview = 1;
  $scope.brushMode = false;

  $scope.$watch('drawOpts', function(options) {
    if (drawer && options) {
      drawer.setOptions(options);
    }
  }, true);

  $scope.$watch('preview', function(preview) {
    depthy.viewer.orient = preview === 2;
    depthy.viewer.hover = preview === 2;
    depthy.viewer.animate = preview === 2 && oldViewerOpts.animate;
    depthy.viewer.quality = preview === 2 ? false : 1;
    depthy.animateOption(depthy.viewer, {
      depthPreview: preview === 0 ? 1 : preview === 1 ? 0.75 : 0,
      depthScale: preview === 2 ? oldViewerOpts.depthScale : 0,
      depthBlurSize: preview === 2 ? oldViewerOpts.depthBlurSize : 0,
      enlarge: 1.0,
    }, 250);
  });

  $scope.togglePreview = function() {
    $scope.preview = ++$scope.preview % 3;
  };

  $scope.done = function() {
    $window.history.back();
  };

  $scope.cancel = function() {
    drawer.cancel();
    $window.history.back();
  };

  $scope.brushIcon = function() {
    switch($scope.brushMode) {
      case 'picker':
        return 'target';
      case 'level':
        return 'magnet';
      default:
        return 'draw';
    }
  };


  $element.on('touchstart mousedown', function(e) {
    var event = e.originalEvent,
        pointerEvent = event.touches ? event.touches[0] : event;

    if (event.target.id !== 'draw') return;

    lastPointerPos = viewer.screenToImagePos({x: pointerEvent.pageX, y: pointerEvent.pageY});

    if ($scope.brushMode === 'picker' || $scope.brushMode === 'level') {
      $scope.drawOpts.depth = drawer.getDepthAtPos(lastPointerPos);
      console.log('Picked %s', $scope.drawOpts.depth);
      if ($scope.brushMode === 'picker') {
        $scope.brushMode = false;
        lastPointerPos = null;
        $scope.$safeApply();
        event.preventDefault();
        event.stopPropagation();
        return;
      } else {
        $scope.$safeApply();
      }
    }

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
    if (lastPointerPos) {
      lastPointerPos = null;
      $scope.$safeApply();
    }
  });

  function getSliderForKey(e) {
    var id = 'draw-brush-depth';
    if (e.shiftKey && e.altKey) {
      id = 'draw-brush-hardness';
    } else if (e.altKey) {
      id = 'draw-brush-opacity';
    } else if (e.shiftKey) {
      id = 'draw-brush-size';
    }
    var el = $element.find('.' + id + ' [range-stepper]');
    el.click(); // simulate click to notify change
    return el.controller('rangeStepper');
  }

  function onKeyDown(e) {
    var s, handled = false;
    console.log('keydown which %d shift %s alt %s ctrl %s', e.which, e.shiftKey, e.altKey, e.ctrlKey);
    if (e.which === 48) { // 0
      getSliderForKey(e).percent(0.5);
      handled = true;
    } else if (e.which >= 49 && e.which <= 57) { // 1-9
      getSliderForKey(e).percent((e.which - 49) / 8);
      handled = true;
    } else if (e.which === 189) { // -
      s = getSliderForKey(e);
      s.percent(s.percent() - 0.025);
      handled = true;
    } else if (e.which === 187) { // +
      s = getSliderForKey(e);
      s.percent(s.percent() + 0.025);
      handled = true;
    } else if (e.which === 32) {
      $element.find('.draw-preview').click();
      handled = true;
    } else if (e.which === 90) { // z
      $element.find('.draw-undo').click();
      handled = true;
    } else if (e.which === 80) { // p
      $element.find('.draw-picker').click();
      handled = true;
    } else if (e.which === 76) { // l
      $element.find('.draw-level').click();
      handled = true;
    }

    if (handled) {
      e.preventDefault();
      $scope.$safeApply();
    }

  }

  $($window).on('keydown', onKeyDown);

  $element.find('.draw-brush-depth').on('touchstart mousedown click', function() {
    $scope.brushMode = false;
  });

  $element.on('$destroy', function() {
    $element.off('touchstart mousedown');
    $element.off('touchmove mousemove');
    $($window).off('keydown', onKeyDown);

    depthy.animateOption(depthy.viewer, {
      depthPreview: oldViewerOpts.depthPreview,
      depthScale: oldViewerOpts.depthScale,
      depthBlurSize: oldViewerOpts.depthBlurSize,
      enlarge: oldViewerOpts.enlarge,
    }, 250);

    $timeout(function() {
      angular.extend(depthy.viewer, oldViewerOpts);
    }, 251);

    if (drawer.isCanceled()) {
      // restore opened depthmap
      viewer.setDepthmap(depthy.opened.depthSource, depthy.opened.depthUsesAlpha);
    } else {
      if (drawer.isModified()) {
        depthy.drawOptions = drawer.getOptions();

        // remember drawn depthmap
        // store it as jpg
        viewer.exportDepthmap().then(function(url) {
          depthy.opened.markAsModified();
          depthy.opened.depthSource = url; //viewer.getDepthmap().texture;
          depthy.opened.depthUsesAlpha = false;
          viewer.setDepthmap(url);
          depthy.opened.onDepthmapOpened();
        });
      }
    }

    drawer.destroy(true);

  });



});