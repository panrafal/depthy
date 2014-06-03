// Copyright (c) 2014 Rafał Lindemann. http://panrafal.github.com/depthy
precision mediump float;

varying vec2 vTextureCoord;
varying vec4 vColor;
uniform sampler2D displacementMap;
uniform sampler2D uSampler;
uniform vec4 dimensions;
uniform vec2 mapDimensions;
uniform float scale;
uniform vec2 offset;
uniform float focus;

#if !defined(QUALITY)

  #define METHOD 1
  #define CORRECT
//     #define COLORAVG
  #define ENLARGE 1.5
  #define ANTIALIAS 1
  #define AA_TRIGGER 0.8
  #define AA_POWER 1.0
  #define AA_MAXITER 8.0
  #define MAXSTEPS 16.0
  #define CONFIDENCE_MAX 2.5

#elif QUALITY == 2

  #define METHOD 1
  #define CORRECT
//     #define COLORAVG
  #define MAXSTEPS 4.0
  #define ENLARGE 0.8
//   #define ANTIALIAS 2
  #define CONFIDENCE_MAX 2.5

#elif QUALITY == 3

  #define METHOD 1
  #define CORRECT
//     #define COLORAVG
  #define MAXSTEPS 6.0
  #define ENLARGE 1.0
  #define ANTIALIAS 2
  #define CONFIDENCE_MAX 2.5

#elif QUALITY == 4

  #define METHOD 1
  #define CORRECT
//     #define COLORAVG
  #define MAXSTEPS 16.0
  #define ENLARGE 1.5
  #define ANTIALIAS 2
  #define CONFIDENCE_MAX 2.5

#elif QUALITY == 5

  #define METHOD 1
  #define CORRECT
  #define COLORAVG
  #define MAXSTEPS 40.0
  #define ENLARGE 1.5
//     #define ANTIALIAS 2
  #define AA_TRIGGER 0.8
  #define AA_POWER 1.0
  #define AA_MAXITER 8.0
  #define CONFIDENCE_MAX 4.5

#endif


#define BRANCHLOOP  
#define BRANCHSAMPLE 
#define DEBUG 0
// #define DEBUGBREAK 2

#ifndef METHOD
  #define METHOD 1
#endif
#ifndef MAXSTEPS
  #define MAXSTEPS 8.0
#endif
#ifndef ENLARGE
  #define ENLARGE 1.2
#endif
#ifndef PERSPECTIVE
  #define PERSPECTIVE 0.0
#endif
#ifndef UPSCALE
  #define UPSCALE 1.06
#endif
#ifndef CONFIDENCE_MAX
  #define CONFIDENCE_MAX 0.2
#endif
#ifndef COMPRESSION
  #define COMPRESSION 0.8
#endif

const float perspective = PERSPECTIVE;
const float upscale = UPSCALE;
// float steps = clamp( ceil( max(abs(offset.x), abs(offset.y)) * maxSteps ), 1.0, maxSteps);
float steps = MAXSTEPS;

#ifdef COLORAVG
float maskPower = steps * 2.0;// 32.0;
#else 
float maskPower = steps * 1.0;// 32.0;
#endif
float correctPower = 1.0;//max(1.0, steps / 8.0);

const float compression = COMPRESSION;
const float dmin = (1.0 - compression) / 2.0;
const float dmax = (1.0 + compression) / 2.0;

const float vectorCutoff = 0.0 + dmin - 0.0001;

float aspect = dimensions.x / dimensions.y;
vec2 scale2 = vec2(scale * min(1.0, 1.0 / aspect), scale * min(1.0, aspect)) * vec2(1, -1) * vec2(ENLARGE);
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
    
  #ifdef ANTIALIAS
    #ifndef AA_TRIGGER
      #define AA_TRIGGER 0.8
    #endif
    #if ANTIALIAS == 11 || ANTIALIAS == 12
      #ifndef AA_POWER
        #define AA_POWER 0.5
      #endif
      #ifndef AA_MAXITER
        #define AA_MAXITER 16.0
      #endif
      float loopStep = 1.0;
    #endif
    
    #define LOOP_INDEX j
    float j = 0.0;
  #endif

  #ifndef LOOP_INDEX
    #define LOOP_INDEX i
  #endif


  for(float i = 0.0; i < MAXSTEPS; ++i) {
    vec2 vpos = pos + vector[1] - LOOP_INDEX * vstep;
    float dpos = 0.5 + compression / 2.0 - LOOP_INDEX * dstep;
    #ifdef BRANCHLOOP
    if (dpos >= vectorCutoff && confidenceSum < CONFIDENCE_MAX) {
    #endif
      float depth = 1.0 - texture2D(displacementMap, vpos * vec2(1, -1) + vec2(0, 1)).r;
      depth = clamp(depth, dmin, dmax);
      float confidence;

      #if METHOD == 1
        confidence = step(dpos, depth + 0.001);

      #elif METHOD == 2
        confidence = 1.0 - abs(dpos - depth);
        if (confidence < 1.0 - minConfidence * 2.0) confidence = 0.0;

      #elif METHOD == 5
        confidence = 1.0 - abs(dpos - depth);
        confidence = pow(confidence, maskPower);

      #endif

      #ifndef BRANCHLOOP
       confidence *= step(vectorCutoff, dpos);
       confidence *= step(confidenceSum, CONFIDENCE_MAX);
      #endif
        
      #ifndef ANTIALIAS
      #elif ANTIALIAS == 1 // go back halfstep, go forward fullstep - branched
        if (confidence > AA_TRIGGER && i == j) {
          j -= 0.5;
        } else {
          j += 1.0;
        }
        // confidence *= CONFIDENCE_MAX / 3.0;

      #elif ANTIALIAS == 2 // go back halfstep, go forward fullstep - mult
        j += 1.0 + step(AA_TRIGGER, confidence) 
             * step(i, j) * -1.5; 
        // confidence *= CONFIDENCE_MAX / 3.0;

      #elif ANTIALIAS == 11
        if (confidence >= AA_TRIGGER && i == j && steps - i > 1.0) {
          loopStep = AA_POWER * 2.0 / min(AA_MAXITER, steps - i - 1.0);
          j -= AA_POWER + loopStep;
        }
        confidence *= loopStep;
        j += loopStep;
      #elif ANTIALIAS == 12
        float _if_aa = step(AA_TRIGGER, confidence)
                     * step(i, j)
                     * step(1.5, steps - i);
        loopStep = _if_aa * (AA_POWER * 2.0 / min(AA_MAXITER, max(0.1, steps - i - 1.0)) - 1.0) + 1.0;
        confidence *= loopStep;
        j += _if_aa * -(AA_POWER + loopStep) + loopStep;
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
  };

  #if defined(COLORAVG) && DEBUG == 0
    gl_FragColor = colSum / vec4(confidenceSum);
  #elif !defined(COLORAVG) && DEBUG == 0
    gl_FragColor = texture2D(uSampler, posSum / confidenceSum);
  #endif

}