/**
 *
 * The DepthmapFilter class uses the pixel values from the specified texture (called the displacement map) to perform a displacement of an object.
 * You can use this filter to apply all manor of crazy warping effects
 * Currently the r property of the texture is used offset the x and the g propery of the texture is used to offset the y.
 * @class DepthmapFilter
 * @contructor
 * @param texture {Texture} The texture used for the displacemtent map * must be power of 2 texture at the moment
 */
'use strict';
PIXI.DepthmapFilter = function(texture)
{
  PIXI.AbstractFilter.call( this );
 
  this.passes = [this];
  // texture.baseTexture._powerOf2 = true;
 
  // set the uniforms
  this.uniforms = {
    displacementMap: {type: 'sampler2D', value:texture},
    scale:           {type: '2f', value:{x:0.015, y:0.015}},
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
    'precision mediump float;',
    'varying vec2 vTextureCoord;',
    'varying vec4 vColor;',
    'uniform sampler2D displacementMap;',
    'uniform sampler2D uSampler;',
    'uniform vec2 scale;',
    'uniform vec2 offset;',
    'uniform vec4 dimensions;',
    'uniform vec2 mapDimensions;',
    'uniform float focus;',
 
    'void main(void) {',
    '   vec2 mapCords = vTextureCoord;',
    '   mapCords.y *= -1.0;',
    '   mapCords.y += 1.0;',
    '   float map = texture2D(displacementMap, mapCords).r;',
    '   map = map * -1.0 + focus;',
    '   vec2 disCords = vTextureCoord;',
    '   disCords += offset * vec2(1.0, -1.0) * map * scale;',
    '   gl_FragColor = texture2D(uSampler, disCords) * vColor;',
    // '   gl_FragColor = vec4(1,1,1,0.5);',
    // '   gl_FragColor *= texture2D(displacementMap, mapCords);',
    '}'
  ];
};
 
PIXI.DepthmapFilter.prototype = Object.create( PIXI.AbstractFilter.prototype );
PIXI.DepthmapFilter.prototype.constructor = PIXI.DepthmapFilter;
 
PIXI.DepthmapFilter.prototype.onTextureLoaded = function()
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
Object.defineProperty(PIXI.DepthmapFilter.prototype, 'map', {
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
Object.defineProperty(PIXI.DepthmapFilter.prototype, 'scale', {
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
Object.defineProperty(PIXI.DepthmapFilter.prototype, 'focus', {
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
Object.defineProperty(PIXI.DepthmapFilter.prototype, 'offset', {
  get: function() {
    return this.uniforms.offset.value;
  },
  set: function(value) {
    this.uniforms.offset.value = value;
  }
});