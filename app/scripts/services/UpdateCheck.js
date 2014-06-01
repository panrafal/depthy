'use strict';

angular.module('depthyApp')
.service('UpdateCheck', function UpdateCheck($window, $q) {
    
  this.check = function(update) {
    var appCache = $window.applicationCache;
    if (!appCache) {
      return $q.reject();
    }

    var deferred = $q.defer();
    // Check if a new cache is available on page load.
    $window.addEventListener('load', function(e) {

      if (update && appCache.status === appCache.IDLE) {
        console.log('Updating the app cache!');
        appCache.update();
      }

      appCache.addEventListener('updateready', function(e) {
        if (appCache.status == window.applicationCache.UPDATEREADY) {
          console.log('Got update!');
          $q.resolve();
        } else {
          $q.reject();
        }
      }, false);

    }, false);

    return deferred.promise;
  }

});
