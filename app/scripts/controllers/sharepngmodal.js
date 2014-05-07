'use strict';

angular.module('depthyApp')
.controller('SharePngModalCtrl', function ($scope, $sce, depthy) {
  depthy.getViewerCtrl().exportToPng({width: 800, height: 800}).then(
    function(url) {
      console.log(url);
      $scope.imgUrl = $sce.trustAsResourceUrl(url);
    }
  );
});
