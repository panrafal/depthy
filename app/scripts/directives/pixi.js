'use strict';

angular.module('depthyApp')
.directive('pixi', function ($parse, $window) {
  return {
    template: '<canvas></canvas>',
    restrict: 'A',
    scope: true,
    link: function postLink(scope, element, attrs) {

      var scopeParent = scope.$parent,
        stageAttr = $parse(attrs.pixi),
        stage = stageAttr(scopeParent),
        animateFunc = scopeParent.$eval(attrs.pixiAnimate)

      if (!stage) {
        // create a new instance of a pixi stage
        stage = new PIXI.Stage(scopeParent.$eval(attrs.pixiBackground || '0'));
        stageAttr.assign(scopeParent, stage)
      }
     
      var antialias = scopeParent.$eval(attrs.pixiAntialias || 'false'),
        transparent = scopeParent.$eval(attrs.pixiTransparent || 'false'),
        rendererType = scopeParent.$eval(attrs.pixiRenderer || 'auto'),
        renderer
      // create a renderer instance.
      switch(rendererType) {
        case 'canvas':
          renderer = new PIXI.CanvasRenderer(element.width(), element.height(), element[0], transparent);
          break;
        case 'webgl':
          try {
            renderer = new PIXI.WebGLRenderer(element.width(), element.height(), element[0], transparent, antialias);
          } catch (e) {
            Modernizr.webgl = false;
            return;
          }
          break;
        default:
          renderer = PIXI.autoDetectRenderer(element.width(), element.height(), element[0], antialias, transparent);
      }

      function animate() {
     
        var render
        if (animateFunc) render = animateFunc(stage, renderer);

        requestAnimFrame( animate );
     
        // render the stage   
        if (render !== false) renderer.render(stage);
      }

      requestAnimFrame( animate );

      // $($window).resize(function() {
      //     renderer.resize(element.width(), element.height())                
      // })

    }
  };
});
