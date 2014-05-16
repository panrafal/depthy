'use strict';

angular.module('depthyApp')
.controller('ExportPngModalCtrl', function ($scope, $sce, $timeout, depthy) {
  $scope.loading = true;
  // wait for animation
  $timeout(function() {
    depthy.getViewer().exportToPNG(null).then(
      function(url) {
        
        var img = angular.element('[image-source="export-png-modal"]')[0];
        img.onload = function() {
          $scope.loading = false;
          $scope.$safeApply();
        }
        img.src = url;
      }
    );
  }, depthy.modalWait);
});
