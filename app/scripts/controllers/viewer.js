'use strict';

angular.module('depthyApp')
.controller('ViewerCtrl', function ($scope) {

    $scope.stage = null;

    $scope.$watch('stage', function(stage) {
        if (!stage) return;

        // setup!

        $scope.$watch('imageSource', function(imageSource) {
            if (!imageSource) return;

            var texture = PIXI.Texture.fromImage(imageSource);
            var test = new PIXI.Sprite(texture);
            stage.addChild(test)
        })


    })


    $scope.pixiAnimate = function(stage) {

    }


});
