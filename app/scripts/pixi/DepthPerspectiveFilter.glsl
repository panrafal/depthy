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

#define METHOD 5
#define BRANCHLOOP  
#define BRANCHSAMPLE 
#define DEBUG 0
// #define DEBUGBREAK 15
#define CORRECT
// #define COLORAVG

const float maxSteps = 16.0;

const float perspective = -0.05;
const float upscale = 1.01;
// float steps = clamp( ceil( max(abs(offset.x), abs(offset.y)) * maxSteps ), 1.0, maxSteps);
float steps = maxSteps;

#ifdef COLORAVG
float maskPower = steps * 2.0;// 32.0;
#else 
float maskPower = steps * 1.0;// 32.0;
#endif
float correctPower = 1.0;//max(1.0, steps / 8.0);

const float compression = 0.8;
const float dmin = (1.0 - compression) / 2.0;
const float dmax = (1.0 + compression) / 2.0;

const float vectorCutoff = 0.0 + dmin - 0.0001;
const float confidenceCutoff = 0.2;

float aspect = dimensions.x / dimensions.y;
vec2 scale2 = vec2(scale * min(1.0, 1.0 / aspect), scale * min(1.0, aspect)) * vec2(1, -1) * vec2(2);
// mat2 baseVector = mat2(vec2(-focus * offset) * scale2, vec2(offset - focus * offset) * scale2);
mat2 baseVector = mat2(vec2((0.5 - focus) * offset - offset/2.0) * scale2, 
                       vec2((0.5 - focus) * offset + offset/2.0) * scale2);


void main(void) {

  vec2 pos = (vTextureCoord - vec2(0.5)) / vec2(upscale) + vec2(0.5);
  mat2 vector = baseVector;
  // perspective shift
  vector[1] += (vec2(2.0) * pos - vec2(1.0)) * vec2(perspective);
  
  float dstep = compression / (steps - 1.0);
  vec2 vstep = (vector[1] - vector[0]) / vec2((steps - 1.0)) ;
  
  #ifdef COLORAVG
    vec4 colSum = vec4(0.0);
  #else
    vec2 posSum = vec2(0.0);
  #endif

  float confidenceSum = 0.0;
  float minConfidence = dstep / 2.0;
    
  vec2 vpos = pos + vector[1];
  float dpos = 0.5 + compression / 2.0;
    
    
    for(float i = 1.0; i <= maxSteps; ++i) {
      #ifdef BRANCHLOOP
      if (dpos >= vectorCutoff && confidenceSum < confidenceCutoff) {
      #endif
        float depth = 1.0 - texture2D(displacementMap, vpos * vec2(1, -1) + vec2(0, 1)).r;
        depth = clamp(depth, dmin, dmax);
        float confidence;

        #if METHOD == 1
          confidence = step(dpos, depth - 0.0);

        #elif METHOD == 2
          confidence = 1.0 - abs(dpos - depth);
          if (confidence < 1.0 - minConfidence * 2.0) confidence = 0.0;

        #elif METHOD == 3
          confidence = 1.0 - abs(dpos - depth);
          if (confidence < 1.0 - minConfidence * 1.0) confidence = 0.0;

        #elif METHOD == 4
          confidence = (1.0 - abs(dpos - depth)) / steps;

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

        #if DEBUG > 2
          gl_FragColor = vec4(vector[0] / 2.0 + 1.0, vector[1].xy / 2.0 + 1.0);
        #elif DEBUG > 1
          gl_FragColor = vec4(confidenceSum, depth, dpos, 0);
        #elif DEBUG > 0
          gl_FragColor = vec4(confidence, depth, dpos, 0);
        #endif
        #ifdef DEBUGBREAK 
        if (i == float(DEBUGBREAK)) {
            dpos = 0.0;
        }     
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