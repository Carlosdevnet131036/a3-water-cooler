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
}

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

export function initScene3d(container: HTMLElement, getState: () => SceneState) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  // ---------- renderizadores ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
  controls.minDistance = 22;
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
  mesh(cpu, box(6.4, 0.7, 6.4), M.copper, 0, 0.35, 0);
  for (let i = -5; i <= 5; i++) mesh(cpu, box(0.12, 0.35, 4.8), M.copper, i * 0.42, 0.85, 0); // aletas dos microcanais
  mesh(cpu, cyl(3, 1.5), M.acrylic, 0, 1.45, 0);
  const cpuWater = mesh(cpu, cyl(2.7, 1.1), liquidMat.clone(), 0, 1.4, 0);
  mesh(cpu, new THREE.TorusGeometry(3, 0.18, 12, 48), M.chrome, 0, 2.2, 0).rotation.x = Math.PI / 2;
  mesh(cpu, cyl(0.55, 0.9, 20), M.chrome, -1.5, 2.6, 0);
  mesh(cpu, cyl(0.55, 0.9, 20), M.chrome, 1.5, 2.6, 0);

  // ---------- GPU ----------
  const gpu = part("gpu", new THREE.Vector3(2, 0.5, 8));
  mesh(gpu, box(27, 0.3, 11), M.darkPcb, 0, 1.0, 0);
  mesh(gpu, box(1.2, 4, 11.6), M.chrome, -14, 2.6, 0); // espelho
  mesh(gpu, box(23, 0.9, 9.4), M.black, 1, 1.6, 0);
  mesh(gpu, box(18, 0.25, 6.5), M.copper, 2, 2.15, 0);
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
    const core = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.5, 12),
      new THREE.MeshStandardMaterial({ color: COLD, roughness: 0.4, envMapIntensity: 0.1, emissive: COLD, emissiveIntensity: 0.12 }));
    core.castShadow = true;
    g.add(core, shell);
    const count = Math.max(5, Math.round(len / 2.2));
    const dots = new THREE.InstancedMesh(flowGeo, flowMat, count);
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
  tag(pump, v(0, -0.5, 4.5), (s) => `S4 · ${fmt(s.rpm, 0)} rpm`, "sensor");
  tag(cpu, v(0, 4, 0), (s) => `CPU ${fmt(s.tCpu, 0)} °C`);
  tag(gpu, v(6, 4, 0), (s) => `GPU ${fmt(s.tGpu, 0)} °C`);
  tag(rad, v(0, 16.5, 0), (s) => `Radiador · ventoinhas ${fmt(s.fan, 0)} %`);
  tag(res, v(0, 13.5, 0), () => "Bomba + reservatório");

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
  labels.domElement.hidden = !showLabels;
  function syncButtons() {
    btn("rotate").setAttribute("aria-pressed", String(controls.autoRotate));
    btn("explode").setAttribute("aria-pressed", String(explodeTarget === 1));
    btn("labels").setAttribute("aria-pressed", String(showLabels));
  }
  btn("rotate").addEventListener("click", () => { controls.autoRotate = !controls.autoRotate; syncButtons(); });
  btn("explode").addEventListener("click", () => { explodeTarget = explodeTarget ? 0 : 1; syncButtons(); });
  btn("labels").addEventListener("click", () => {
    showLabels = !showLabels;
    labels.domElement.hidden = !showLabels;
    syncButtons();
  });
  btn("reset").addEventListener("click", () => {
    camera.position.copy(HOME);
    controls.target.set(0, 4, 0);
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
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(container);

  // ---------- animação ----------
  const tmp = new THREE.Matrix4();
  const col = new THREE.Color();
  let last = performance.now(), infoT = 0, bubbleY = 0;
  function frame(now: number) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!visible) return;
    const s = getState();
    const moving = !reduce.matches;

    // escoamento: partículas na velocidade real (escala visual 12 cm/s por 0,1 m/s)
    const speed = s.hyd.v * 12;
    const temps: Record<string, number> = { cold: s.tCold, mid: s.tMid, hot: s.tHot, ret: s.tCold + (s.tHot - s.tCold) * 0.15 };
    for (const seg of segs) {
      if (moving) seg.u = (seg.u + (speed * dt) / seg.len) % 1;
      for (let i = 0; i < seg.count; i++) {
        const u = (seg.u + i / seg.count) % 1;
        tmp.makeTranslation(seg.curve.getPointAt(u));
        seg.dots.setMatrixAt(i, tmp);
      }
      seg.dots.instanceMatrix.needsUpdate = true;
      seg.dots.visible = s.hyd.q > 0.05;
      const m = seg.core.material as THREE.MeshStandardMaterial;
      tempToColor(temps[seg.key], m.color);
      m.emissive.copy(m.color);
      seg.group.visible = explode < 0.05;
    }
    for (const [mesh, t] of [[cpuWater, (s.tCold + s.tMid) / 2], [gpuWater, (s.tMid + s.tHot) / 2], [resWater, s.tCold]] as const) {
      const m = mesh.material as THREE.MeshStandardMaterial;
      tempToColor(t, col);
      m.color.copy(col);
      m.emissive.copy(col);
    }
    if (moving) {
      rotor.rotation.y += (s.rpm / 4800) * 9 * dt;
      for (const r of fanRotors) r.rotation.z -= (s.fan / 100) * 12 * dt;
    }
    bubble.visible = s.fault === "air";
    if (bubble.visible) { bubbleY = moving ? (bubbleY + dt * 2) % 7 : 3; bubble.position.y = 0.8 + bubbleY; }

    // vista explodida
    explode += (explodeTarget - explode) * Math.min(1, dt * 4);
    for (const [id, g] of parts) {
      const d = explodeDir[id];
      if (d) g.position.copy(base.get(id)!).addScaledVector(d, explode);
    }

    // rótulos
    for (const t of tagEls) {
      const txt = t.fn(s);
      if (t.el.textContent !== txt) t.el.textContent = txt;
    }
    infoT += dt;
    if (selected && infoT > 0.25) { infoT = 0; renderInfo(); }

    controls.update(dt);
    renderer.render(scene, camera);
    labels.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
