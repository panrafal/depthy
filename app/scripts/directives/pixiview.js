'use strict';

angular.module('depthyApp')
  .directive('pixiview', function () {
    return {
      template: '<div></div>',
      restrict: 'E',
      link: function postLink(scope, element, attrs) {
        element.text('this is the pixiview directive');
      }
    };
  });
