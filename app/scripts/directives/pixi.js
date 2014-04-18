'use strict';

angular.module('depthyApp')
.directive('pixi', function ($parse) {
    return {
        template: '<canvas></canvas>',
        restrict: 'A',
        link: function postLink(scope, element, attrs) {

            var stageAttr = $parse(attrs.pixi),
                stage = stageAttr(),
                animateFunc = scope.$eval(attrs.pixiAnimate)

            if (!stage) {
                // create an new instance of a pixi stage
                stage = new PIXI.Stage(0x66FF99);
                stageAttr.assign(scope, stage)
            }
         
            // create a renderer instance.
            var renderer = PIXI.autoDetectRenderer(400, 300, element[0]);
            
            function animate() {
         
                if (animateFunc) animateFunc();

                requestAnimFrame( animate );
         
                // render the stage   
                renderer.render(stage);
            }

            requestAnimFrame( animate );

        }
    };
});
