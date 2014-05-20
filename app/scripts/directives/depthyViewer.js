'use strict';

angular.module('depthyApp')
.directive('depthyViewer', function () {
  return {
    restrict: 'A',
    scope: true,
    controller: function($scope, $element, $attrs) {
      var viewer,
          options = $scope.$parent.$eval($attrs.depthyViewer);

      $scope.$parent.$watch($attrs.depthyViewer, function(newOptions) {
        if (viewer && newOptions) {
          viewer.setOptions(options);
        }
      }, true);

      viewer = new DepthyViewer($element[0], options);

      this.getViewer = function() {
        return viewer;
      };

    },
  };

});
