'use strict';

angular.module('depthyApp').provider('depthy', function depthy() {

  // global settings object, synchronized with the remote profile, only simple values!
  var viewer = {
    }



  this.$get = function() {
    var depthy = {
      viewer: viewer,
    }

    return depthy;
  }
}); 


