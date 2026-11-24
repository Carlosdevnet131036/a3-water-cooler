// Modelo 3D do water cooler em bancada aberta (unidades ≈ cm).
// O estado vem do simulador: a vazão move as partículas, as temperaturas colorem a água.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Hydraulics } from "./model";

export interface SceneState {
  hyd: Hydraulics;
  tCold: number;
  tMid: number;
  tHot: number;
  tCpu: number;
  tGpu: number;
  rpm: number;
  pump: number; // % efetivo
  fan: number; // % efetivo
  fault: string;
  cpuW: number; // calor entregue pela CPU (W)
  gpuW: number;
  radW: number; // calor que a água leva ao radiador (W)
}

export type View3d = "home" | "pump" | "cpu" | "gpu" | "rad" | "res" | "cut" | "fault";
export interface Scene3dApi {
  focus(view: View3d): void;
  setCut(on: boolean): void;
  setPressure(on: boolean): void;
  setHeat(on: boolean): void;
  showcase(on: boolean): void;
}
const NOOP: Scene3dApi = { focus() {}, setCut() {}, setPressure() {}, setHeat() {}, showcase() {} };

type PartId = "pump" | "res" | "cpu" | "gpu" | "rad" | "tube" | "board";

const INFO: Record<PartId, { title: string; text: (s: SceneState) => string }> = {
  pump: {
    title: "Bomba centrífuga 12 V",
    text: (s) => `Fornece a pressão que vence toda a perda de carga do circuito. Agora: ${fmt(s.rpm, 0)} rpm e ${fmt(s.hyd.dpTotal, 0)} Pa, com ${fmt(s.pump, 0)} % de PWM. O sensor S4 (tacômetro) lê a rotação.`,
  },
  res: {
    title: "Reservatório",
    text: () => "Guarda o líquido, mantém a sucção da bomba sempre cheia e deixa as bolhas de ar subirem e saírem do circuito.",
  },
  cpu: {
    title: "Bloco da CPU · microcanais",
    text: (s) => `Base de cobre com 40 microcanais. A área menor acelera a água para ${fmt(s.hyd.vChannel, 2)} m/s (continuidade) e aumenta a troca de calor, mas concentra a maior parte da perda de carga. CPU a ${fmt(s.tCpu, 0)} °C.`,
  },
  gpu: {
    title: "Bloco da GPU",
    text: (s) => `Bloco de cobre que cobre o chip e a memória da placa de vídeo. A água sai daqui a ${fmt(s.tHot, 1)} °C, medida pelo sensor S2. GPU a ${fmt(s.tGpu, 0)} °C.`,
  },
  rad: {
    title: "Radiador 360 mm",
    text: (s) => `Trocador de calor de tubos e aletas. As três ventoinhas a ${fmt(s.fan, 0)} % empurram ar ambiente e a água volta a ${fmt(s.tCold, 1)} °C (sensor S3).`,
  },
  tube: {
    title: "Mangueira Ø 10 mm",
    text: (s) => `Vazão de ${fmt(s.hyd.q, 2)} L/min a ${fmt(s.hyd.v, 2)} m/s. Re = ${fmt(s.hyd.re, 0)}, escoamento ${s.hyd.regime}. Perda distribuída de ${fmt(s.hyd.dpDist, 0)} Pa nos 1,2 m de mangueira.`,
  },
  board: {
    title: "Placa-mãe",
    text: () => "Lê os sensores pela BIOS e gera os sinais PWM de 25 kHz para a bomba e as ventoinhas.",
  },
};

const fmt = (x: number, d: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(x);

const COLD = new THREE.Color("#0f8fc0");
const HOT = new THREE.Color("#e0482a");
const tempToColor = (t: number, out: THREE.Color) => out.copy(COLD).lerp(HOT, THREE.MathUtils.clamp((t - 29) / 14, 0, 1));
const HOME = new THREE.Vector3(14, 40, 62);
// cores da pressão (roxo = baixa, amarelo = alta), diferentes das de temperatura
const P_LOW = new THREE.Color("#4b2f9c"), P_MID = new THREE.Color("#1f9e8f"), P_HIGH = new THREE.Color("#f4c542");
const pressureToColor = (f: number, out: THREE.Color) => {
  f = THREE.MathUtils.clamp(f, 0, 1);
  return f < 0.5 ? out.copy(P_LOW).lerp(P_MID, f * 2) : out.copy(P_MID).lerp(P_HIGH, (f - 0.5) * 2);
};
// divisão da perda dos componentes (relatório: bloco 1.200 Pa + radiador 400 Pa)
const COMP_SHARE = { cpu: 0.6, gpu: 0.15, rad: 0.25 };

const VIEWS: Record<View3d, { pos: [number, number, number]; target: [number, number, number] }> = {
  home: { pos: [14, 40, 62], target: [0, 4, 0] },
  pump: { pos: [-6, 16, 30], target: [-25, 6, 5] },
  cpu: { pos: [-12, 15, -22], target: [-6, 2, -5] },
  gpu: { pos: [8, 24, 40], target: [2, 2, 8] },
  rad: { pos: [52, 22, 26], target: [26, 8, -1] },
  res: { pos: [-8, 20, 26], target: [-25, 9, 5] },
  fault: { pos: [-2, 27, 34], target: [-17, 6, 0] },
  cut: { pos: [-1, 21, -31], target: [-1.5, 6, -7] },
};
const VIEW_KEYS: View3d[] = ["home", "pump", "cpu", "gpu", "rad", "res"];

export function initScene3d(container: HTMLElement, getState: () => SceneState): Scene3dApi {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  // ---------- renderizadores ----------
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    // computador sem WebGL (driver antigo, aceleração desligada): mostra um aviso no lugar da tela preta
    container.classList.add("no3d");
    container.innerHTML = `<div class="fallback3d"><b>O 3D não abriu neste computador</b>
      <span>O navegador não liberou a aceleração gráfica (WebGL). O circuito 2D da bancada usa o mesmo simulador.</span>
      <a class="button" href="#bancada">Ver o circuito 2D</a></div>`;
    container.parentElement?.querySelector(".toolbar3d")?.setAttribute("hidden", "");
    return NOOP;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = "labels3d";
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4;
  renderer.toneMappingExposure = 0.9;

  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 400);
  camera.position.copy(HOME);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 4, 0);
  controls.enableDamping = true;
  controls.minDistance = 8;
  controls.maxDistance = 130;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.autoRotate = !reduce.matches;
  controls.autoRotateSpeed = 0.6;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(20, 45, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 120 });
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.22 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- materiais ----------
  const M = {
    copper: new THREE.MeshStandardMaterial({ color: 0xc27a3e, metalness: 1, roughness: 0.32 }),
    black: new THREE.MeshStandardMaterial({ color: 0x1b1f24, metalness: 0.5, roughness: 0.45 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd9dee3, metalness: 1, roughness: 0.15 }),
    pcb: new THREE.MeshStandardMaterial({ color: 0x1e3a2f, metalness: 0.2, roughness: 0.7 }),
    darkPcb: new THREE.MeshStandardMaterial({ color: 0x15181c, metalness: 0.3, roughness: 0.6 }),
    acrylic: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.05, clearcoat: 1, depthWrite: false }),
    fanFrame: new THREE.MeshStandardMaterial({ color: 0x23272d, metalness: 0.2, roughness: 0.6 }),
    blade: new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.1, roughness: 0.5, side: THREE.DoubleSide }),
    ram: new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.6, roughness: 0.4 }),
    sensor: new THREE.MeshStandardMaterial({ color: 0x2ecc71, emissive: 0x1e8449, emissiveIntensity: 0.6 }),
  };
  const liquidMat = new THREE.MeshStandardMaterial({ color: COLD, transparent: true, opacity: 0.75, roughness: 0.2, emissive: COLD, emissiveIntensity: 0.15 });

  const parts = new Map<PartId, THREE.Group>();
  const base = new Map<PartId, THREE.Vector3>();
  const explodeDir: Partial<Record<PartId, THREE.Vector3>> = {
    cpu: new THREE.Vector3(0, 10, -4), gpu: new THREE.Vector3(0, 7, 7),
    res: new THREE.Vector3(-8, 5, 0), pump: new THREE.Vector3(-8, 1, 0),
    rad: new THREE.Vector3(10, 3, 0), board: new THREE.Vector3(0, -3, 0),
  };
  const pickables: THREE.Object3D[] = [];

  function part(id: PartId, pos: THREE.Vector3) {
    const g = new THREE.Group();
    g.position.copy(pos);
    g.userData.id = id;
    scene.add(g);
    parts.set(id, g);
    base.set(id, pos.clone());
    pickables.push(g);
    return g;
  }
  function mesh(g: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  }
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r: number, h: number, seg = 40) => new THREE.CylinderGeometry(r, r, h, seg);

  // ---------- placa-mãe ----------
  const board = part("board", new THREE.Vector3(-3, 0, 0));
  mesh(board, box(30, 0.5, 30), M.pcb, 0, 0.25, 0);
  for (let i = 0; i < 4; i++) mesh(board, box(0.6, 3, 12), M.ram, 6 + i * 1.2, 2, -7);
  mesh(board, box(4, 1.2, 8), M.black, -12, 1.1, -10); // VRM
  mesh(board, box(18, 0.8, 1.2), M.black, 5, 0.9, 4.5); // slot PCIe

  // ---------- bloco da CPU ----------
  const cpu = part("cpu", new THREE.Vector3(-6, 0.5, -6));
  const cpuCopper = M.copper.clone();
  mesh(cpu, box(6.4, 0.7, 6.4), cpuCopper, 0, 0.35, 0);
  for (let i = -5; i <= 5; i++) mesh(cpu, box(0.12, 0.35, 4.8), cpuCopper, i * 0.42, 0.85, 0); // aletas dos microcanais
  const cpuCover = [mesh(cpu, cyl(3, 1.5), M.acrylic, 0, 1.45, 0)];
  const cpuWater = mesh(cpu, cyl(2.7, 1.1), liquidMat.clone(), 0, 1.4, 0);
  cpuCover.push(cpuWater);
  const cpuRing = mesh(cpu, new THREE.TorusGeometry(3, 0.18, 12, 48), M.chrome, 0, 2.2, 0);
  cpuRing.rotation.x = Math.PI / 2;
  cpuCover.push(cpuRing);
  // corte: água correndo entre as aletas, na velocidade dos microcanais
  const CH_GAPS = 10, CH_PER = 6;
  const chDots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: COLD, emissiveIntensity: 0.6 }), CH_GAPS * CH_PER);
  chDots.visible = false;
  cpu.add(chDots);
  const chSheet = mesh(cpu, box(4.2, 0.3, 4.8), liquidMat.clone(), 0, 0.85, 0);
  chSheet.visible = false;
  mesh(cpu, cyl(0.55, 0.9, 20), M.chrome, -1.5, 2.6, 0);
  mesh(cpu, cyl(0.55, 0.9, 20), M.chrome, 1.5, 2.6, 0);

  // ---------- GPU ----------
  const gpu = part("gpu", new THREE.Vector3(2, 0.5, 8));
  mesh(gpu, box(27, 0.3, 11), M.darkPcb, 0, 1.0, 0);
  mesh(gpu, box(1.2, 4, 11.6), M.chrome, -14, 2.6, 0); // espelho
  mesh(gpu, box(23, 0.9, 9.4), M.black, 1, 1.6, 0);
  const gpuCopper = M.copper.clone();
  mesh(gpu, box(18, 0.25, 6.5), gpuCopper, 2, 2.15, 0);
  const gpuWater = mesh(gpu, box(18, 0.5, 6.5), liquidMat.clone(), 2, 2.45, 0);
  mesh(gpu, box(21, 0.6, 8.4), M.acrylic, 1, 2.5, 0);
  mesh(gpu, cyl(0.55, 0.9, 20), M.chrome, -9, 3.2, -2);
  mesh(gpu, cyl(0.55, 0.9, 20), M.chrome, -9, 3.2, 2);

  // ---------- bomba + reservatório ----------
  const pump = part("pump", new THREE.Vector3(-25, 0, 5));
  mesh(pump, box(7, 3, 7), M.black, 0, 1.5, 0);
  mesh(pump, cyl(2.6, 0.4), M.acrylic, 0, 3.2, 0);
  const rotor = new THREE.Group();
  rotor.position.set(0, 3.15, 0);
  pump.add(rotor);
  for (let i = 0; i < 6; i++) {
    const b = mesh(rotor, box(2.2, 0.25, 0.35), M.chrome, 0, 0, 0);
    b.rotation.y = (i / 6) * Math.PI;
  }
  mesh(pump, cyl(0.55, 1.2, 20), M.chrome, 3.9, 1.5, 0).rotation.z = Math.PI / 2;

  const res = part("res", new THREE.Vector3(-25, 3.4, 5));
  mesh(res, cyl(3, 11), M.acrylic, 0, 5.5, 0);
  const resWater = mesh(res, cyl(2.75, 8), liquidMat.clone(), 0, 4.2, 0);
  mesh(res, cyl(3.2, 0.6), M.black, 0, 11.2, 0);
  mesh(res, cyl(0.55, 0.9, 20), M.chrome, 0, 11.9, 0);
  const bubble = mesh(res, new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }), 0.8, 1, 0);
  bubble.visible = false;

  // ---------- radiador + ventoinhas ----------
  const rad = part("rad", new THREE.Vector3(24, 0, -1));
  const finTex = (() => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 32;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#3b4651"; ctx.fillRect(0, 0, 256, 32);
    ctx.fillStyle = "#1c2329";
    for (let x = 0; x < 256; x += 4) ctx.fillRect(x, 0, 1.6, 32);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(10, 12);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  mesh(rad, box(3, 13, 40), new THREE.MeshStandardMaterial({ map: finTex, metalness: 0.6, roughness: 0.5 }), 0, 7.5, 0);
  mesh(rad, box(3.4, 13.6, 2), M.black, 0, 7.5, -20.5);
  mesh(rad, box(3.4, 13.6, 2), M.black, 0, 7.5, 20.5);
  mesh(rad, cyl(0.55, 0.9, 20), M.chrome, 0, 14.7, -19);
  mesh(rad, cyl(0.55, 0.9, 20), M.chrome, 0, 14.7, 19);

  const fanRotors: THREE.Group[] = [];
  const frameShape = new THREE.Shape();
  frameShape.moveTo(-6, -6); frameShape.lineTo(6, -6); frameShape.lineTo(6, 6); frameShape.lineTo(-6, 6); frameShape.lineTo(-6, -6);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 5.6, 0, Math.PI * 2, true);
  frameShape.holes.push(hole);
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 2.4, bevelEnabled: false });
  const bladeGeo = (() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.9); s.quadraticCurveTo(2.5, 2.2, 5.2, 0.8); s.quadraticCurveTo(4, -0.6, 0, -0.5);
    return new THREE.ShapeGeometry(s, 12);
  })();
  for (const z of [-13.3, 0, 13.3]) {
    const f = new THREE.Group();
    f.position.set(1.6, 7.5, z);
    f.rotation.y = Math.PI / 2;
    rad.add(f);
    mesh(f, frameGeo, M.fanFrame, 0, 0, 0);
    const r = new THREE.Group();
    r.position.z = 1.2;
    f.add(r);
    mesh(r, cyl(1.6, 1.4), M.fanFrame, 0, 0, 0).rotation.x = Math.PI / 2;
    for (let i = 0; i < 7; i++) {
      const b = mesh(r, bladeGeo, M.blade, 0, 0, 0);
      b.rotation.z = (i / 7) * Math.PI * 2;
      b.rotation.x = 0.35;
    }
    fanRotors.push(r);
  }
  const AIR_N = 140;
  const airGeo = new THREE.BufferGeometry();
  const airPos = new Float32Array(AIR_N * 3);
  const airLife = new Float32Array(AIR_N);
  const seedAir = (i: number, x0 = 3.2) => {
    airPos[i * 3] = x0;
    airPos[i * 3 + 1] = 2 + Math.random() * 11;
    airPos[i * 3 + 2] = -19 + Math.random() * 38;
    airLife[i] = Math.random();
  };
  for (let i = 0; i < AIR_N; i++) { seedAir(i, 3.2 + Math.random() * 12); }
  airGeo.setAttribute("position", new THREE.BufferAttribute(airPos, 3));
  const airMat = new THREE.PointsMaterial({ color: 0xffa060, size: 0.55, transparent: true, opacity: 0.55, depthWrite: false });
  const air = new THREE.Points(airGeo, airMat);
  air.raycast = () => {}; // o ar não é uma peça clicável
  rad.add(air);

  // ---------- mangueiras e escoamento ----------
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const routes = [
    { key: "cold", pts: [v(-20.4, 1.5, 5), v(-17, 1.8, 4), v(-12, 6, -2), v(-7.5, 6, -6), v(-7.5, 3.5, -6)] },
    { key: "mid", pts: [v(-4.5, 3.5, -6), v(-4.5, 6, -5), v(-6, 6, 1), v(-7, 5.5, 6), v(-7, 4.2, 6)] },
    { key: "hot", pts: [v(-7, 4.2, 10), v(-7, 7, 11), v(4, 10, 14), v(18, 16, -6), v(24, 19, -19), v(24, 15.6, -19)] },
    { key: "ret", pts: [v(24, 15.6, 18), v(24, 19, 18), v(10, 19, 19), v(-12, 18, 12), v(-25, 18.5, 5), v(-25, 15.8, 5)] },
  ] as const;

  const flowGeo = new THREE.SphereGeometry(0.17, 10, 8);
  const flowMat = new THREE.MeshStandardMaterial({ color: 0xe8f7ff, emissive: 0xffffff, emissiveIntensity: 0.25 });
  const tubeShell = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.3, envMapIntensity: 0.2, depthWrite: false });
  const segs = routes.map((r) => {
    const curve = new THREE.CatmullRomCurve3([...r.pts], false, "centripetal");
    const len = curve.getLength();
    const g = new THREE.Group();
    g.userData.id = "tube";
    scene.add(g);
    pickables.push(g);
    const shell = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.62, 16), tubeShell);
    const coreGeo = new THREE.TubeGeometry(curve, 120, 0.5, 12);
    coreGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(coreGeo.attributes.position.count * 3), 3));
    const core = new THREE.Mesh(coreGeo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.4, envMapIntensity: 0.1 }));
    core.castShadow = true;
    g.add(core, shell);
    const count = Math.max(5, Math.round(len / 2.2));
    const dots = new THREE.InstancedMesh(flowGeo, flowMat, count);
    dots.setColorAt(0, new THREE.Color(0xffffff));
    g.add(dots);
    return { key: r.key, curve, len, group: g, core, dots, count, u: Math.random() };
  });

  // sensores S1–S4
  const sensorDefs = [
    { id: "S1", seg: 0, u: 0.35, label: (s: SceneState) => `S1 fluxo · ${fmt(s.hyd.q, 2)} L/min` },
    { id: "S2", seg: 2, u: 0.18, label: (s: SceneState) => `S2 · ${fmt(s.tHot, 1)} °C` },
    { id: "S3", seg: 3, u: 0.12, label: (s: SceneState) => `S3 · ${fmt(s.tCold, 1)} °C` },
  ];
  const tagEls: { el: HTMLElement; fn: (s: SceneState) => string }[] = [];
  const tagObjs: CSS2DObject[] = [];
  function tag(parent: THREE.Object3D, pos: THREE.Vector3, fn: (s: SceneState) => string, cls = "") {
    const el = document.createElement("div");
    el.className = "tag3d " + cls;
    const o = new CSS2DObject(el);
    o.position.copy(pos);
    parent.add(o);
    tagEls.push({ el, fn });
    tagObjs.push(o);
  }
  for (const s of sensorDefs) {
    const p = segs[s.seg].curve.getPointAt(s.u);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), M.sensor);
    m.position.copy(p);
    segs[s.seg].group.add(m);
    tag(segs[s.seg].group, p.clone().add(v(0, 1.8, 0)), s.label, "sensor");
  }
  tag(pump, v(0, -0.5, 4.5), (s) => `S4 · ${fmt(s.rpm, 0)} rpm · Δp ${fmt(s.hyd.dpTotal, 0)} Pa`, "sensor");
  tag(segs[2].group, segs[2].curve.getPointAt(0.55).add(v(0, 2, 0)), (s) => `V ${fmt(s.hyd.v, 2)} m/s · Re ${fmt(s.hyd.re, 0)}`);
  const FAULT_TXT: Record<string, string> = { stopped: "⚠ Bomba parada: sem escoamento", air: "⚠ Ar no circuito", clog: "⚠ Entupimento no bloco da CPU" };
  tag(pump, v(0, 17, 0), (s) => FAULT_TXT[s.fault] ?? "", "alert");
  tag(cpu, v(0, 4, 0), (s) => `CPU ${fmt(s.tCpu, 0)} °C`);
  tag(gpu, v(6, 4, 0), (s) => `GPU ${fmt(s.tGpu, 0)} °C`);
  tag(rad, v(0, 16.5, 0), (s) => `Radiador · ventoinhas ${fmt(s.fan, 0)} %`);
  tag(res, v(0, 13.5, 0), () => "Bomba + reservatório");

  // ---------- corte da mangueira: perfil de velocidade ampliado ----------
  const cold = segs[0];
  // trecho ampliado de mangueira acima do bloco, de frente para a vista "cut" (desenho esquemático)
  const pAnchor = cold.curve.getPointAt(0.8);
  const profile = new THREE.Group();
  profile.position.set(3, 10, -10);
  profile.visible = false;
  scene.add(profile);
  const PR = 2.6, PL = 5.2; // raio e comprimento do trecho ampliado
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR, 7, 40, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x9fd8f0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  pipe.rotation.z = Math.PI / 2;
  profile.add(pipe);
  const wallMat = new THREE.LineBasicMaterial({ color: 0x0f8fc0 });
  for (const y of [-PR, PR]) profile.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([v(-3.5, y, 0), v(3.5, y, 0)]), wallMat));
  const ARROWS = 13;
  const arrows: { a: THREE.ArrowHelper; r: number }[] = [];
  for (let i = 0; i < ARROWS; i++) {
    const r = -0.94 + (1.88 * i) / (ARROWS - 1);
    const a = new THREE.ArrowHelper(v(1, 0, 0), v(-PL / 2, r * PR, 0), 1, 0x0f8fc0, 0.5, 0.35);
    profile.add(a);
    arrows.push({ a, r });
  }
  const tipGeo = new THREE.BufferGeometry().setFromPoints(arrows.map(() => v(0, 0, 0)));
  const tipLine = new THREE.Line(tipGeo, new THREE.LineBasicMaterial({ color: 0xe0482a }));
  profile.add(tipLine);
  const leader = new THREE.Line(new THREE.BufferGeometry().setFromPoints([pAnchor, profile.position.clone().add(v(0, -PR, 0))]),
    new THREE.LineDashedMaterial({ color: 0x5b6b78, dashSize: 0.5, gapSize: 0.35 }));
  leader.computeLineDistances();
  leader.visible = false;
  scene.add(leader);
  tag(profile, v(0, PR + 1.6, 0), (s) => s.hyd.q < 0.05 ? "Perfil de velocidade · sem escoamento"
    : `Perfil de velocidade · ${s.hyd.regime} · Re ${fmt(s.hyd.re, 0)}`, "profile");
  tag(cpu, v(0, -1.2, 4.6), (s) => `Microcanais · ${fmt(s.hyd.vChannel, 2)} m/s`, "cutonly");
  let profileShape = 1; // 0 = laminar (parábola), 1 = turbulento (lei de potência 1/7)

  // ---------- setas de fluxo de calor (largura ∝ watts) ----------
  const heatMat = new THREE.MeshStandardMaterial({ color: 0xff7a2f, emissive: 0xff5a1f, emissiveIntensity: 0.55, transparent: true, opacity: 0.85 });
  function heatArrow(parent: THREE.Object3D, pos: THREE.Vector3, dir: THREE.Vector3) {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(cyl(1, 4, 24), heatMat);
    shaft.position.y = 2;
    const head = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2, 24), heatMat);
    head.position.y = 5;
    g.add(shaft, head);
    g.position.copy(pos);
    g.quaternion.setFromUnitVectors(v(0, 1, 0), dir.clone().normalize());
    g.visible = false;
    parent.add(g);
    return g;
  }
  const heat = {
    cpu: heatArrow(cpu, v(0, 3.2, 0), v(0, 1, 0)),
    gpu: heatArrow(gpu, v(9, 3, 0), v(0, 1, 0)),
    rad: heatArrow(rad, v(4.5, 7.5, 0), v(1, 0, 0)),
  };
  tag(heat.cpu, v(0, 7.2, 0), (s) => `${fmt(s.cpuW, 0)} W → água`, "heat");
  tag(heat.gpu, v(0, 7.2, 0), (s) => `${fmt(s.gpuW, 0)} W → água`, "heat");
  tag(heat.rad, v(0, 7.4, 0), (s) => `${fmt(s.radW, 0)} W → ar`, "heat");

  // marcador do entupimento na entrada do bloco
  const clogMark = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.22, 12, 32), new THREE.MeshStandardMaterial({ color: 0xe0482a, emissive: 0xe0482a, emissiveIntensity: 0.8 }));
  clogMark.position.copy(cold.curve.getPointAt(0.97));
  clogMark.quaternion.setFromUnitVectors(v(0, 0, 1), cold.curve.getTangentAt(0.97));
  clogMark.visible = false;
  cold.group.add(clogMark);

  // legenda das cores das mangueiras
  const legend = document.createElement("div");
  legend.className = "legend3d";
  container.parentElement!.appendChild(legend);

  // ---------- interação ----------
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  const infoEl = container.parentElement!.querySelector<HTMLElement>(".info3d")!;
  let selected: PartId | null = null;
  const idOf = (o: THREE.Object3D | null): PartId | null => {
    while (o) { if (o.userData.id) return o.userData.id as PartId; o = o.parent; }
    return null;
  };
  function pick(ev: PointerEvent) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(pickables, true).find((h) => (h.object as THREE.Mesh).isMesh && (h.object as THREE.Mesh).material !== M.acrylic) ?? ray.intersectObjects(pickables, true)[0];
    return hit ? idOf(hit.object) : null;
  }
  let down = { x: 0, y: 0 };
  renderer.domElement.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return; // foi um arrasto
    selected = pick(e);
    controls.autoRotate = false;
    syncButtons();
    renderInfo();
  });
  renderer.domElement.addEventListener("pointermove", (e) => {
    renderer.domElement.style.cursor = pick(e) ? "pointer" : "grab";
  });

  function renderInfo() {
    if (!selected) {
      infoEl.innerHTML = `<b>Clique numa peça</b><span>Arraste para girar, use a roda ou dois dedos para aproximar.</span>`;
      return;
    }
    const i = INFO[selected];
    infoEl.innerHTML = `<b>${i.title}</b><span>${i.text(getState())}</span>`;
  }

  // botões
  const btn = (name: string) => container.parentElement!.querySelector<HTMLButtonElement>(`[data-3d="${name}"]`)!;
  // no celular os rótulos encobrem o modelo: começam desligados
  let explodeTarget = 0, explode = 0, showLabels = container.clientWidth >= 600;
  let cutOn = false, pressureOn = false, heatOn = false, showcaseOn = false, lastTouch = 0;
  labels.domElement.hidden = !showLabels;
  function syncButtons() {
    btn("rotate").setAttribute("aria-pressed", String(controls.autoRotate));
    btn("explode").setAttribute("aria-pressed", String(explodeTarget === 1));
    btn("labels").setAttribute("aria-pressed", String(showLabels));
    btn("cut")?.setAttribute("aria-pressed", String(cutOn));
    btn("pressure")?.setAttribute("aria-pressed", String(pressureOn));
    btn("heat")?.setAttribute("aria-pressed", String(heatOn));
  }

  // câmera guiada: voo suave até uma vista
  let fly: { p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; k: number } | null = null;
  function focus(view: View3d) {
    const d = VIEWS[view];
    const p1 = new THREE.Vector3(...d.pos), t1 = new THREE.Vector3(...d.target);
    if (explodeTarget && view !== "home") { explodeTarget = 0; }
    const dir: Partial<Record<View3d, PartId>> = { pump: "pump", cpu: "cpu", gpu: "gpu", rad: "rad", res: "res" };
    selected = dir[view] ?? null;
    if (view === "cut") setCut(true);
    controls.autoRotate = false;
    if (reduce.matches) { camera.position.copy(p1); controls.target.copy(t1); fly = null; }
    else fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1, t1, k: 0 };
    syncButtons();
    renderInfo();
  }
  function setCut(on: boolean) { cutOn = on; syncButtons(); }
  function setPressure(on: boolean) { pressureOn = on; colorT = 1; syncButtons(); }
  function setHeat(on: boolean) { heatOn = on; syncButtons(); }
  function showcase(on: boolean) {
    showcaseOn = on;
    if (on) {
      selected = null; cutOn = pressureOn = heatOn = false; explodeTarget = 0;
      camera.position.copy(HOME); controls.target.set(0, 4, 0); fly = null;
      controls.autoRotate = !reduce.matches;
      renderInfo();
    }
    syncButtons();
  }
  // quem mexe no modelo para a vitrine; ela volta depois de 12 s parada
  controls.addEventListener("start", () => {
    fly = null;
    lastTouch = performance.now();
    if (showcaseOn) { controls.autoRotate = false; syncButtons(); }
  });
  btn("cut")?.addEventListener("click", () => {
    setCut(!cutOn);
    if (cutOn) focus("cut");
  });
  btn("pressure")?.addEventListener("click", () => setPressure(!pressureOn));
  btn("heat")?.addEventListener("click", () => setHeat(!heatOn));
  // teclas 0–5: vistas prontas (só quando o modelo está na tela)
  document.addEventListener("keydown", (e) => {
    if (!visible || !container.isConnected || e.altKey || e.ctrlKey || e.metaKey) return;
    if ((e.target as Element | null)?.closest?.("input, select, textarea")) return;
    const i = "012345".indexOf(e.key);
    if (i >= 0) focus(VIEW_KEYS[i]);
  });
  btn("rotate").addEventListener("click", () => { controls.autoRotate = !controls.autoRotate; syncButtons(); });
  btn("explode").addEventListener("click", () => { explodeTarget = explodeTarget ? 0 : 1; syncButtons(); });
  btn("labels").addEventListener("click", () => {
    showLabels = !showLabels;
    labels.domElement.hidden = !showLabels;
    syncButtons();
  });
  btn("reset").addEventListener("click", () => {
    focus("home");
    selected = null;
    renderInfo();
  });
  const stage = container.parentElement!;
  btn("full").addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.requestFullscreen();
    } catch { /* tela cheia indisponível nesta janela */ }
  });
  syncButtons();
  renderInfo();

  // ---------- tamanho e visibilidade ----------
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1.2 ? 54 : camera.aspect < 1.5 ? 46 : 38; // tela estreita precisa de mais campo
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();
  let visible = true;
  // várias mudanças podem chegar juntas (o modelo troca de tela): vale a mais recente
  new IntersectionObserver((es) => (visible = es[es.length - 1].isIntersecting)).observe(container);

  // modo leve: se os primeiros quadros ficarem lentos (computador da sala fraco), reduz resolução e sombras
  let perfFrames = 0, perfTime = 0, lite = new URLSearchParams(location.search).has("leve");
  function goLite() {
    lite = true;
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;
    sun.castShadow = false;
    scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) m.needsUpdate = true; });
    resize();
    container.dataset.lite = "1";
  }
  if (lite) goLite();

  // ---------- animação ----------
  const tmp = new THREE.Matrix4();
  const col = new THREE.Color();
  const qI = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pt = new THREE.Vector3();
  const DOT = new THREE.Color(0xe8f7ff), BUBBLE = new THREE.Color(0xffffff);
  let last = performance.now(), infoT = 0, bubbleY = 0, colorT = 1, clock = 0;
  const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const shown = (o: THREE.Object3D | null): boolean => { for (; o; o = o.parent) if (!o.visible) return false; return true; };

  function paintTubes(s: SceneState) {
    const temps: Record<string, number> = { cold: s.tCold, mid: s.tMid, hot: s.tHot, ret: s.tCold + (s.tHot - s.tCold) * 0.15 };
    // pressão manométrica relativa à entrada da bomba: cai ao longo de cada trecho e em cada componente
    const tubeLoss = s.hyd.dpDist + s.hyd.dpLocal, total = Math.max(s.hyd.dpTotal, 1e-6);
    const lenSum = segs.reduce((a, g) => a + g.len, 0);
    const drops: Record<string, number> = { cold: s.hyd.dpComp * COMP_SHARE.cpu, mid: s.hyd.dpComp * COMP_SHARE.gpu, hot: s.hyd.dpComp * COMP_SHARE.rad, ret: 0 };
    let p = s.hyd.dpTotal;
    for (const seg of segs) {
      const attr = seg.core.geometry.attributes.color as THREE.BufferAttribute;
      const segLoss = tubeLoss * (seg.len / lenSum);
      const perRing = 13; // radialSegments + 1
      const rings = attr.count / perRing;
      for (let r = 0; r < rings; r++) {
        if (pressureOn) pressureToColor((p - segLoss * (r / (rings - 1))) / total, col);
        else tempToColor(temps[seg.key], col);
        for (let k = 0; k < perRing; k++) attr.setXYZ(r * perRing + k, col.r, col.g, col.b);
      }
      attr.needsUpdate = true;
      p -= segLoss + drops[seg.key];
    }
    const html = pressureOn
      ? `<b>Pressão (relativa à entrada da bomba)</b><i class="bar-p"></i><span>0 Pa</span><span>${fmt(s.hyd.dpTotal, 0)} Pa</span>`
      : `<b>Temperatura da água</b><i class="bar-t"></i><span>29 °C</span><span>43 °C</span>`;
    if (legend.innerHTML !== html) legend.innerHTML = html;
  }

  function frame(now: number) {
    requestAnimationFrame(frame);
    const raw = now - last;
    const dt = Math.min(raw / 1000, 0.1);
    last = now;
    if (!visible || !container.isConnected || !container.clientWidth) return;
    clock += dt;
    // só mede com a aba em primeiro plano (aba escondida desacelera de propósito)
    if (!lite && perfFrames < 180 && document.visibilityState === "visible" && raw < 250) {
      perfFrames++; perfTime += dt;
      if (perfFrames === 180 && perfTime / 180 > 1 / 22) goLite();
    }
    const s = getState();
    const moving = !reduce.matches;
    const flowing = s.hyd.q > 0.05;

    // escoamento: partículas na velocidade real (escala visual 12 cm/s por 0,1 m/s)
    const speed = s.hyd.v * 12;
    for (const seg of segs) {
      if (moving) seg.u = (seg.u + (speed * dt) / seg.len) % 1;
      const clogged = s.fault === "clog" && seg.key === "cold";
      for (let i = 0; i < seg.count; i++) {
        let u = (seg.u + i / seg.count) % 1;
        if (clogged) u = 1 - Math.pow(1 - u, 2.2); // as partículas se acumulam antes do bloco
        const isBubble = s.fault === "air" && i % 4 === 0;
        sc.setScalar(isBubble ? 2.4 : 1);
        tmp.compose(seg.curve.getPointAt(u, pt), qI, sc);
        seg.dots.setMatrixAt(i, tmp);
        seg.dots.setColorAt(i, isBubble ? BUBBLE : DOT);
      }
      seg.dots.instanceMatrix.needsUpdate = true;
      if (seg.dots.instanceColor) seg.dots.instanceColor.needsUpdate = true;
      seg.dots.visible = flowing;
      seg.group.visible = explode < 0.05;
    }
    colorT += dt;
    if (colorT > 0.15) { colorT = 0; paintTubes(s); }
    for (const [mesh, t] of [[cpuWater, (s.tCold + s.tMid) / 2], [gpuWater, (s.tMid + s.tHot) / 2], [resWater, s.tCold], [chSheet, (s.tCold + s.tMid) / 2]] as const) {
      const m = mesh.material as THREE.MeshStandardMaterial;
      tempToColor(t, col);
      m.color.copy(col);
      m.emissive.copy(col);
    }

    // chips quentes brilham em vermelho (pulsando perto do limite)
    for (const [mat, t] of [[cpuCopper, s.tCpu], [gpuCopper, s.tGpu]] as const) {
      const k = THREE.MathUtils.clamp((t - 70) / 25, 0, 1);
      const pulse = t > 90 && moving ? 0.75 + 0.25 * Math.sin(clock * 7) : 1;
      mat.emissive.setRGB(0.9, 0.12, 0.05);
      mat.emissiveIntensity = k * 1.4 * pulse;
    }
    clogMark.visible = s.fault === "clog";

    // peças girando na rotação do simulador
    if (moving) {
      rotor.rotation.y += (s.rpm / 4800) * 9 * dt;
      for (const r of fanRotors) r.rotation.z -= (s.fan / 100) * 12 * dt;
    }
    bubble.visible = s.fault === "air";
    if (bubble.visible) { bubbleY = moving ? (bubbleY + dt * 2) % 7 : 3; bubble.position.y = 0.8 + bubbleY; }

    // ar quente saindo do radiador
    air.visible = s.fan > 1 && !cutOn;
    if (air.visible && moving) {
      const vAir = 3 + (s.fan / 100) * 9;
      for (let i = 0; i < AIR_N; i++) {
        airPos[i * 3] += vAir * dt * (0.7 + airLife[i] * 0.6);
        airPos[i * 3 + 1] += dt * 0.6;
        if (airPos[i * 3] > 16) seedAir(i);
      }
      airGeo.attributes.position.needsUpdate = true;
    }
    tempToColor(27 + (s.tHot - 25) * 2, airMat.color); // cor exagerada para o ar quente aparecer

    // corte do bloco: a tampa some e aparece a água entre as aletas
    for (const m of cpuCover) m.visible = !cutOn;
    chDots.visible = chSheet.visible = cutOn && flowing;
    if (chDots.visible) {
      const zc = moving ? (clock * s.hyd.vChannel * 4) % 1 : 0;
      tempToColor((s.tCold + s.tMid) / 2, (chDots.material as THREE.MeshStandardMaterial).emissive);
      for (let g = 0; g < CH_GAPS; g++) for (let j = 0; j < CH_PER; j++) {
        const u = (zc + j / CH_PER + g * 0.137) % 1;
        tmp.makeTranslation((g - 4.5) * 0.42, 0.9, -2.4 + u * 4.8);
        chDots.setMatrixAt(g * CH_PER + j, tmp);
      }
      chDots.instanceMatrix.needsUpdate = true;
    }

    // perfil de velocidade: parábola no laminar, achatado no turbulento
    profile.visible = leader.visible = cutOn && explode < 0.05;
    if (profile.visible) {
      profile.quaternion.copy(camera.quaternion); // sempre de frente para quem assiste
      const target = s.hyd.re < 2300 ? 0 : s.hyd.re > 4000 ? 1 : (s.hyd.re - 2300) / 1700;
      profileShape += (target - profileShape) * Math.min(1, dt * 3);
      const tips = tipGeo.attributes.position as THREE.BufferAttribute;
      const scaleV = flowing ? Math.min(1, 0.35 + (s.hyd.v / 0.32) * 0.65) : 0;
      arrows.forEach(({ a, r }, i) => {
        const lam = 1 - r * r, tur = Math.pow(Math.max(0, 1 - Math.abs(r)), 1 / 7);
        const len = Math.max(0.02, PL * scaleV * ((1 - profileShape) * lam + profileShape * tur * 0.82));
        a.visible = flowing;
        a.setLength(len, Math.min(0.5, len * 0.45), 0.32);
        tips.setXYZ(i, -PL / 2 + len, r * PR, 0);
      });
      tips.needsUpdate = true;
      tipLine.visible = flowing;
    }

    // setas de calor (largura ∝ √W)
    heat.cpu.visible = heatOn && s.cpuW > 1;
    heat.gpu.visible = heatOn && s.gpuW > 1;
    heat.rad.visible = heatOn && s.radW > 1;
    for (const [g, w] of [[heat.cpu, s.cpuW], [heat.gpu, s.gpuW], [heat.rad, s.radW]] as const) {
      const k = 0.35 + Math.sqrt(Math.max(w, 0) / 250) * 0.75;
      g.scale.set(k, 1, k);
    }
    heatMat.emissiveIntensity = moving ? 0.45 + 0.15 * Math.sin(clock * 3) : 0.5;

    // vista explodida
    explode += (explodeTarget - explode) * Math.min(1, dt * 4);
    for (const [id, g] of parts) {
      const d = explodeDir[id];
      if (d) g.position.copy(base.get(id)!).addScaledVector(d, explode);
    }

    // voo da câmera
    if (fly) {
      fly.k = Math.min(1, fly.k + dt / 1.3);
      const e = ease(fly.k);
      camera.position.lerpVectors(fly.p0, fly.p1, e);
      controls.target.lerpVectors(fly.t0, fly.t1, e);
      if (fly.k >= 1) fly = null;
    }
    if (showcaseOn && !controls.autoRotate && !fly && now - lastTouch > 12000 && moving) { controls.autoRotate = true; syncButtons(); }

    // rótulos (um rótulo some junto com a peça escondida)
    labels.domElement.classList.toggle("cut", cutOn);
    labels.domElement.hidden = !showLabels && !container.closest(".mount"); // nas telas da apresentação ficam sempre ligados
    for (let i = 0; i < tagEls.length; i++) {
      const t = tagEls[i];
      const txt = t.fn(s);
      if (t.el.textContent !== txt) t.el.textContent = txt;
      tagObjs[i].visible = txt !== "" && shown(tagObjs[i].parent);
    }
    infoT += dt;
    if (selected && infoT > 0.25) { infoT = 0; renderInfo(); }

    controls.update(dt);
    renderer.render(scene, camera);
    labels.render(scene, camera);
  }
  requestAnimationFrame(frame);
  return { focus, setCut, setPressure, setHeat, showcase };
}
