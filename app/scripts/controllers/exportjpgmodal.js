'use strict';

angular.module('depthyApp')
.controller('ExportJpgModalCtrl', function ($scope, $sce, $timeout, $window, depthy) {
  $scope.loading = true;
  // wait for animation
  $timeout(function() {
    var imageUrl, depthUrl, originalUrl;
    depthy.getViewer().exportSourceImage(depthy.opened.imageSource, {}).then(
      function(url) {
        imageUrl = url;
        return depthy.getViewer().exportDepthmap();
      }
    ).then(
      function(url) {
        depthUrl = url;
        if (depthy.opened.originalSource) {
          return depthy.getViewer().exportSourceImage(depthy.opened.imageSource, {});
        } else {
          return false;
        }
      }
    ).then(
      function(url) {
        originalUrl = url;

        // ready! let's do this!
        return GDepthEncoder.encodeDepthmap(window.dataURItoArrayBuffer(imageUrl).buffer, depthUrl, originalUrl);
      }
    ).then(
      function(blob) {
        var url = URL.createObjectURL(blob);
        var img = angular.element('img[image-source="export-jpg-modal"]')[0];
        img.onload = function() {
          $scope.loading = false;
          $scope.$safeApply();
        };
        img.src = url;
        angular.element('a[image-source="export-jpg-modal"]').attr('href', url);
      }
    );

  }, depthy.modalWait);
});
