'use strict';

angular.module('depthyApp')
.controller('ViewerCtrl', function ($scope, $element, $window, $timeout) {

    $scope.stage = null;
    $scope.viewCompound = true;
    $scope.animate = false;
    $scope.scaleUp = false;
    $scope.sizeDirty = 0;
    $scope.update = 1;
    $scope.viewerVisible = true;
    $scope.depthFilter = null;
    $scope.offset = {x: 0, y: 0};
    $scope.easedOffset = {x: 0, y: 0};
    $scope.easeFactor = Modernizr.mobile ? .75 : .9;

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

            if (window.devicePixelRatio >= 2) {
                stageSize.width *= 2;
                stageSize.height *= 2;
                $element.find('canvas')
                    // .css('transform', 'scale(0.5, 0.5)')
                    .css('width', stageSize.width / 2 + 'px')
                    .css('height', stageSize.height / 2 + 'px')

            }

            $scope.stageSize = stageSize;
        }, true)

        $scope.$watch('[viewerVisible, compoundSource, imageSource, depthSource, viewCompound, stageSize, compoundSize, imageSize, depthSize, scaleUp]', function() {
            $scope.imageReady = $scope.viewerVisible && $scope.imageSource && $scope.depthSource
                             && $scope.imageSize && $scope.depthSize && $scope.compoundSize
            
            if (sprite) {
                stage.removeChild(sprite);
                sprite = null;
                $scope.update = 1;
            }

            if (!$scope.imageReady) return;

            var imageSize = $scope.compoundSize,
                stageSize = $scope.stageSize

            var stageScale = stageSize.width / imageSize.width;

            renderer.resize(stageSize.width, stageSize.height);

            imageTexture = PIXI.Texture.fromImage($scope.viewCompound ? $scope.compoundSource : $scope.imageSource);
            depthTexture = PIXI.Texture.fromImage($scope.depthSource);
            sprite = new PIXI.Sprite(imageTexture);

            var depthScale = (Modernizr.mobile ? 0.015 : 0.015) * ($scope.scaleUp ? 2 : 1);
            $scope.depthFilter = depthFilter = new PIXI.DepthmapFilter(depthTexture);
            depthFilter.scale = {
                x: (stageSize.width > stageSize.height ? 1 : stageSize.height / stageSize.width) * depthScale, 
                y: (stageSize.width < stageSize.height ? 1 : stageSize.width / stageSize.height) * depthScale
            }

            sprite.filters = [depthFilter];
            sprite.scale = new PIXI.Point(stageScale, stageScale);
            stage.addChild(sprite)
            //render on load events
            $scope.update = 1;
            // allow load events to fire
            $timeout(function() {
                $scope.update = 1;
            }, 100)
        }, true)

        $element.on('mousemove touchmove', function(e) {
            
            if ($scope.animate) return;

            var elOffset = $element.offset(),
                elWidth = $element.width(),
                elHeight = $element.height(),
                stageSize = $scope.stageSize.height * 0.8,
                pointerEvent = e.originalEvent.touches ? e.originalEvent.touches[0] : e,
                x = (pointerEvent.pageX - elOffset.left) / elWidth,
                y = (pointerEvent.pageY - elOffset.top) / elHeight

            x = Math.max(-1, Math.min(1, (x * 2 - 1) * elWidth / stageSize));
            y = Math.max(-1, Math.min(1, (y * 2 - 1) * elHeight / stageSize));

            if (depthFilter) {
                $scope.offset = {x: -x, y: -y};
                $scope.update = 1;
            }
          
        })

        var orientation = {}
        $window.addEventListener('deviceorientation', function(event) {
            if (event.beta === null || event.gamma === null) return;

            if (orientation && !$scope.animate) {
                var portrait = window.innerHeight > window.innerWidth,
                    beta = (event.beta - orientation.beta) * 0.2,
                    gamma = (event.gamma - orientation.gamma) * 0.2,
                    x = portrait ? -gamma : -beta,
                    y = portrait ? -beta : -gamma

                if (depthFilter) {

                    if (x && y) {
                        $scope.offset = {
                            x : Math.max(-1, Math.min(1, $scope.offset.x + x)), 
                            y : Math.max(-1, Math.min(1, $scope.offset.y + y))
                        };           
                    }         
                    // console.log("offset %d %d ABG %d %d %d", $scope.offset.x, $scope.offset.y, event.alpha, event.beta, event.gamma)
                    $scope.update = 1;
                }

            }
            orientation = {
                alpha: event.alpha,
                beta: event.beta,
                gamma: event.gamma
            }
        })

        // $window.addEventListener('devicemotion', function(event) {
        //     console.log(event.acceleration, event.rotationRate)
        // })

        $window.addEventListener('resize', function() {
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

        //should be based on window.performance.now() but maybe later...
        if ($scope.offset.x != $scope.easedOffset.x || $scope.offset.y != $scope.easedOffset.y) {
            
            $scope.easedOffset.x = $scope.easedOffset.x * $scope.easeFactor + $scope.offset.x * (1-$scope.easeFactor);
            $scope.easedOffset.y = $scope.easedOffset.y * $scope.easeFactor + $scope.offset.y * (1-$scope.easeFactor);
            if (Math.abs($scope.easedOffset.x - $scope.offset.x) < 0.0001 && Math.abs($scope.easedOffset.y - $scope.offset.y) < 0.0001) {
                $scope.easedOffset = $scope.offset;
            }

            $scope.depthFilter.offset = {
                x : $scope.easedOffset.x, 
                y : $scope.easedOffset.y
            } 
            $scope.update = 1;
        }

        if ($scope.animate) {
            var now = Modernizr.performance ? window.performance.now() : new Date();
            $scope.depthFilter.offset = {
                x : Math.sin(now * Math.PI / 1000), 
                y : Math.cos(now * Math.PI / 1000)
            }            
            $scope.update = 1;
        }


        if (!$scope.update) {
            return false;
        }

        $scope.update--;
    }


});
