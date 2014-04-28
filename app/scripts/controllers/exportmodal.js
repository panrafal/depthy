'use strict';

angular.module('depthyApp')
.controller('ExportModalCtrl', function ($scope, $modalInstance, $rootElement, depthy, $sce) {
  $scope.exportProgress = -1;
  $scope.imageReady = false;
  $scope.shareUrl = '';
  $scope.tweetUrl = null;
  $scope.imageOverLimit = false;
  var exportPromise = depthy.exportAnimation(),
      sharePromise = null, 
      imageDataUri = null;
  exportPromise.then(
    function exportSuccess(blob) {
      var imageReader = new FileReader();
      imageReader.onload = function() {
        imageDataUri = imageReader.result;
        $scope.imageSize = imageDataUri.length;
        $scope.imageOverLimit = imageDataUri.length > 7000000;

        // this is way way waaay quicker if you set data uris directly......
        var img = $rootElement.find('.export-modal .export-image img')[0];
        if (Modernizr.android && Modernizr.chrome) {
          // chrome on Android can save only data uris, it's opposite for others
          img.src = imageDataUri;
        } else {
          img.src = URL.createObjectURL(blob);
        }
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
        image: imageDataUri.substr('data:image/gif;base64,'.length),
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
    if ($scope.imageUrl) URL.revokeObjectURL($scope.imageUrl);
    $modalInstance.close();
  };


});
