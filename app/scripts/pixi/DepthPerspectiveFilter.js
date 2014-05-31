/**
 * @class DepthPerspectiveFilter
 * @contructor
 * @param texture {Texture} The texture used for the displacemtent map * must be power of 2 texture at the moment
 */
'use strict';
PIXI.DepthPerspectiveFilter = function(texture)
{
  PIXI.AbstractFilter.call( this );
 
  this.passes = [this];
 
  // set the uniforms
  this.uniforms = {
    displacementMap: {type: 'sampler2D', value:texture},
    scale:           {type: '1f', value:0.015},
    offset:          {type: '2f', value:{x:0, y:0}},
    mapDimensions:   {type: '2f', value:{x:1, y:5112}},
    dimensions:      {type: '4fv', value:[0,0,0,0]},
    focus:           {type: '1f', value:0.5}
  };
 
  if(texture.baseTexture.hasLoaded)
  {
    this.uniforms.mapDimensions.value.x = texture.width;
    this.uniforms.mapDimensions.value.y = texture.height;
  }
  else
  {
    this.boundLoadedFunction = this.onTextureLoaded.bind(this);
 
    texture.baseTexture.on('loaded', this.boundLoadedFunction);
  }
 
  this.fragmentSrc = [

'precision highp float;',
'varying vec2 vTextureCoord;',
'varying vec4 vColor;',
'uniform sampler2D displacementMap;',
'uniform sampler2D uSampler;',
'uniform vec4 dimensions;',
'uniform vec2 mapDimensions;',
'uniform float scale;',
'uniform vec2 offset;',
'uniform float focus;',
'const float maxSteps = 8.0;',
'',
'float perspective = -0.0;',
'float steps = min(64.0, maxSteps);',
'',
'float aspect = dimensions.x / dimensions.y;',
'vec2 scale2 = vec2(scale / aspect, scale) * vec2(1, -1) * vec2(2);',
'mat2 baseVector = mat2(vec2(-focus * offset) * scale2, vec2(offset - focus * offset) * scale2);',
'',
'',
'void main(void) {',
'    vec2 pos = vTextureCoord;',
'    mat2 vector = baseVector;',
'    // perspective shift',
'    vector[1] += (vec2(2.0) * pos - vec2(1.0)) * vec2(perspective);',
'    ',
'    float dstep = 1.0 / (steps - 1.0);',
'    vec2 vstep = (vector[1] - vector[0]) / vec2((steps - 1.0));',
'    ',
'    vec4 colSum = vec4(0.0);',
'    float colCount = 0.0;',
'    float minConfidence = dstep / 2.0;',
'    ',
'    vec2 vpos = pos + vector[1];',
'    float dpos = 1.0;',
'    ',
'    for(float i = 0.0; i < maxSteps; ++i) {',
'        float depth = 1.0 - texture2D(displacementMap, vpos * vec2(1, -1) + vec2(0, 1)).r;',
'        float confidence = 1.0 - abs(dpos - depth);',
'        //if (depth < dpos) confidence *= 0.001;',
'        if (confidence < 1.0 - minConfidence) confidence *= 0.001;',
'        colSum += texture2D(uSampler, vpos) * confidence;',
'        colCount += confidence;',
'        ',
'//     gl_FragColor = vec4(confidence, depth, minConfidence, 0);',
'//         return;',
'        ',
'        dpos -= dstep;',
'        vpos -= vstep;',
'        if (dpos <= 0.0 || colCount > 0.2) break;',
'    };',
'    ',
'    gl_FragColor = colSum / vec4(colCount);',
'',
'}',

  ];
};
 
PIXI.DepthPerspectiveFilter.prototype = Object.create( PIXI.AbstractFilter.prototype );
PIXI.DepthPerspectiveFilter.prototype.constructor = PIXI.DepthPerspectiveFilter;
 
PIXI.DepthPerspectiveFilter.prototype.onTextureLoaded = function()
{
  this.uniforms.mapDimensions.value.x = this.uniforms.displacementMap.value.width;
  this.uniforms.mapDimensions.value.y = this.uniforms.displacementMap.value.height;
 
  this.uniforms.displacementMap.value.baseTexture.off('loaded', this.boundLoadedFunction);
};
 
/**
 * The texture used for the displacemtent map * must be power of 2 texture at the moment
 *
 * @property map
 * @type Texture
 */
Object.defineProperty(PIXI.DepthPerspectiveFilter.prototype, 'map', {
  get: function() {
    return this.uniforms.displacementMap.value;
  },
  set: function(value) {
    this.uniforms.displacementMap.value = value;
  }
});
 
/**
 * The multiplier used to scale the displacement result from the map calculation.
 *
 * @property scale
 * @type Point
 */
Object.defineProperty(PIXI.DepthPerspectiveFilter.prototype, 'scale', {
  get: function() {
    return this.uniforms.scale.value;
  },
  set: function(value) {
    this.uniforms.scale.value = value;
  }
});
 
/**
 * Focus point in paralax
 *
 * @property focus
 * @type float
 */
Object.defineProperty(PIXI.DepthPerspectiveFilter.prototype, 'focus', {
  get: function() {
    return this.uniforms.focus.value;
  },
  set: function(value) {
    this.uniforms.focus.value = Math.min(1,Math.max(0,value));
  }
});

/**
 * The offset used to move the displacement map.
 *
 * @property offset
 * @type Point
 */
Object.defineProperty(PIXI.DepthPerspectiveFilter.prototype, 'offset', {
  get: function() {
    return this.uniforms.offset.value;
  },
  set: function(value) {
    this.uniforms.offset.value = value;
  }
});