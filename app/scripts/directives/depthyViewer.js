'use strict';

angular.module('depthyApp')
.directive('depthyViewer', function () {
  return {
    restrict: 'A',
    scope: true,
    controller: function($scope, $element, $attrs) {
      var options, viewer;

      $scope.$parent.$watch($attrs.depthyViewer, function(newOptions) {
        options = newOptions || {};
        if (viewer) viewer.setOptions(options);
      }, true);

      viewer = new DepthyViewer($element[0], options);

      this.getViewer = function() {
        return viewer;
      };

    },
  };

});
