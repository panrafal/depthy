'use strict';

angular.module('depthyApp')
.controller('ViewerCtrl', function ($scope, $element, $window) {

    $scope.stage = null;
    $scope.viewCompound = true;
    $scope.sizeDirty = 0;
    $scope.update = true;

    function setupStage(stage, renderer) {
        var imageTexture, depthTexture, sprite, depthFilter

        $scope.$watch('[viewerVisible, compoundSize, imageSize, depthSize, sizeDirty]', function() {
            if (!$scope.viewerVisible || !$scope.imageSize || !$scope.depthSize || !$scope.compoundSize
                ) return;

            var imageSize = $scope.compoundSize,
                imageRatio = imageSize.width / imageSize.height,
                stageSize = {width: imageSize.width, height: imageSize.height}

            if (stageSize.height > $($window).height() * 0.8) {
                stageSize.height = Math.round($($window).height() * 0.8);
                stageSize.width = stageSize.height * imageRatio;
            }
            if (stageSize.width > $($window).width() * 0.8) {
                stageSize.width = Math.round($($window).width() * 0.8);
                stageSize.height = stageSize.width / imageRatio;
            }

            $scope.stageSize = stageSize;
        }, true)

        $scope.$watch('[viewerVisible, compoundSource, imageSource, depthSource, viewCompound, stageSize]', function() {
            $scope.imageReady = $scope.viewerVisible && $scope.imageSource && $scope.depthSource
                             && $scope.imageSize && $scope.depthSize && $scope.compoundSize
            
            if (sprite) stage.removeChild(sprite)

            if (!$scope.imageReady) return;

            var imageSize = $scope.compoundSize,
                stageSize = $scope.stageSize

            var stageScale = stageSize.width / imageSize.width;

            renderer.resize(stageSize.width, stageSize.height);

            imageTexture = PIXI.Texture.fromImage($scope.viewCompound ? $scope.compoundSource : $scope.imageSource);
            depthTexture = PIXI.Texture.fromImage($scope.depthSource);
            sprite = new PIXI.Sprite(imageTexture);

            depthFilter = new PIXI.DepthmapFilter(depthTexture);

            sprite.filters = [depthFilter];
            sprite.scale = new PIXI.Point(stageScale, stageScale);
            stage.addChild(sprite)
            $scope.update = true;
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
                $scope.update = true;
            }

        })

        $($window).on('resize', function() {
            $scope.sizeDirty ++;
            $scope.$apply();
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
        if (!$scope.update) {
            return false;
        }
        $scope.update = false;
    }


});
