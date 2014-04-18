'use strict';

angular.module('depthyApp')
.controller('ViewerCtrl', function ($scope) {

    $scope.stage = null;

    $scope.$watch('stage', function(stage) {
        if (!stage) return;

        // setup!
    })

    $scope.pixiAnimate = function(stage) {
        
    }


});
