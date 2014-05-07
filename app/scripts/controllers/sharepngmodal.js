'use strict';

angular.module('depthyApp')
.controller('SharePngModalCtrl', function ($scope, $sce, $timeout, depthy) {
  // wait for DOM
  $timeout(function() {
    depthy.getViewerCtrl().exportToPng({width: 800, height: 800}).then(
      function(url) {
      }
    );
  });
});
