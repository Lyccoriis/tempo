import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { rainbowPalette } from '@/lib/backdrop';
import type { WaveFeel } from './Dither';
import { useBackdropPointer } from './useBackdropPointer';
import { balatroFragmentShader } from './balatroShader';

export interface BalatroProps {
  spinRotation?: number;
  spinSpeed?: number;
  offset?: [number, number];
  color1?: string;
  color2?: string;
  color3?: string;
  contrast?: number;
  lighting?: number;
  spinAmount?: number;
  pixelFilter?: number;
  spinEase?: number;
  isRotate?: boolean;
  mouseInteraction?: boolean;
  mouseRadius?: number;
  distortionScale?: number;
  colorDrift?: number;
  rainbow?: boolean;
  feel?: (dt: number) => WaveFeel;
}
const QUIET: WaveFeel = { zoom: 0, glow: 0, crest: 0, depth: 0, drive: 1 };
const vertexShader = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export default function Balatro(props: BalatroProps) {
  const host = useRef<HTMLDivElement>(null);
  const pointer = useBackdropPointer(props.mouseInteraction !== false, host);
  const latest = useRef(props);
  latest.current = props;
  const wake = useRef(() => {});
  useEffect(() => {
    const element = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
    } catch { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none';
    element.appendChild(renderer.domElement);
    const u = {
      iTime: { value: 0 }, iResolution: { value: new THREE.Vector3(1, 1, 1) },
      uSpinRotation: { value: 0 }, uSpinSpeed: { value: 1 },
      uOffset: { value: new THREE.Vector2() },
      uColor1: { value: new THREE.Vector4() }, uColor2: { value: new THREE.Vector4() }, uColor3: { value: new THREE.Vector4() },
      uContrast: { value: 3 }, uLighting: { value: 0.18 },
      uSpinAmount: { value: 0.25 }, uPixelFilter: { value: 745 },
      uSpinEase: { value: 1 }, uIsRotate: { value: false },
      uPointer: { value: new THREE.Vector4(0, 0, 0, 0.18) }, uMouseInteraction: { value: false },
      uDistortionScale: { value: 22 }, uPalettePhase: { value: 0 }, uMusic: { value: new THREE.Vector3() },
    };
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader: balatroFragmentShader, uniforms: u, depthTest: false, depthWrite: false });
    const geometry = new THREE.PlaneGeometry(2, 2);
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.Camera();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const smooth = new THREE.Vector2();
    const target = new THREE.Vector2();
    const color = new THREE.Color();
    let frame = 0, last = 0, phase = 0, rotation = 0, energy = 0, hue = 0;
    let speed = latest.current.spinSpeed ?? 0.32;
    let activity = 1;
    let width = 1, height = 1, visible = true, lost = false, disposed = false, first = true;
    const render = (now: number) => {
      frame = 0;
      if (disposed || lost || document.hidden || !visible) return;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
      last = now;
      const p = latest.current;
      const m = motion.matches ? QUIET : p.feel?.(dt) ?? QUIET;
      speed += ((p.spinSpeed ?? 0.32) - speed) * (1 - Math.exp(-dt / 0.6));
      if (!motion.matches) {
        const drive = Math.min(2.5, Math.max(0.1, m.drive));
        phase += dt * speed * drive;
        const spin = p.spinRotation ?? -0.32;
        rotation += dt * spin * (speed * drive + Math.min(0.6, Math.max(0, m.depth)) * 10);
        u.uPalettePhase.value += dt * (p.colorDrift ?? 0.18) * drive;
        if (p.rainbow) hue = (hue + dt * speed * drive * 0.08) % 1;
      }
      u.iTime.value = phase;
      u.uSpinRotation.value = p.isRotate ? rotation : p.spinRotation ?? -2;
      u.uSpinEase.value = p.spinEase ?? 1;
      u.uOffset.value.set(...(p.offset ?? [0, 0]));
      u.uSpinAmount.value = p.spinAmount ?? 0.25;
      u.uContrast.value = Math.max(0.5, p.contrast ?? 3.5);
      u.uLighting.value = p.lighting ?? 0.18;
      u.uDistortionScale.value = p.distortionScale ?? 30;
      const audible = m.activity ?? 1;
      activity += (audible - activity) * (1 - Math.exp(-dt / (audible > activity ? 0.35 : 0.8)));
      const normalFilter = Math.max(1, p.pixelFilter ?? 745);
      u.uPixelFilter.value = normalFilter / (1 + (1 - activity) * 7);
      u.uMusic.value.set(m.zoom, m.glow, m.crest);
      const colors = [p.color1 ?? '#6142b8', p.color2 ?? '#9e83db', p.color3 ?? '#10101d'];
      const rainbow = p.rainbow ? rainbowPalette(hue) : null;
      const fade = first || motion.matches ? 1 : 1 - Math.exp(-dt / 0.8);
      [u.uColor1, u.uColor2, u.uColor3].forEach((uniform, i) => {
        if (rainbow && i < 2) color.setRGB(...rainbow[i]);
        else color.setStyle(colors[i], THREE.LinearSRGBColorSpace);
        uniform.value.x += (color.r - uniform.value.x) * fade;
        uniform.value.y += (color.g - uniform.value.y) * fade;
        uniform.value.z += (color.b - uniform.value.z) * fade;
        uniform.value.w = 1;
      });
      const interactive = p.mouseInteraction !== false && !motion.matches;
      u.uMouseInteraction.value = interactive;
      if (interactive) {
        const input = pointer.current;
        const diagonal = Math.hypot(width, height);
        if (input.inside) target.set((input.x - 0.5) * width / diagonal, (input.y - 0.5) * height / diagonal);
        const distance = smooth.distanceTo(target);
        smooth.lerp(target, 1 - Math.exp(-dt / 0.24));
        const impulse = input.inside ? Math.min(1, distance * 16) : 0;
        energy += (impulse - energy) * (1 - Math.exp(-dt / (impulse > energy ? 0.18 : 0.85)));
        u.uPointer.value.set(smooth.x, smooth.y, energy, Math.max(0.01, p.mouseRadius ?? 0.18));
      } else if (energy !== 0) {
        energy = 0;
        smooth.set(0, 0);
        target.set(0, 0);
        u.uPointer.value.z = 0;
      }
      renderer.render(scene, camera);
      first = false;
      if (!motion.matches) frame = requestAnimationFrame(render);
    };
    const request = () => { if (!frame && !disposed) frame = requestAnimationFrame(render); };
    wake.current = request;
    const resize = () => {
      const rect = element.getBoundingClientRect();
      width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      u.iResolution.value.set(renderer.domElement.width, renderer.domElement.height, width / height);
      request();
    };
    const visibility = () => { last = 0; request(); };
    const contextLost = (event: Event) => { event.preventDefault(); lost = true; };
    const restored = () => { lost = false; visibility(); };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; visibility(); });
    intersection.observe(element);
    document.addEventListener('visibilitychange', visibility);
    motion.addEventListener('change', visibility);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    renderer.domElement.addEventListener('webglcontextrestored', restored);
    resize();
    return () => {
      disposed = true;
      wake.current = () => {};
      cancelAnimationFrame(frame);
      observer.disconnect(); intersection.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', visibility);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', restored);
      geometry.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [pointer]);
  useEffect(() => { wake.current(); });
  return <div ref={host} className="balatro-container" style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', pointerEvents: 'none', background: props.color3 ?? '#10101d' }} />;
}
