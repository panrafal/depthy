'use strict';

angular.module('depthyApp')
.controller('ImageInfoModalCtrl', function ($scope, $modalInstance, ga, depthy, $timeout, StateModal) {
  $scope.info = {};

  $timeout(function() {
    if (depthy.viewer.depthSource) {
      angular.element('[image-source="depth"]')[0].src = depthy.viewer.depthSource;
    }
    if (depthy.viewer.alternativeSource) {
      angular.element('[image-source="alternative"]')[0].src = depthy.viewer.alternativeSource;
    }
  });

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
