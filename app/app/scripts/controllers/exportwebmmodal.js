'use strict';

angular.module('depthyApp')
.controller('ExportWebmModalCtrl', function ($scope, $modalInstance, $rootElement, depthy, ga, $timeout, $sce) {
  $scope.exportProgress = 0;
  $scope.imageReady = false;
  $scope.shareUrl = '';
  $scope.tweetUrl = null;
  $scope.imageOverLimit = false;

  $timeout(function() {
    var exportPromise = depthy.exportWebmAnimation(),
        sharePromise = null,
        imageDataUri = null,
        exportStarted = new Date(),
        gaLabel = 'size ' + depthy.exportSize + ' dur ' + depthy.viewer.animDuration;

    ga('send', 'event', 'webm', 'start', gaLabel);

    exportPromise.then(
      function exportSuccess(blob) {
        ga('send', 'timing', 'webm', 'created', new Date() - exportStarted, gaLabel);
        ga('send', 'event', 'webm', 'created', gaLabel, blob.size);

        $scope.size = blob.size;
        $scope.videoUrl = $sce.trustAsResourceUrl(URL.createObjectURL(blob));
        $scope.ready = true;

      },
      function exportFailed() {
        $scope.exportError = 'Export failed';
      },
      function exportProgress(p) {
        $scope.exportProgress = p;
        $scope.$safeApply();
      }
    );

    $modalInstance.result.finally(function() {
      if (exportPromise) exportPromise.abort();
      if ($scope.videoUrl) URL.revokeObjectURL($scope.videoUrl.toString());
    });
  }, depthy.modalWait);

});
