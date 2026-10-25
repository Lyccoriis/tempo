import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, wrapEffect } from '@react-three/postprocessing';
import { Effect } from 'postprocessing';
import * as THREE from 'three';
import { rainbowPalette } from '@/lib/backdrop';

type Rgb = [number, number, number];

export interface WaveFeel {
  zoom: number;
  glow: number;
  crest: number;
  depth: number;
  drive: number;
}

const waveVertexShader = `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  gl_Position = projectionMatrix * viewPosition;
}
`;

const waveFragmentShader = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float waveSpeed;
uniform float waveFrequency;
uniform float waveAmplitude;
uniform vec3 waveColor;
uniform vec3 accentColor;
uniform vec3 glowColor;
uniform vec3 backgroundColor;
uniform float zoom;
uniform float glow;
uniform float crest;
uniform float drift;

vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0,0.0,1.0,1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0,0.0,1.0,1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

const int OCTAVES = 4;
float fbm(vec2 p) {
  float value = 0.0;
  float amp = 1.0;
  float freq = waveFrequency;
  for (int i = 0; i < OCTAVES; i++) {
    value += amp * abs(cnoise(p));
    p *= freq;
    amp *= waveAmplitude;
  }
  return value;
}

float pattern(vec2 p) {
  vec2 p2 = p - time * waveSpeed;
  return fbm(p + fbm(p2));
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  uv -= 0.5;
  uv.x *= resolution.x / resolution.y;
  uv *= 1.0 - zoom;
  float f = pattern(uv) * (1.0 + glow);
  float blend = smoothstep(-0.7, 0.7, cnoise(uv * 0.8 + time * drift));
  vec3 wave = mix(waveColor, accentColor, blend);
  vec3 col = mix(backgroundColor, wave, clamp(f, 0.0, 1.0));
  col = mix(col, glowColor, smoothstep(0.6, 1.05, f) * crest);
  gl_FragColor = vec4(col, 1.0);
}
`;

const ditherFragmentShader = `
precision highp float;
uniform float colorNum;
uniform float pixelSize;
const float bayerMatrix8x8[64] = float[64](
  0.0/64.0, 48.0/64.0, 12.0/64.0, 60.0/64.0,  3.0/64.0, 51.0/64.0, 15.0/64.0, 63.0/64.0,
  32.0/64.0,16.0/64.0, 44.0/64.0, 28.0/64.0, 35.0/64.0,19.0/64.0, 47.0/64.0, 31.0/64.0,
  8.0/64.0, 56.0/64.0,  4.0/64.0, 52.0/64.0, 11.0/64.0,59.0/64.0,  7.0/64.0, 55.0/64.0,
  40.0/64.0,24.0/64.0, 36.0/64.0, 20.0/64.0, 43.0/64.0,27.0/64.0, 39.0/64.0, 23.0/64.0,
  2.0/64.0, 50.0/64.0, 14.0/64.0, 62.0/64.0,  1.0/64.0,49.0/64.0, 13.0/64.0, 61.0/64.0,
  34.0/64.0,18.0/64.0, 46.0/64.0, 30.0/64.0, 33.0/64.0,17.0/64.0, 45.0/64.0, 29.0/64.0,
  10.0/64.0,58.0/64.0,  6.0/64.0, 54.0/64.0,  9.0/64.0,57.0/64.0,  5.0/64.0, 53.0/64.0,
  42.0/64.0,26.0/64.0, 38.0/64.0, 22.0/64.0, 41.0/64.0,25.0/64.0, 37.0/64.0, 21.0/64.0
);

vec3 dither(vec2 uv, vec3 color) {
  vec2 scaledCoord = floor(uv * resolution / pixelSize);
  int x = int(mod(scaledCoord.x, 8.0));
  int y = int(mod(scaledCoord.y, 8.0));
  float threshold = bayerMatrix8x8[y * 8 + x] - 0.25;
  float step = 1.0 / (colorNum - 1.0);
  color += threshold * step;
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float bias = mix(0.2, 0.0, smoothstep(0.45, 0.8, luminance));
  color = clamp(color - bias, 0.0, 1.0);
  return floor(color * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
}

void mainImage(in vec4 inputColor, in vec2 uv, out vec4 outputColor) {
  vec2 normalizedPixelSize = pixelSize / resolution;
  vec2 uvPixel = normalizedPixelSize * floor(uv / normalizedPixelSize);
  vec4 color = texture2D(inputBuffer, uvPixel);
  color.rgb = dither(uv, color.rgb);
  outputColor = color;
}
`;

class RetroEffectImpl extends Effect {
  constructor() {
    const uniforms = new Map<string, THREE.Uniform<number>>([
      ['colorNum', new THREE.Uniform(4.0)],
      ['pixelSize', new THREE.Uniform(2.0)],
    ]);
    super('RetroEffect', ditherFragmentShader, { uniforms });
  }
  set colorNum(v: number) {
    this.uniforms.get('colorNum')!.value = v;
  }
  get colorNum() {
    return this.uniforms.get('colorNum')!.value as number;
  }
  set pixelSize(v: number) {
    this.uniforms.get('pixelSize')!.value = v;
  }
  get pixelSize() {
    return this.uniforms.get('pixelSize')!.value as number;
  }
}

const RetroEffect = wrapEffect(RetroEffectImpl) as unknown as (props: {
  colorNum: number;
  pixelSize: number;
}) => React.JSX.Element;

const QUIET: WaveFeel = { zoom: 0, glow: 0, crest: 0, depth: 0, drive: 1 };

function easeColor(c: THREE.Color, to: Rgb, fade: number) {
  c.setRGB(c.r + (to[0] - c.r) * fade, c.g + (to[1] - c.g) * fade, c.b + (to[2] - c.b) * fade);
}

interface WavesProps {
  waveSpeed: number;
  waveFrequency: number;
  waveAmplitude: number;
  waveColor: Rgb;
  accentColor: Rgb;
  glowColor: Rgb;
  backgroundColor: Rgb;
  colorNum: number;
  pixelSize: number;
  colorDrift: number;
  rainbow: boolean;
  disableAnimation: boolean;
  feel?: (dt: number) => WaveFeel;
}

function DitheredWaves({
  waveSpeed,
  waveFrequency,
  waveAmplitude,
  waveColor,
  accentColor,
  glowColor,
  backgroundColor,
  colorNum,
  pixelSize,
  colorDrift,
  rainbow,
  disableAnimation,
  feel,
}: WavesProps) {
  const { viewport, size, gl } = useThree();

  const waveUniformsRef = useRef({
    time: new THREE.Uniform(0),
    resolution: new THREE.Uniform(new THREE.Vector2(0, 0)),
    waveSpeed: new THREE.Uniform(waveSpeed),
    waveFrequency: new THREE.Uniform(waveFrequency),
    waveAmplitude: new THREE.Uniform(waveAmplitude),
    waveColor: new THREE.Uniform(new THREE.Color(...waveColor)),
    accentColor: new THREE.Uniform(new THREE.Color(...accentColor)),
    glowColor: new THREE.Uniform(new THREE.Color(...glowColor)),
    backgroundColor: new THREE.Uniform(new THREE.Color(...backgroundColor)),
    zoom: new THREE.Uniform(0),
    glow: new THREE.Uniform(0),
    crest: new THREE.Uniform(0),
    drift: new THREE.Uniform(colorDrift),
  });

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: waveVertexShader,
        fragmentShader: waveFragmentShader,
        uniforms: waveUniformsRef.current,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    const dpr = gl.getPixelRatio();
    const w = Math.floor(size.width * dpr);
    const h = Math.floor(size.height * dpr);
    const res = waveUniformsRef.current.resolution.value;
    if (res.x !== w || res.y !== h) res.set(w, h);
  }, [size, gl]);

  const prevBackgroundColor = useRef([...backgroundColor]);
  const phase = useRef(0);
  const speed = useRef(waveSpeed);
  const hue = useRef(0);
  useFrame((_state, delta) => {
    const u = waveUniformsRef.current;
    const dt = Math.min(delta, 0.1);
    const m = feel?.(dt) ?? QUIET;
    speed.current += (waveSpeed - speed.current) * (1 - Math.exp(-dt / 0.6));
    if (!disableAnimation) phase.current += dt * speed.current * m.drive;
    u.time.value = phase.current;
    u.waveSpeed.value = 1;
    if (u.waveFrequency.value !== waveFrequency) u.waveFrequency.value = waveFrequency;
    u.waveAmplitude.value = waveAmplitude + m.depth;
    u.zoom.value = m.zoom;
    u.glow.value = m.glow;
    u.crest.value = m.crest;
    u.drift.value = colorDrift;
    if (rainbow && !disableAnimation) hue.current = (hue.current + dt * speed.current * m.drive) % 1;
    const colors = rainbow ? rainbowPalette(hue.current) : [waveColor, accentColor, glowColor];
    const fade = 1 - Math.exp(-dt / (rainbow ? 0.15 : 0.8));
    easeColor(u.waveColor.value, colors[0], fade);
    easeColor(u.accentColor.value, colors[1], fade);
    easeColor(u.glowColor.value, colors[2], fade);
    if (!prevBackgroundColor.current.every((v, i) => v === backgroundColor[i])) {
      u.backgroundColor.value.setRGB(...backgroundColor);
      prevBackgroundColor.current = [...backgroundColor];
    }
  });

  return (
    <>
      <mesh scale={[viewport.width, viewport.height, 1]}>
        <planeGeometry args={[1, 1]} />
        <primitive object={material} attach="material" />
      </mesh>

      <EffectComposer>
        <RetroEffect colorNum={colorNum} pixelSize={pixelSize} />
      </EffectComposer>
    </>
  );
}

export interface DitherProps {
  waveSpeed?: number;
  waveFrequency?: number;
  waveAmplitude?: number;
  waveColor?: Rgb;
  accentColor?: Rgb;
  glowColor?: Rgb;
  backgroundColor?: Rgb;
  colorNum?: number;
  pixelSize?: number;
  disableAnimation?: boolean;
  colorDrift?: number;
  rainbow?: boolean;
  feel?: (dt: number) => WaveFeel;
  paused?: boolean;
}

export default function Dither({
  waveSpeed = 0.05,
  waveFrequency = 3,
  waveAmplitude = 0.3,
  waveColor = [0.5, 0.5, 0.5],
  accentColor,
  glowColor,
  backgroundColor = [0, 0, 0],
  colorNum = 4,
  pixelSize = 2,
  colorDrift = 1.5,
  rainbow = false,
  disableAnimation = false,
  feel,
  paused = false,
}: DitherProps) {
  return (
    <Canvas
      className="dither-container"
      camera={{ position: [0, 0, 6] }}
      dpr={1}
      frameloop={paused ? 'never' : 'always'}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <DitheredWaves
        waveSpeed={waveSpeed}
        waveFrequency={waveFrequency}
        waveAmplitude={waveAmplitude}
        waveColor={waveColor}
        accentColor={accentColor ?? waveColor}
        glowColor={glowColor ?? waveColor}
        backgroundColor={backgroundColor}
        colorNum={colorNum}
        pixelSize={pixelSize}
        colorDrift={colorDrift}
        rainbow={rainbow}
        disableAnimation={disableAnimation}
        feel={feel}
      />
    </Canvas>
  );
}
