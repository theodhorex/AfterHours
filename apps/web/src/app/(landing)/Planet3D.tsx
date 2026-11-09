"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type * as T from "three";
import { LOOKS } from "./looks.ts";

const SNOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

const VERT = /* glsl */ `
varying vec3 vP; varying vec3 vN;
void main(){ vP = position; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;

const PLANET_FRAG = /* glsl */ `
precision highp float;
varying vec3 vP; varying vec3 vN;
uniform vec3 uDeep, uShallow, uLow, uMid, uHigh, uPeak, uVeinCol, uGlow, uAtmo, uSeed, uLight;
uniform float uSea, uMtn, uStrata, uVein, uCloud, uTime, uBump;
${SNOISE}

float continents(vec3 p){
  vec3 q = p*1.15 + uSeed;
  vec3 w = vec3(snoise(q*.8), snoise(q*.8+vec3(5.2,1.3,8.1)), snoise(q*.8+vec3(2.7,9.4,3.3)));
  q += w*.32;
  float c = 0., a = .5; vec3 s = q;
  for(int i=0;i<5;i++){ c += a*snoise(s); s = s*2.03 + 1.7; a *= .5; }
  return c;
}
float cloudField(vec3 p){
  vec3 z = p*vec3(1.5, 4.4, 1.5);
  float c = snoise(z*1.6 + uSeed*.4)*.55 + snoise(z*3.4 + 4.)*.3 + snoise(z*7.)*.15;
  return smoothstep(.22, .78, c + (uCloud-.5)*.5);
}
vec3 rotY(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z); }

void main(){
  vec3 p = normalize(vP);
  vec3 Ng = normalize(vN);
  vec3 L = normalize(uLight);
  float ndlG = dot(Ng, L);
  float day = smoothstep(-.14, .3, ndlG);

  float c = continents(p);
  float e = c - uSea;
  vec3 qm = p*3.0 + uSeed*1.3;
  float n1 = snoise(qm); float n2 = snoise(qm*2.4 + 3.);
  float r1 = 1. - sqrt(n1*n1 + .02); r1 = max(r1, 0.); r1 *= r1;
  float r2 = 1. - sqrt(n2*n2 + .02); r2 = max(r2, 0.); r2 *= r2;
  float mount = (r1*.65 + r2*.35) * smoothstep(.02, .42, e) * uMtn;
  float H = e + mount*.5;
  float land = smoothstep(-.004, .006, e);

  // relief from the screen-space slope of the height field
  vec3 N = normalize(Ng + vec3(-dFdx(H), -dFdy(H), 0.) * uBump);

  float lat = abs(p.y);
  float depth = clamp(-e*3.0, 0., 1.);
  vec3 ocean = mix(uShallow, uDeep, smoothstep(0., .85, depth));
  float shore = smoothstep(0., .05, -e);
  ocean = mix(uShallow*1.45 + .05, ocean, shore);

  float t = clamp(e/.55, 0., 1.);
  vec3 g = mix(uLow, uMid, smoothstep(0., .35, t + snoise(p*7.)*.06));
  g = mix(g, uHigh, smoothstep(.32, .78, t + mount*.6));
  float st = .5 + .5*sin(H*80. + snoise(p*9.)*2.4);
  g = mix(g, g*(.62 + .7*st), uStrata);
  float snow = smoothstep(.82, 1.05, t + mount*.6 + lat*.3 - .1);
  float polar = smoothstep(.8, .93, lat + snoise(p*5.)*.07);
  g = mix(g, uPeak, snow);
  vec3 albedo = mix(ocean, g, land);
  albedo = mix(albedo, uPeak, polar*.95);
  float iceMask = max(polar, snow*land);

  // rivers of light: lava, ore, ley-lines
  vec3 vq = p*2.5 + uSeed*.5 + vec3(snoise(p*1.7)*.4);
  float vv = 1. - smoothstep(0., .035, abs(snoise(vq)));
  vv *= smoothstep(.0, .05, e) * (1. - smoothstep(.2, .4, e));
  float pulse = .75 + .25*sin(uTime*1.2 + snoise(p*3.)*7.);
  vec3 emis = uVeinCol * vv * land * uVein * pulse * (1. - iceMask);

  float d = max(dot(N, L), 0.);
  vec3 col = albedo * (d*1.2*day + .085) + albedo*uAtmo*.06*day;

  vec3 R = reflect(-L, N);
  float sr = max(dot(R, vec3(0.,0.,1.)), 0.);
  col += mix(vec3(1.), uAtmo, .35) * (pow(sr, 110.)*1.1 + pow(sr, 14.)*.12) * (1.-land) * day;

  // clouds drift above the land and cast soft shadows on it
  vec3 cp = rotY(p, uTime*.014);
  float cl = cloudField(cp);
  float cs = cloudField(normalize(cp - L*.07));
  col *= 1. - cs*.45*day;
  vec3 cloudCol = mix(vec3(.12,.13,.2), mix(vec3(1.), uAtmo, .12), day*smoothstep(-.1,.7,ndlG)*.9 + .1);
  col = mix(col, cloudCol, cl*.62);

  float night = 1. - smoothstep(-.2, .08, ndlG);
  col += emis * (.7 + 1.1*night) * (1. - cl*.7);

  // city lights along lowlands and coasts, joined by faint roads
  float pop = smoothstep(.25, .7, snoise(p*5.5 + uSeed*2.)*.5 + .5) * smoothstep(0., .05, e) * (1. - smoothstep(.1, .34, e));
  float dots = smoothstep(.8, .96, snoise(p*58.)*.5 + .5);
  float road = (1. - smoothstep(0., .028, abs(snoise(p*12. + uSeed)))) * .45;
  float lights = (dots + road*.7) * pop * land * night * (1. - cl*.85) * (1. - iceMask);
  col += uGlow * lights * 1.7;

  // thin atmosphere on the lit limb, warming toward the terminator
  float fres = pow(1. - clamp(Ng.z, 0., 1.), 3.0);
  vec3 scatter = mix(vec3(1.,.5,.28), uAtmo, smoothstep(-.1, .5, ndlG));
  col += scatter * fres * (.12 + 1.15*smoothstep(-.4, .5, ndlG));

  gl_FragColor = vec4(col / (1. + max(col - 1., 0.)*.6), 1.);
}
`;

const ATMO_FRAG = /* glsl */ `
precision highp float;
varying vec3 vP; varying vec3 vN;
uniform vec3 uAtmo, uLight;
void main(){
  vec3 N = normalize(vN);
  float k = clamp(-N.z / 0.3317, 0., 1.);
  float lit = smoothstep(-.55, .55, dot(N, normalize(uLight)));
  vec3 warm = mix(vec3(1.,.5,.28), uAtmo, smoothstep(-.1, .45, dot(N, normalize(uLight))));
  gl_FragColor = vec4(warm, 1.) * pow(k, 2.4) * (.08 + lit) * 1.15;
}
`;

const NEBULA_FRAG = /* glsl */ `
precision highp float;
varying vec3 vP;
uniform vec3 uAtmo, uGlow, uSeed;
${SNOISE}
void main(){
  vec3 d = normalize(vP);
  float n  = snoise(d*1.5 + uSeed*.2)*.5 + .5;
  float n2 = snoise(d*3.3 + 7.)*.5 + .5;
  float n3 = snoise(d*8. + 2.)*.5 + .5;
  float neb = smoothstep(.42, .95, n*.6 + n2*.45);
  float dust = smoothstep(.55, .9, n3) * .35;
  vec3 col = mix(uAtmo*.5, uGlow*.55, n2) * neb * (.28 + dust) + vec3(.01,.012,.03);
  gl_FragColor = vec4(col, 1.);
}
`;

const DUST_VERT = /* glsl */ `
attribute float aSize; attribute float aTone;
uniform float uPx; uniform vec3 uLightLocal;
varying float vTone; varying float vShade;
void main(){
  vTone = aTone;
  float along = dot(position, uLightLocal);
  vec3 dd = position - uLightLocal*along;
  vShade = along < 0. ? 1. - smoothstep(1.0, .9, length(dd))*.9 : 1.;
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  gl_PointSize = aSize * uPx / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
const DUST_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uRing; varying float vTone; varying float vShade;
void main(){
  float d = length(gl_PointCoord - .5);
  float a = smoothstep(.5, .1, d);
  gl_FragColor = vec4(uRing * (.45 + .75*vTone) * vShade, a * (.25 + .6*vTone) * (.35 + .65*vShade));
}
`;

export type MoonTip = { i: number; x: number; y: number } | null;

type Props = {
  stage: number;
  scrollRef: MutableRefObject<number>;
  hostRef: MutableRefObject<HTMLElement | null>;
  onPick: (i: number) => void;
  onTip: (t: MoonTip) => void;
};

export function Planet3D({ stage, scrollRef, hostRef, onPick, onTip }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const stageRef = useRef(stage);
  const kick = useRef(0);
  const [ok, setOk] = useState(true);
  const api = useRef<{ snap: () => void } | null>(null);
  const cb = useRef({ onPick, onTip });

  useEffect(() => {
    cb.current = { onPick, onTip };
  });

  useEffect(() => {
    if (stageRef.current !== stage) kick.current = 1.9;
    stageRef.current = stage;
    api.current?.snap();
  }, [stage]);

  useEffect(() => {
    const host = wrap.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      if (disposed) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      let renderer: T.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch {
        setOk(false);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setClearColor(0x000000, 0);
      host.appendChild(renderer.domElement);
      renderer.domElement.className = "lp-gl-canvas";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(12, 1, 0.1, 400);
      camera.position.z = 18;
      const VIS_H = 2 * Math.tan(THREE.MathUtils.degToRad(6)) * 18;

      const v3 = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
      const L0 = LOOKS[0];
      const light = new THREE.Vector3(-0.8, 0.3, 0.5).normalize();
      const vecKeys = ["deep", "shallow", "low", "mid", "high", "peak", "veinCol", "glow", "atmo", "seed"] as const;
      const numKeys = ["sea", "mtn", "strata", "vein", "cloud"] as const;
      const U = {
        vec: Object.fromEntries(vecKeys.map((k) => [k, { value: v3(L0[k]) }])) as Record<(typeof vecKeys)[number], { value: T.Vector3 }>,
        num: Object.fromEntries(numKeys.map((k) => [k, { value: L0[k] }])) as Record<(typeof numKeys)[number], { value: number }>,
        light: { value: light },
        time: { value: 0 },
        bump: { value: 40 },
        ring: { value: v3(L0.peak) },
        lightLocal: { value: new THREE.Vector3() },
        px: { value: 400 },
      };

      // deep-space backdrop: a nebula tinted by the current world
      const nebula = new THREE.Mesh(
        new THREE.SphereGeometry(80, 48, 32),
        new THREE.ShaderMaterial({
          vertexShader: VERT, fragmentShader: NEBULA_FRAG, side: THREE.BackSide, depthWrite: false,
          uniforms: { uAtmo: U.vec.atmo, uGlow: U.vec.glow, uSeed: U.vec.seed },
        }),
      );
      nebula.renderOrder = -2;
      scene.add(nebula);

      const root = new THREE.Group();
      scene.add(root);
      const pivot = new THREE.Group();
      pivot.rotation.z = 0.2;
      root.add(pivot);

      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(1, 128, 96),
        new THREE.ShaderMaterial({
          vertexShader: VERT, fragmentShader: PLANET_FRAG,
          uniforms: {
            uDeep: U.vec.deep, uShallow: U.vec.shallow, uLow: U.vec.low, uMid: U.vec.mid, uHigh: U.vec.high, uPeak: U.vec.peak,
            uVeinCol: U.vec.veinCol, uGlow: U.vec.glow, uAtmo: U.vec.atmo, uSeed: U.vec.seed, uLight: U.light,
            uSea: U.num.sea, uMtn: U.num.mtn, uStrata: U.num.strata, uVein: U.num.vein, uCloud: U.num.cloud,
            uTime: U.time, uBump: U.bump,
          },
        }),
      );
      pivot.add(planet);
      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(1.06, 96, 64),
        new THREE.ShaderMaterial({
          vertexShader: VERT, fragmentShader: ATMO_FRAG, transparent: true, depthWrite: false,
          side: THREE.BackSide, blending: THREE.AdditiveBlending,
          uniforms: { uAtmo: U.vec.atmo, uLight: U.light },
        }),
      );
      root.add(atmo);

      const tilt = new THREE.Group();
      tilt.rotation.set(1.2, 0, -0.2);
      root.add(tilt);

      // dust ring: thousands of motes with lanes and gaps, shadowed by the planet
      const RN = 9000;
      const rp = new Float32Array(RN * 3);
      const rs = new Float32Array(RN);
      const rt = new Float32Array(RN);
      let k = 0;
      while (k < RN) {
        const r = 1.4 + Math.pow(Math.random(), 0.85) * 0.5;
        if (Math.abs(r - 1.62) < 0.018 || Math.abs(r - 1.79) < 0.01) continue;
        const th = Math.random() * Math.PI * 2;
        const lane = 0.5 + 0.5 * Math.sin(r * 62 + Math.sin(r * 11) * 2);
        if (Math.random() > 0.35 + 0.65 * lane) continue;
        rp.set([Math.cos(th) * r, Math.sin(th) * r, (Math.random() - 0.5) * 0.012], k * 3);
        rs[k] = 0.0035 + Math.random() * 0.007;
        rt[k] = lane * (0.5 + Math.random() * 0.5);
        k++;
      }
      const rg = new THREE.BufferGeometry();
      rg.setAttribute("position", new THREE.BufferAttribute(rp, 3));
      rg.setAttribute("aSize", new THREE.BufferAttribute(rs, 1));
      rg.setAttribute("aTone", new THREE.BufferAttribute(rt, 1));
      const dust = new THREE.Points(
        rg,
        new THREE.ShaderMaterial({
          vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false,
          uniforms: { uRing: U.ring, uLightLocal: U.lightLocal, uPx: U.px },
        }),
      );
      tilt.add(dust);

      // glow sprite texture
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d")!;
      const rad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      rad.addColorStop(0, "rgba(255,255,255,1)");
      rad.addColorStop(0.3, "rgba(255,255,255,.35)");
      rad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = rad;
      g.fillRect(0, 0, 64, 64);
      const glowTex = new THREE.CanvasTexture(c);

      scene.add(new THREE.AmbientLight(0xffffff, 0.45));
      const sun = new THREE.DirectionalLight(0xffffff, 1.1);
      sun.position.copy(light).multiplyScalar(10);
      scene.add(sun);

      const MOON_R = 2.12;
      const MOON_COL: [number, number, number][] = [[0.95, 0.42, 0.22], [0.9, 0.66, 0.22], [0.3, 0.78, 0.42], [0.62, 0.45, 0.95]];
      const orbitPts = Array.from({ length: 129 }, (_, i) => new THREE.Vector3(Math.cos((i / 128) * Math.PI * 2) * MOON_R, Math.sin((i / 128) * Math.PI * 2) * MOON_R, 0));
      tilt.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(orbitPts), new THREE.LineBasicMaterial({ color: 0xf0e6d2, transparent: true, opacity: 0.1 })));

      const moons = [0, 1, 2, 3].map((i) => {
        const col = new THREE.Color().setRGB(...MOON_COL[i]);
        const grp = new THREE.Group();
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 32, 24),
          new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.12, roughness: 0.9 }),
        );
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: glowTex, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
        );
        sprite.scale.setScalar(0.24);
        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 8, 8),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        );
        hit.userData.moon = i;
        grp.add(mesh, sprite, hit);
        tilt.add(grp);
        return { i, grp, mesh, sprite, hit, speed: 0.22 - i * 0.04, a: i * 1.57 + 0.6, k: 1 };
      });

      const starGeo = new THREE.BufferGeometry();
      const N = 1400;
      const pos = new Float32Array(N * 3);
      const colr = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 50 + Math.random() * 20;
        const s2 = Math.sqrt(1 - u * u);
        pos.set([r * s2 * Math.cos(th), r * u, r * s2 * Math.sin(th)], i * 3);
        const warm = Math.random();
        colr.set([0.8 + warm * 0.2, 0.82 + warm * 0.08, 1 - warm * 0.25], i * 3);
      }
      starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      starGeo.setAttribute("color", new THREE.BufferAttribute(colr, 3));
      const stars = new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }),
      );
      scene.add(stars);

      // ---- layout ----
      let cw = 1, ch = 1, baseS = 1, baseY = 0;
      const layout = () => {
        const b = host.getBoundingClientRect();
        cw = Math.max(1, b.width);
        ch = Math.max(1, b.height);
        renderer.setSize(cw, ch, false);
        U.px.value = ch * renderer.getPixelRatio() * 4.757;
        U.bump.value = ch * 0.012;
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
        const mobile = cw < 900;
        const D = mobile ? Math.min(0.9 * cw, 0.78 * ch) : Math.min(0.52 * cw, 1.0 * ch);
        baseS = ((D / 2) * VIS_H) / ch;
        baseY = (ch / 2 - ch * (mobile ? 0.74 : 0.78)) * (VIS_H / ch);
      };
      layout();
      const ro = new ResizeObserver(layout);
      ro.observe(host);

      // ---- interaction ----
      const pt = { x: 0, y: 0, tx: 0, ty: 0 };
      let spinVel = 0;
      let dragging = false;
      let lastX = 0;
      let moved = 0;
      let hover = -1;
      const ray = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const hits = moons.map((m) => m.hit);

      const inside = (e: PointerEvent) => {
        const b = host.getBoundingClientRect();
        return e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom;
      };
      const interactive = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.("a,button,nav,[data-nodrag]");
      const onMove = (e: PointerEvent) => {
        if (!inside(e)) return;
        const b = host.getBoundingClientRect();
        pt.tx = ((e.clientX - b.left) / b.width) * 2 - 1;
        pt.ty = ((e.clientY - b.top) / b.height) * 2 - 1;
        if (dragging) {
          const dx = e.clientX - lastX;
          lastX = e.clientX;
          moved += Math.abs(dx);
          spinVel = dx * 0.012;
          planet.rotation.y += dx * 0.006;
          return;
        }
        ndc.set(pt.tx, -pt.ty);
        ray.setFromCamera(ndc, camera);
        const h = ray.intersectObjects(hits, false)[0];
        const i = h ? (h.object.userData.moon as number) : -1;
        if (i !== hover) {
          hover = i;
          const cur = hostRef.current ?? host;
          cur.style.cursor = i >= 0 ? "pointer" : "";
          if (i < 0) cb.current.onTip(null);
        }
        if (i >= 0) {
          const p = new THREE.Vector3();
          moons[i].mesh.getWorldPosition(p);
          p.project(camera);
          cb.current.onTip({ i, x: (p.x * 0.5 + 0.5) * cw, y: (-p.y * 0.5 + 0.5) * ch });
        }
      };
      const onDown = (e: PointerEvent) => {
        if (!inside(e) || interactive(e.target) || reduce) return;
        dragging = true;
        lastX = e.clientX;
        moved = 0;
      };
      const onUp = () => {
        if (dragging) dragging = false;
        if (hover >= 0 && moved < 6) cb.current.onPick(hover);
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerdown", onDown, { passive: true });
      window.addEventListener("pointerup", onUp, { passive: true });

      // ---- loop ----
      const tmp = new THREE.Vector3();
      const apply = (kk: number, instant: boolean) => {
        const L = LOOKS[stageRef.current];
        const f = instant ? 1 : kk;
        vecKeys.forEach((n) => U.vec[n].value.lerp(tmp.set(...(L[n] as [number, number, number])), f));
        numKeys.forEach((n) => {
          U.num[n].value += (L[n] - U.num[n].value) * f;
        });
        U.ring.value.lerp(tmp.set(L.peak[0] * 0.9, L.peak[1] * 0.85, L.peak[2] * 0.8), f);
      };

      let visible = true;
      let raf = 0;
      let last = performance.now();
      const frame = (now: number) => {
        raf = 0;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const k = 1 - Math.exp(-dt * 2.4);
        apply(k, reduce);

        pt.x += (pt.tx - pt.x) * (1 - Math.exp(-dt * 4));
        pt.y += (pt.ty - pt.y) * (1 - Math.exp(-dt * 4));
        if (kick.current) {
          spinVel += kick.current;
          kick.current = 0;
        }
        if (!dragging) spinVel *= Math.exp(-dt * 1.6);
        const spin = reduce ? 0 : 0.045 + spinVel;
        planet.rotation.y += spin * dt * (dragging ? 0 : 1);
        U.time.value = now * 0.001;

        const sp = scrollRef.current;
        const sc = baseS * (1 + sp * 0.55);
        root.scale.setScalar(sc);
        U.px.value = ch * renderer.getPixelRatio() * 4.757 * sc;
        root.position.set(pt.x * 0.05, baseY + sp * VIS_H * 0.3 - pt.y * 0.03, 0);
        root.rotation.set(pt.y * 0.05, pt.x * 0.09, 0);
        stars.rotation.y = now * 0.000004 + pt.x * 0.02;
        stars.rotation.x = pt.y * 0.015;
        nebula.rotation.y = pt.x * 0.03;
        nebula.rotation.x = pt.y * 0.02;

        const q = tilt.quaternion.clone().invert();
        U.lightLocal.value.copy(light).applyQuaternion(q).normalize();

        moons.forEach((m) => {
          if (!reduce) m.a += m.speed * dt;
          m.grp.position.set(Math.cos(m.a) * MOON_R, Math.sin(m.a) * MOON_R * 1, 0);
          const want = m.i === stageRef.current ? 1.7 : hover === m.i ? 1.35 : 1;
          m.k += (want - m.k) * (1 - Math.exp(-dt * 6));
          m.mesh.scale.setScalar(m.k);
          m.sprite.scale.setScalar(0.2 * m.k * (m.i === stageRef.current ? 1.35 : 1));
        });

        renderer.render(scene, camera);
        if (!reduce && visible && document.visibilityState === "visible") raf = requestAnimationFrame(frame);
      };
      const kickoff = () => {
        if (!raf) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        }
      };
      const io = new IntersectionObserver((e) => {
        visible = e.some((x) => x.isIntersecting);
        if (visible) kickoff();
      });
      io.observe(host);
      const vis = () => document.visibilityState === "visible" && kickoff();
      document.addEventListener("visibilitychange", vis);
      api.current = { snap: kickoff };
      kickoff();

      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        ro.disconnect();
        document.removeEventListener("visibilitychange", vis);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointerup", onUp);
        scene.traverse((o) => {
          const m = o as T.Mesh;
          m.geometry?.dispose?.();
          const mat = m.material as T.Material | T.Material[] | undefined;
          (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
        });
        glowTex.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
        (hostRef.current ?? host).style.cursor = "";
        api.current = null;
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [scrollRef, hostRef]);

  return (
    <div className="lp-gl" ref={wrap} aria-hidden="true">
      {!ok && <div className="lp-gl-fallback" />}
    </div>
  );
}
