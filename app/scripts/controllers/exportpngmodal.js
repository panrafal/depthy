'use strict';

angular.module('depthyApp')
.controller('ExportPngModalCtrl', function ($scope, $sce, $timeout, depthy) {
  // wait for DOM
  $timeout(function() {
    depthy.getViewerCtrl().exportToPng(null).then(
      function(url) {
        angular.element('[image-source="export-png-modal"]')[0].src = url;
        // console.log(url);
        // $scope.imgUrl = $sce.trustAsResourceUrl(url);
      }
    );
  });
});
