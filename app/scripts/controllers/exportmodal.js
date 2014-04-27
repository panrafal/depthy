'use strict';

angular.module('depthyApp')
.controller('ExportModalCtrl', function ($scope, $modalInstance, depthy, $sce) {
  $scope.exportProgress = -1;
  $scope.imageReady = false;
  $scope.shareUrl = '';
  $scope.tweetUrl = null; 
  var exportPromise = depthy.exportAnimation(),
      sharePromise = null;
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

  $scope.share = function() {
    $scope.shareUrl = 'sharing';
    $scope.shareError = null;
    $scope.shareProgress = 0;
    sharePromise = $.ajax({
      url: 'https://api.imgur.com/3/image',
      method: 'POST',
      headers: {
        Authorization: 'Client-ID ' + depthy.imgurId,
        Accept: 'application/json'
      },
      data: {
        image: $sce.getTrustedResourceUrl($scope.imageUrl).replace(/^data:image\/gif;base64,/, ''),
        type: 'base64'
      },
      xhr: function() {
        var xhr = new window.XMLHttpRequest();
        //Upload progress
        xhr.upload.addEventListener('progress', function(evt){
          if (evt.lengthComputable) {  
            $scope.shareProgress = evt.loaded / evt.total;
            $scope.$safeApply();
          }
        }, false); 
        return xhr;
      },      
    }).done(function(result) {
        var id = result.data.id;
        $scope.shareUrl = 'https://i.imgur.com/' + id + '.gif';
        $scope.tweetUrl = 'http://twitter.com/home?status=' + encodeURIComponent($scope.shareUrl + ' #depthy');
        sharePromise = null;
        $scope.$safeApply();
    }).fail(function(xhr, status) {
        sharePromise = null;
        $scope.shareUrl = '';
        $scope.shareError = true;
        console.error('Share failed with status: %s', status);
        $scope.$safeApply();
    });

  };

  $scope.$close = function() {
    console.log('close');
    if (exportPromise) exportPromise.abort();
    if (sharePromise) sharePromise.abort();
    $modalInstance.close();
  };


});
