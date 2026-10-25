import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useBackdropPointer } from './useBackdropPointer';
import { rainbowPalette } from '@/lib/backdrop';
import { fragmentShader, vertexShader, backgroundVertexShader, backgroundFragmentShader } from './asciiDitherShaders';

type Rgb = [number, number, number];
export interface WaveFeel {
  zoom: number;
  glow: number;
  crest: number;
  depth: number;
  drive: number;
  activity?: number;
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
  enableMouseInteraction?: boolean;
  mouseRadius?: number;
}

const QUIET: WaveFeel = { zoom: 0, glow: 0, crest: 0, depth: 0, drive: 1 };
const GRAY: Rgb = [0.5, 0.5, 0.5];
const BLACK: Rgb = [0, 0, 0];
const GLYPHS = " .·':-=+*#%@/\\|~";
const clamp = THREE.MathUtils.clamp;

function atlas() {
  const canvas = document.createElement('canvas');
  canvas.width = 32 * GLYPHS.length;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.font = '900 29px monospace';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [...GLYPHS].forEach((char, i) => {
    ctx.strokeText(char, i * 32 + 16, 17);
    ctx.fillText(char, i * 32 + 16, 17);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function sheet(columns: number) {
  const rows = Math.round(columns * 0.62);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0,0, 1,0, 1,1, 0,1], 2));
  geometry.setIndex([0,1,2, 0,2,3]);
  const samples = new Float32Array(columns * rows * 2);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const i = (y * columns + x) * 2;
      samples[i] = (x / (columns - 1) - 0.5) * 15;
      samples[i + 1] = (y / (rows - 1) - 0.5) * 9;
    }
  }
  geometry.setAttribute('samplePoint', new THREE.InstancedBufferAttribute(samples, 2));
  geometry.instanceCount = columns * rows;
  return geometry;
}

function palette(rgb: Rgb) {
  const color = new THREE.Color(...rgb);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  const hue = hsl.s < 0.08 ? 0.66 : hsl.h;
  const light = clamp(hsl.l, 0.18, 0.65);
  return [
    hsl.s >= 0.08 ? color : new THREE.Color().setHSL(hue, 0.78, light),
    new THREE.Color().setHSL((hue + 0.1) % 1, 0.82, light * 0.8),
    new THREE.Color().setHSL((hue + 0.91) % 1, 0.85, 0.7),
  ].map(c => c.convertSRGBToLinear());
}

export default function Dither(props: DitherProps) {
  const host = useRef<HTMLDivElement>(null);
  const pointer = useBackdropPointer(props.enableMouseInteraction !== false, host);
  const latest = useRef(props);
  latest.current = props;
  const wake = useRef<() => void>(() => {});

  useEffect(() => {
    const element = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: false, antialias: false, powerPreference: 'low-power' });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    element.appendChild(renderer.domElement);
    const glyphs = atlas();
    const uniforms = {
      time: { value: 7.0 }, frequency: { value: 3 }, amplitude: { value: 0.3 },
      levels: { value: 4 }, spacing: { value: 0.06 }, drift: { value: 1.5 },
      aspect: { value: 1 }, resolution: { value: new THREE.Vector2(1, 1) },
      cellSize: { value: 3 },
      music: { value: new THREE.Vector4() },
      pointer: { value: new THREE.Vector4(0, 0, 0, 1) },
      primary: { value: new THREE.Color() }, secondary: { value: new THREE.Color() },
      highlight: { value: new THREE.Color() }, background: { value: new THREE.Color() },
      glyphs: { value: glyphs },
    };
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, side: THREE.DoubleSide, transparent: true });
    const scene = new THREE.Scene();
    const backgroundMaterial = new THREE.ShaderMaterial({
      vertexShader: backgroundVertexShader, fragmentShader: backgroundFragmentShader,
      uniforms, depthTest: false, depthWrite: false,
    });
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backgroundMaterial);
    backdrop.frustumCulled = false;
    backdrop.renderOrder = -1;
    scene.add(backdrop);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 50);
    camera.position.set(0, 0, 13.5);
    let columns = 240;
    const mesh = new THREE.Mesh(sheet(columns), material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true, disposed = false, contextLost = false;
    let frame = 0, last = 0, width = 1, height = 1;
    let speed = latest.current.waveSpeed ?? 0.05;
    let previousBase: Rgb | undefined;
    let previousAccent: Rgb | undefined;
    let previousGlow: Rgb | undefined;
    let colors = palette(GRAY);
    let first = true;
    const target = new THREE.Vector2();
    const smoothed = new THREE.Vector2();
    const previous = new THREE.Vector2();
    let energy = 0;
    let hue = 0;

    const render = (now: number) => {
      frame = 0;
      if (disposed || contextLost || document.hidden || !visible) return;
      const p = latest.current;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
      last = now;
      const frozen = p.disableAnimation || motion.matches || p.paused;
      const m = frozen ? QUIET : p.feel?.(dt) ?? QUIET;
      const u = uniforms;
      speed += ((p.waveSpeed ?? 0.05) - speed) * (1 - Math.exp(-dt / 0.6));
      if (!frozen) u.time.value += dt * speed * 5 * m.drive;
      u.frequency.value = clamp(p.waveFrequency ?? 3, 0, 12);
      u.amplitude.value = clamp((p.waveAmplitude ?? 0.3) + m.depth, 0, 2);
      u.levels.value = clamp(p.colorNum ?? 4, 2, 64);
      u.drift.value = p.colorDrift ?? 1.5;
      u.cellSize.value = Math.max(0.5, p.pixelSize ?? 2);
      u.music.value.set(m.zoom, m.glow, m.crest, m.depth);
      const desiredColumns = Math.round(clamp(width / (Math.max(0.5, p.pixelSize ?? 2) * 1.7), 90, 420));
      if (desiredColumns !== columns) {
        columns = desiredColumns;
        mesh.geometry.dispose();
        mesh.geometry = sheet(columns);
      }
      u.spacing.value = 15 / columns;
      const base = p.waveColor ?? GRAY;
      if (p.rainbow) {
        if (!frozen) hue = (hue + dt * speed * m.drive) % 1;
        rainbowPalette(hue).forEach((rgb, i) => colors[i].setRGB(...rgb).convertSRGBToLinear());
        previousBase = undefined;
      } else if (base !== previousBase || p.accentColor !== previousAccent || p.glowColor !== previousGlow) {
        colors = palette(base);
        if (p.accentColor) colors[1].setRGB(...p.accentColor).convertSRGBToLinear();
        if (p.glowColor) colors[2].setRGB(...p.glowColor).convertSRGBToLinear();
        previousBase = base;
        previousAccent = p.accentColor;
        previousGlow = p.glowColor;
      }
      const fade = first || frozen ? 1 : 1 - Math.exp(-dt / (p.rainbow ? 0.15 : 0.8));
      u.primary.value.lerp(colors[0], fade);
      u.secondary.value.lerp(colors[1], fade);
      u.highlight.value.lerp(colors[2], fade);
      u.background.value.setRGB(...(p.backgroundColor ?? BLACK)).convertSRGBToLinear();
      renderer.setClearColor(u.background.value);
      if (!frozen && p.enableMouseInteraction !== false) {
        const input = pointer.current;
        if (input.inside) target.set((input.x - 0.5) * 15, (input.y - 0.5) * 9);
        previous.copy(smoothed);
        smoothed.lerp(target, 1 - Math.exp(-dt / 0.22));
        const velocity = smoothed.distanceTo(previous) / dt;
        energy += ((input.inside ? Math.min(velocity * 0.35 + 0.12, 1) : 0) - energy) * (1 - Math.exp(-dt / 0.8));
        u.pointer.value.set(smoothed.x, smoothed.y, energy, Math.max(0.001, p.mouseRadius ?? 1));
      } else if (energy !== 0) {
        energy = 0;
        smoothed.set(0, 0);
        target.set(0, 0);
        u.pointer.value.z = 0;
      }
      const t = u.time.value;
      camera.position.set(Math.sin(t * 0.13) * 0.18, Math.cos(t * 0.17) * 0.12, 13.5 - m.zoom * 4);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      first = false;
      if (!frozen) frame = requestAnimationFrame(render);
    };
    const request = () => {
      if (!frame && !disposed) frame = requestAnimationFrame(render);
    };
    wake.current = request;
    const resize = () => {
      const rect = element.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      uniforms.aspect.value = camera.aspect;
      uniforms.resolution.value.set(width, height);
      camera.updateProjectionMatrix();
      request();
    };
    const visibility = () => { last = 0; request(); };
    const lost = (event: Event) => { event.preventDefault(); contextLost = true; };
    const restored = () => { contextLost = false; last = 0; request(); };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    const intersection = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      last = 0;
      if (visible) request();
    });
    intersection.observe(element);
    document.addEventListener('visibilitychange', visibility);
    motion.addEventListener('change', visibility);
    renderer.domElement.addEventListener('webglcontextlost', lost);
    renderer.domElement.addEventListener('webglcontextrestored', restored);
    resize();
    return () => {
      disposed = true;
      wake.current = () => {};
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', visibility);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      renderer.domElement.removeEventListener('webglcontextrestored', restored);
      mesh.geometry.dispose();
      backdrop.geometry.dispose();
      backgroundMaterial.dispose();
      material.dispose();
      glyphs.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [pointer]);

  useEffect(() => { wake.current(); });
  const background = props.backgroundColor ?? BLACK;
  return <div ref={host} className="dither-container" style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', backgroundColor: `rgb(${background.map(v => Math.round(clamp(v, 0, 1) * 255)).join(',')})` }} />;
}
