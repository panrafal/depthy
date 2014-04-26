'use strict';

angular.module('depthyApp')
.controller('ExportModalCtrl', function ($scope, $modalInstance, depthy, $sce) {

  $scope.exportProgress = -1;
  var exportPromise = depthy.exportAnimation();
  exportPromise.then(
    function exportSuccess(blob) {
      $scope.imageUrl = $sce.trustAsResourceUrl( URL.createObjectURL(blob) );
      console.log(URL.createObjectURL(blob));
      $scope.$safeApply();
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
