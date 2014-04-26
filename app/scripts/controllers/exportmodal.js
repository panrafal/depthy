'use strict';

angular.module('depthyApp')
.controller('ExportModalCtrl', function ($scope, $modalInstance, depthy, $sce) {
  $scope.exportProgress = -1;
  $scope.imageReady = false;
  var exportPromise = depthy.exportAnimation();
  exportPromise.then(
    function exportSuccess(blob) {

      var imageReader = new FileReader();
      imageReader.onload = function() {
        $scope.imageUrl = $sce.trustAsResourceUrl( imageReader.result );
        $scope.imageReady = true;
        $scope.$safeApply();
      };
      imageReader.readAsDataURL(blob);

    },
    function exportFailed() {
      $scope.exportError = 'Export failed';
    },
    function exportProgress(p) {
      $scope.exportProgress = p;
      $scope.$safeApply();
      // console.log(p)
    }
  );

  $scope.$close = function() {
    console.log('close');
    exportPromise.abort();
    $modalInstance.close();
  };

});
