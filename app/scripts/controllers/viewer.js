'use strict';

angular.module('depthyApp')
.controller('ViewerCtrl', function ($scope, $element) {

    $scope.stage = null;
    $scope.viewCompound = false;

    function setupStage(stage, renderer) {
        console.log('Stage setup')
        var imageTexture, depthTexture, sprite, depthFilter

        $scope.$watch('[compoundSource, imageSource, depthSource, viewCompound, compoundSize, imageSize, depthSize]', function() {
            console.log('Image change', $scope.imageSize, $scope.depthSize, $scope.compoundSize)
            if (!$scope.imageSource || !$scope.depthSource
                || !$scope.imageSize || !$scope.depthSize || !$scope.compoundSize
                ) return;

            renderer.resize($scope.compoundSize.width, $scope.compoundSize.height);

            if (sprite) stage.removeChild(sprite)

            imageTexture = PIXI.Texture.fromImage($scope.viewCompound ? $scope.compoundSource : $scope.imageSource);
            depthTexture = PIXI.Texture.fromImage($scope.depthSource);
            sprite = new PIXI.Sprite(imageTexture);

            console.log(imageTexture.width, imageTexture.baseTexture.width)

            var blurFilter = new PIXI.BlurFilter();
            blurFilter.blur = 10;

            // if (depthFilter) {
                // depthFilter.map = new PIXI.DepthmapFilter(depthTexture);
            // } else {
                depthFilter = new PIXI.DepthmapFilter(depthTexture);
            // }

            sprite.filters = [depthFilter];
            sprite.scale = new PIXI.Point(1, 1);
            stage.addChild(sprite)
        }, true)

        $element.on('mousemove', function(e) {
            var elOffset = $element.offset(),
                elWidth = $element.width(),
                elHeight = $element.height(),
                x = (e.pageX - elOffset.left) / elWidth,
                y = (e.pageY - elOffset.top) / elHeight

            x = (x * 2 - 1) * 0.1;
            y = (y * 2 - 1) * 0.1;
            // console.log(x, y)

            if (depthFilter) {
                depthFilter.offset = {x : x, y : y};
            }

        })

    }   


    var stageReady = false;
    $scope.pixiAnimate = function(stage, renderer) {
        if (!stageReady) {
            setupStage(stage, renderer);
            stageReady = true;
            $scope.$apply();
            return;
        }
    }


});
