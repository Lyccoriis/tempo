export const vertexShader = `
precision highp float;
#include <colorspace_pars_fragment>
attribute vec2 samplePoint;
uniform float time, frequency, amplitude, spacing, levels, drift;
uniform float aspect;
uniform vec4 music, pointer;
uniform vec3 primary, secondary, highlight;
varying vec2 vUv;
varying vec3 vColor;
varying float vGlyph, vLight, vFog, vEdge;

vec3 surface(vec2 q) {
  float t = time;
  float f = frequency / 3.0;
  // A shared phrase modulates the carrier and its harmonics. Phase offsets
  // create a build, a travelling crest and a long release.
  float phrase = sin(t * .217 + .65 * sin(t * .097));
  float breath = .5 + .5 * phrase;
  float bass = sin(q.x * .65 * f - t * .71 + phrase * .4);
  float mid = sin(q.y * 1.1 * f + q.x * .38 - t * .93);
  float curl = q.y * .53 + .9 * sin(q.x * .4 * f + t * .31);
  float fold = sin(q.x * .79 * f + q.y * .48 + t * .42 + mid * .55);
  float a = amplitude / .3;
  vec3 p = vec3(q.x + .45 * a * sin(curl + t * .23),
    q.y * .68 + a * (.6 * bass + .35 * mid),
    a * (1.2 * fold + .65 * cos(curl * 1.7 - t * .29) + .4 * breath * bass));
  // Fold the cross-section back on itself. A fixed tilt reveals both sides.
  p.y += a * .8 * sin(curl * 1.8 + phrase);
  p.z += a * .6 * sin(q.y * 1.3 + fold + t * .33);
  float ring = length(q - vec2(2.0 * sin(t * .11), cos(t * .157)));
  float event = pow(.5 + .5 * sin(t * .193 + sin(t * .071)), 7.0);
  p.z += a * event * .55 * sin(ring * 2.2 - t * 1.2) * exp(-ring * .2);
  float d = length(q - pointer.xy);
  float wake = exp(-d * d / max(.01, pointer.w * pointer.w * 3.0)) * pointer.z;
  p.z += wake * (.6 * sin(d * 3.0 - t * 2.0) - .7);
  p.xy += wake * vec2(q.y - pointer.y, pointer.x - q.x) * .16;
  float tilt = .42 + .18 * sin((t - 7.0) * .11);
  p.yz = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * p.yz;
  // Integrated time already follows waveSpeed and music drive, so changing
  // speed accelerates rotation smoothly without jumping to another angle.
  float turn = .21 + (t - 7.0) * .22;
  p.xy = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * p.xy;
  p.xy *= max(1.3, aspect * .9);
  return p;
}

float bayer(vec2 cell) {
  vec2 a = mod(cell, 2.0);
  vec2 b = mod(floor(cell / 2.0), 2.0);
  return (4.0 * (2.0 * a.x + 3.0 * a.y - 4.0 * a.x * a.y)
    + 2.0 * b.x + 3.0 * b.y - 4.0 * b.x * b.y) / 16.0 - .5;
}

void main() {
  vec2 q = samplePoint;
  vec3 p = surface(q);
  vec3 dx = surface(q + vec2(.025, 0.0)) - p;
  vec3 dy = surface(q + vec2(0.0, .025)) - p;
  vec3 n = normalize(cross(dx, dy));
  float light = abs(dot(n, normalize(vec3(-.45, .7, 1.0))));
  float ridge = pow(light, 5.0);
  float flow = .5 + .5 * sin(q.x * .56 + q.y * .83 - time * .67 + p.z * .65);
  float breath = .5 + .5 * sin(time * .217 + .65 * sin(time * .097) - .45);
  // Keep valleys legible too; the application already dims the whole backdrop.
  float energy = (.25 + .53 * light + .25 * ridge) * (.8 + .2 * flow);
  energy *= .85 + .18 * breath + music.y;
  float threshold = bayer(floor((q + vec2(7.5, 4.5)) / spacing));
  float density = clamp(energy + threshold * .065, 0.0, 1.0);
  // Coverage comes from substantial ink, not ever more tiny sparse samples.
  vGlyph = clamp(floor(6.0 + density * 5.0), 6.0, 11.0);
  // Directional glyphs follow steep folds; dense crests use luminance glyphs.
  if (density < .28 && abs(n.x) > .65)
    vGlyph = n.x * n.y > 0.0 ? 12.0 : 13.0;
  float chroma = .5 + .5 * sin(p.z * .9 + n.y * 2.0 + time * .12 * drift);
  vec3 color = mix(secondary, primary, chroma);
  color = mix(color, highlight, clamp(pow(light, 8.0) * (.15 + .2 * flow + music.z * .4), 0.0, .6));
  color = mix(color, vec3(.88, .96, 1.0), pow(ridge * flow, 7.0) * .08);
  float steps = max(1.0, levels - 1.0);
  // Stable ordered thresholds belong to each material sample, not the screen.
  // Quantize display RGB, then return to linear light for correct blending.
  vec3 displayColor = sRGBTransferOETF(vec4(color, 1.0)).rgb;
  vColor = sRGBTransferEOTF(vec4(clamp(floor(displayColor * steps + .5 + threshold * .45) / steps, 0.0, 1.0), 1.0)).rgb;
  vLight = energy;
  vEdge = smoothstep(0.0, 1.1, 4.5 - abs(q.y)) * smoothstep(0.0, 1.4, 7.5 - abs(q.x));
  vec4 view = modelViewMatrix * vec4(p, 1.0);
  vFog = exp(-max(0.0, -view.z - 9.0) * .065);
  // Perspective gives nearer glyphs a larger footprint independent of DPR.
  view.xy += position.xy * spacing * vec2(.7, .85) * max(1.3, aspect * .9);
  gl_Position = projectionMatrix * view;
  vUv = uv;
}
`;

export const fragmentShader = `
precision highp float;
uniform sampler2D glyphs;
uniform vec3 background;
varying vec2 vUv;
varying vec3 vColor;
varying float vGlyph, vLight, vFog, vEdge;
float ink(vec2 uv) {
  // Crop unused font side bearings, so ink actually occupies the glyph cell.
  uv = (uv - .5) * vec2(.64, .88) + .5;
  return texture2D(glyphs, vec2((vGlyph + clamp(uv.x, .035, .965)) / 16.0, clamp(uv.y, .035, .965))).a;
}
void main() {
  float sharp = ink(vUv);
  // Separate the emitted color channels while retaining the sharp central ink.
  float split = .065 + .065 * smoothstep(.3, .9, vLight);
  float red = ink(vUv + vec2(split, .015));
  float blue = ink(vUv - vec2(split, .015));
  float halo = (ink(vUv + vec2(.04,0.0)) + ink(vUv - vec2(.04,0.0))
    + ink(vUv + vec2(0.0,.04)) + ink(vUv - vec2(0.0,.04))) * .25;
  float bright = smoothstep(.62, .95, vLight);
  float mask = max(sharp, max(red, blue)) + halo * bright * .18;
  if (mask * vEdge < .035) discard;
  vec3 fringes = vec3(1.0, .04, .4) * max(0.0, red - sharp) + vec3(.02, .75, 1.0) * max(0.0, blue - sharp);
  vec3 emitted = (vColor * sharp + fringes * .15 * bright + vColor * halo * bright * .18)
    * (vLight * 2.15 + .25) * vFog / max(mask, .001);
  gl_FragColor = vec4(emitted, clamp(mask * vEdge, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;

export const backgroundVertexShader = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }
`;

export const backgroundFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform float time, frequency, levels, cellSize, aspect, drift;
uniform vec2 resolution;
uniform vec3 primary, secondary, highlight, background;
uniform vec4 music;
float field(vec2 p) {
  float t = time;
  float f = max(.25, frequency / 3.0);
  float bend = sin(p.y * 1.5 * f + t * .27) + .5 * sin(p.x * 1.1 * f - t * .19);
  return .5 + .5 * sin(p.x * 1.9 * f + p.y * .8 + bend * 1.7 - t * .43);
}
float bayer(vec2 cell) {
  vec2 a = mod(cell, 2.0), b = mod(floor(cell / 2.0), 2.0);
  return (4.0 * (2.0*a.x + 3.0*a.y - 4.0*a.x*a.y)
    + 2.0*b.x + 3.0*b.y - 4.0*b.x*b.y) / 16.0;
}
void main() {
  vec2 cell = floor(vUv * resolution / cellSize);
  vec2 p = ((cell + .5) * cellSize / resolution - .5) * vec2(aspect, 1.0) * 5.0;
  float angle = (time - 7.0) * .055;
  p = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p;
  float wave = field(p);
  float separation = .075 + .035 * wave;
  vec3 channels = vec3(field(p + vec2(separation, 0.0)), wave, field(p - vec2(separation, 0.0)));
  vec3 color = mix(secondary, primary, .5 + .5 * sin(p.y * .8 + wave * 2.0 + time * .07 * drift));
  color = mix(color, highlight, pow(wave, 8.0) * .08);
  float steps = max(1.0, levels - 1.0);
  // Quantize the final palette-colored signal, like Classic Dither. There is
  // no constant colored floor: valleys return to the configured background.
  vec3 displayColor = sRGBTransferOETF(vec4(color, 1.0)).rgb;
  vec3 signal = displayColor * channels * (1.05 + music.y * .35);
  vec3 quantized = clamp(floor(signal * steps + bayer(cell)) / steps, 0.0, 1.0);
  vec3 light = sRGBTransferEOTF(vec4(quantized, 1.0)).rgb;
  gl_FragColor = vec4(background + light * (vec3(1.0) - background), 1.0);
  #include <colorspace_fragment>
}
`;
