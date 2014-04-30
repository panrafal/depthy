'use strict';

angular.module('depthyApp')
.controller('ExportModalCtrl', function ($scope, $modalInstance, $rootElement, depthy, ga) {
  $scope.exportProgress = -1;
  $scope.imageReady = false;
  $scope.shareUrl = '';
  $scope.tweetUrl = null;
  $scope.imageOverLimit = false;
  var exportPromise = depthy.exportAnimation(),
      sharePromise = null,
      imageDataUri = null,
      exportStarted = new Date(),
      gaLabel = 'size ' + depthy.exportSize + ' dur ' + depthy.viewer.animDuration;

  ga('send', 'event', 'gif', 'start', gaLabel);

  exportPromise.then(
    function exportSuccess(blob) {
      ga('send', 'timing', 'gif', 'created', new Date() - exportStarted, gaLabel);
      ga('send', 'event', 'gif', 'created', gaLabel, blob.size);
      $scope.imageSize = blob.size;
      $scope.imageOverLimit = blob.size > 2097152;

      var imageReader = new FileReader();
      imageReader.onload = function() {
        imageDataUri = imageReader.result;

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
    ga('send', 'event', 'gif', 'upload', gaLabel, $scope.imageSize);
    $scope.shareUrl = 'sharing';
    $scope.shareError = null;
    $scope.shareProgress = 0;
    sharePromise = $.ajax({
      url: 'https://api.imgur.com/3/image.json',
      method: 'POST',
      headers: {
        Authorization: 'Client-ID ' + depthy.imgurId,
        Accept: 'application/json'
      },
      data: {
        image: imageDataUri.substr('data:image/gif;base64,'.length),
        type: 'base64',
        name: depthy.loadedName,
        title: depthy.loadedName + ' #depthy',
        description: 'Created using http://depthy.stamina.pl'
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
    }).done(function(response, status, xhr) {
      console.log(response, status, xhr);
      var id = response.data.id;

      ga('send', 'event', 'gif', 'upload-success');
      $scope.shareUrl = 'https://imgur.com/' + id;
      $scope.share = {
        url: $scope.shareUrl,
        title: depthy.loadedName + ' #depthy',
        img: 'https://i.imgur.com/' + id + '.gif'
      };
      sharePromise = null;
      $scope.$safeApply();
    }).fail(function(xhr, status) {
      var response = xhr.responseJSON || {};

      sharePromise = null;
      $scope.shareUrl = '';
      $scope.shareError = (response.data || {}).error || 'Something went wrong... Please try again.';
      console.error('Share failed with ', response);
      ga('send', 'event', 'gif', 'upload-error', status + ': ' + $scope.shareError);
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
