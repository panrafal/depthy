'use strict';

angular.module('depthyApp')
.controller('ImageInfoModalCtrl', function ($scope, $modalInstance, ga, depthy, $timeout, StateModal) {
  $scope.info = {};
  $scope.loading = 2;

  // wait for dom
  $timeout(function() {
    if (depthy.hasDepthmap()) {
      depthy.getViewer().exportDepthmap().then(function(url) {
        var img = angular.element('[image-source="depth"]')[0];
        img.onload = function() {
          --$scope.loading;
          $scope.$safeApply();
        };
        img.src = url;
      });
    } else --$scope.loading;
    if (depthy.hasOriginalImage()) {
      var img = angular.element('[image-source="alternative"]')[0];
      img.onload = function() {
        --$scope.loading;
        $scope.$safeApply();
      };
      img.src = depthy.opened.originalSource;
    } else --$scope.loading;
  }, depthy.modalWait);

  $scope.isDepthmapProcessing = false;
  $scope.$watch('info.depthFiles', function(files) {
    if (files && files.length) {
      $scope.isDepthmapProcessing = true;
      depthy.loadLocalDepthmap(files[0]).then(
        function(fromLensblur) {
          $scope.isDepthmapProcessing = false;
          ga('send', 'event', 'depthmap', 'parsed', fromLensblur ? 'from-lensblur' : 'from-file');
          $modalInstance.dismiss();
        },
        function(error) {
          $scope.isDepthmapProcessing = false;
          ga('send', 'event', 'depthmap', 'error', error);
          StateModal.showAlert(error, {stateOptions: {location: 'replace'}});
        }
      );
      // depthy.handleCompoundFile(files[0]);
    }
  });

});
