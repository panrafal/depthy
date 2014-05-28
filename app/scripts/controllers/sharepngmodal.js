'use strict';

angular.module('depthyApp')
.controller('SharePngModalCtrl', function ($scope, $sce, $timeout, $modalInstance, $state, $q, ga, depthy) {
  var uploadPromise;

  $scope.image = depthy.opened;
  $scope.shareImage = depthy.opened;


  function upload(imageDataUri) {
    ga('send', 'event', 'png', 'upload', '', imageDataUri.length);
    uploadPromise = $.ajax({
      url: 'https://api.imgur.com/3/image.json',
      method: 'POST',
      headers: {
        Authorization: 'Client-ID ' + depthy.imgurId,
        Accept: 'application/json'
      },
      data: {
        image: imageDataUri.substr('data:image/png;base64,'.length),
        type: 'base64',
        name: $scope.image.title,
        title: $scope.image.title + ' #depthy',
        description: 'View this image in 3D on http://depthy.me'
      },
      xhr: function() {
        var xhr = new window.XMLHttpRequest();
        //Upload progress
        xhr.upload.addEventListener('progress', function(evt){
          if (evt.lengthComputable) {
            $scope.uploadProgress = evt.loaded / evt.total;
            $scope.$safeApply();
          }
        }, false);
        return xhr;
      },
    }).done(function(response, status, xhr) {
      console.log(response, status, xhr);
      var id = response.data.id,
          deleteHash = response.data.deletehash;

      if (response.data.type === 'image/png') {
        ga('send', 'event', 'png', 'upload-success');
        $scope.shareImage = $scope.image.createShareImage({
          url: 'https://i.imgur.com/' + id,
          state: 'imgur',
          stateParams: {id: id},
          thumb: 'https://i.imgur.com/' + id + 's.jpg',
          store: depthy.stores.imgur,
          storeUrl: 'https://imgur.com/' + id,
          storeKey: deleteHash
        });

        $scope.share = $scope.image.getShareInfo();

        uploadPromise = null;

        // update description
        $.ajax({
          url: 'https://api.imgur.com/3/image/' + deleteHash,
          method: 'POST',
          headers: {
            Authorization: 'Client-ID ' + depthy.imgurId,
            Accept: 'application/json'
          },
          data: {
            description: 'View this image in 3D on ' + $scope.share.url,
          }
        });
      } else {
        $scope.uploadError = 'This file is too big to upload it to imgur... Sorry :(';
          
        ga('send', 'event', 'png', 'upload-converted');
        $.ajax({
          url: 'https://api.imgur.com/3/image/' + deleteHash,
          method: 'DELETE',
          headers: {
            Authorization: 'Client-ID ' + depthy.imgurId,
            Accept: 'application/json'
          },
        });
      }

      $scope.$safeApply();
    }).fail(function(xhr, status) {
      var response = xhr.responseJSON || {};

      uploadPromise = null;
      $scope.uploadError = (response.data || {}).error || 'Something went wrong... Please try again.';
      console.error('Share failed with ', response);
      ga('send', 'event', 'png', 'upload-error', status + ': ' + $scope.uploadError);
      $scope.$safeApply();
    });

  }


  function generateAndUpload(size, ratio, sizeLimit) {
    size = Math.round(size);
    console.group('Trying PNG size ' + size);
    depthy.getViewer().exportToPNG({width: size, height: size}).then(
      function(dataUrl) {
        console.log('PNG size: ', dataUrl.length);
        console.groupEnd();
        if (dataUrl.length > sizeLimit) {
          if (size > 500) {
            generateAndUpload(size * ratio, ratio, sizeLimit);          
          } else {
            $scope.uploadError = 'This file is too big to upload it to imgur... Sorry :(';
          }
        } else {
          upload(dataUrl);
        }
      }
    );
  }

  $scope.share = $scope.image.getShareInfo();
  if (!$scope.share) {
    // wait for DOM
    $timeout(function() {
      generateAndUpload(850, 0.8, 950000);
    }, depthy.modalWait);
  }



  $modalInstance.result.finally(function() {
    console.log('close');
    if (uploadPromise) uploadPromise.abort();
  });


});
