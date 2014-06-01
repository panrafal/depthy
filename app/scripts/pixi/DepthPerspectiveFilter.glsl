precision highp float;

varying vec2 vTextureCoord;
varying vec4 vColor;
uniform sampler2D displacementMap;
uniform sampler2D uSampler;
uniform vec4 dimensions;
uniform vec2 mapDimensions;
uniform float scale;
uniform vec2 offset;
uniform float focus;

#define METHOD 1
// #define BRANCHLOOP  
// #define BRANCHSAMPLE 
#define DEBUG 0
// #define CORRECT
// #define COLORAVG

const float maxSteps = 16.0;

const float perspective = -0.05;
const float upscale = 1.1;
// float steps = clamp( ceil( max(abs(offset.x), abs(offset.y)) * maxSteps ), 1.0, maxSteps);
float steps = maxSteps;

#ifdef COLORAVG
float maskPower = steps * 1.0;// 32.0;
#else 
float maskPower = steps / 4.0;// 32.0;
#endif
float correctPower = max(1.0, steps / 4.0);

const float vectorCutoff = 0.0;
const float confidenceCutoff = 0.2;

float aspect = dimensions.x / dimensions.y;
vec2 scale2 = vec2(scale / aspect, scale) * vec2(1, -1) * vec2(8);
mat2 baseVector = mat2(vec2(-focus * offset) * scale2, vec2(offset - focus * offset) * scale2);


void main(void) {

  vec2 pos = (vTextureCoord - vec2(0.5)) / vec2(upscale) + vec2(0.5);
  mat2 vector = baseVector;
  // perspective shift
  vector[1] += (vec2(2.0) * pos - vec2(1.0)) * vec2(perspective);
  
  float dstep = 1.0 / (steps - 1.0);
  vec2 vstep = (vector[1] - vector[0]) / vec2((steps - 1.0));
  
  #ifdef COLORAVG
    vec4 colSum = vec4(0.0);
  #else
    vec2 posSum = vec2(0.0);
  #endif

  float confidenceSum = 0.0;
  float minConfidence = dstep / 2.0;
  
  vec2 vpos = pos + vector[1];
  float dpos = 1.0;
    
    
    for(float i = 1.0; i <= maxSteps; ++i) {
      #ifdef BRANCHLOOP
      if (dpos >= vectorCutoff && confidenceSum < confidenceCutoff) {
      #endif
        float depth = 1.0 - texture2D(displacementMap, vpos * vec2(1, -1) + vec2(0, 1)).r;
        float confidence;

        #if METHOD == 1
          confidence = step(dpos - dstep, depth);

        #elif METHOD == 2
          confidence = 1.0 - abs(dpos - depth);
          if (confidence < 1.0 - minConfidence * 2.0) confidence = 0.0;

        #elif METHOD == 3
          confidence = 1.0 - abs(dpos - depth);
          if (confidence < 1.0 - minConfidence * 1.0) confidence = 0.0;

        #elif METHOD == 4
          // 1 - (x)^2 * 100
          confidence = 1.0 - abs(dpos - depth);

        #elif METHOD == 5
          confidence = 1.0 - abs(dpos - depth);
          confidence = pow(confidence, maskPower);

        #endif

        #ifndef BRANCHLOOP
         confidence *= step(vectorCutoff, dpos);
         confidence *= step(confidenceSum, confidenceCutoff);
        #endif

        #ifdef BRANCHSAMPLE
        if (confidence > 0.0) {
        #endif
          
          #ifdef CORRECT
            #define CORRECTION_MATH +( ( vec2((depth - dpos) / (dstep * correctPower)) * vstep ))
          #else
            #define CORRECTION_MATH
          #endif
            
          #ifdef COLORAVG    
            colSum += texture2D(uSampler, vpos CORRECTION_MATH) * confidence;
          #else
            posSum += (vpos CORRECTION_MATH) * confidence;    
          #endif
            confidenceSum += confidence;
            
        #ifdef BRANCHSAMPLE
        }
        #endif

        #if DEBUG > 0
        gl_FragColor = vec4(confidence, depth, dpos, 0);
        #endif

      #ifdef BRANCHLOOP
      }
      #endif

      dpos -= dstep;
      vpos -= vstep;
    };

  #if defined(COLORAVG) && DEBUG == 0
    gl_FragColor = colSum / vec4(confidenceSum);
  #elif !defined(COLORAVG) && DEBUG == 0
    gl_FragColor = texture2D(uSampler, posSum / confidenceSum);
  #endif

}