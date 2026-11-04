// Modelo físico do circuito. Os valores de referência reproduzem o exemplo
// numérico do relatório (1,5 L/min, 2.086 Pa com a bomba a 100 %).

export interface Fluid {
  id: string;
  name: string;
  rho: number; // kg/m³
  mu: number; // Pa·s
  cp: number; // J/(kg·K)
}

export const FLUIDS: Fluid[] = [
  { id: "agua", name: "Água destilada (35 °C)", rho: 994, mu: 0.72e-3, cp: 4178 },
  { id: "glicol", name: "Água + 30 % propilenoglicol", rho: 1025, mu: 1.6e-3, cp: 3800 },
];

export const GEO = {
  D: 0.01, // m, diâmetro interno da mangueira
  L: 1.2, // m, comprimento total
  K: 5.0, // soma dos coeficientes de perda localizada
  compRef: 1600, // Pa, bloco + radiador a 1,5 L/min (água)
  qRef: 1.5, // L/min
  pumpA: 2781, // Pa, pressão de shutoff da bomba a 100 %
  pumpQmax: 3.0, // L/min, vazão livre a 100 %
  channelArea: 40 * 0.5e-3 * 2e-3, // m², 40 microcanais de 0,5 × 2 mm
};

export type Fault = "none" | "stopped" | "air" | "clog";

export interface Hydraulics {
  q: number; // L/min
  qSI: number; // m³/s
  v: number; // m/s na mangueira
  vChannel: number; // m/s nos microcanais
  re: number;
  regime: "laminar" | "transição" | "turbulento";
  f: number;
  dpDist: number;
  dpLocal: number;
  dpComp: number;
  dpTotal: number;
  head: number; // m
  pHyd: number; // W
}

const AREA = (Math.PI * GEO.D ** 2) / 4;
const lpmToSI = (q: number) => q / 60000;

export function frictionFactor(re: number): number {
  if (re <= 0) return 0;
  if (re < 2300) return 64 / re;
  const blasius = (r: number) => 0.316 / Math.pow(r, 0.25);
  if (re >= 4000) return blasius(re);
  // transição: interpolação linear entre laminar (2300) e Blasius (4000)
  const t = (re - 2300) / 1700;
  return (64 / 2300) * (1 - t) + blasius(4000) * t;
}

export function systemLoss(qLpm: number, fluid: Fluid, fault: Fault) {
  const qSI = lpmToSI(qLpm);
  const v = qSI / AREA;
  const re = (fluid.rho * v * GEO.D) / fluid.mu;
  const f = frictionFactor(re);
  const dyn = (fluid.rho * v * v) / 2;
  const dpDist = f * (GEO.L / GEO.D) * dyn;
  const dpLocal = GEO.K * dyn;
  const viscFactor = Math.pow(fluid.mu / FLUIDS[0].mu, 0.25);
  const clog = fault === "clog" ? 5 : 1;
  const dpComp = GEO.compRef * (qLpm / GEO.qRef) ** 2 * viscFactor * clog;
  return { qSI, v, re, f, dpDist, dpLocal, dpComp, dpTotal: dpDist + dpLocal + dpComp };
}

/** Pressão fornecida pela bomba (Pa) para a vazão q (L/min) e rotação relativa n (0–1). */
export function pumpPressure(qLpm: number, n: number, fault: Fault): number {
  if (fault === "stopped" || n <= 0) return 0;
  const a = GEO.pumpA * (fault === "air" ? 0.07 : 1);
  return a * n * n - (a / GEO.pumpQmax ** 2) * qLpm * qLpm;
}

/** Ponto de operação: interseção da curva da bomba com a curva do sistema. */
export function solve(n: number, fluid: Fluid, fault: Fault): Hydraulics {
  let lo = 0;
  let hi = GEO.pumpQmax * Math.max(n, 0.01);
  if (pumpPressure(0, n, fault) <= 0) hi = 0;
  for (let i = 0; i < 60 && hi > 0; i++) {
    const mid = (lo + hi) / 2;
    if (pumpPressure(mid, n, fault) > systemLoss(mid, fluid, fault).dpTotal) lo = mid;
    else hi = mid;
  }
  const q = (lo + hi) / 2;
  const s = systemLoss(q, fluid, fault);
  return {
    q,
    qSI: s.qSI,
    v: s.v,
    vChannel: s.qSI / GEO.channelArea,
    re: s.re,
    regime: s.re < 2300 ? "laminar" : s.re < 4000 ? "transição" : "turbulento",
    f: s.f,
    dpDist: s.dpDist,
    dpLocal: s.dpLocal,
    dpComp: s.dpComp,
    dpTotal: s.dpTotal,
    head: s.dpTotal / (fluid.rho * 9.81),
    pHyd: s.dpTotal * s.qSI,
  };
}

// ---------- modelo térmico simplificado (ilustrativo) ----------
export const T_AMB = 25;

export interface ThermalTargets {
  tCold: number;
  tMid: number;
  tHot: number;
  tCpu: number;
  tGpu: number;
  dtWater: number;
}

export function thermalTargets(pCpu: number, pGpu: number, qLpm: number, fan: number, fluid: Fluid): ThermalTargets {
  const mdot = fluid.rho * lpmToSI(Math.max(qLpm, 0.02));
  const gRad = 12 + 38 * Math.pow(Math.max(fan, 0), 0.7); // W/K
  const total = pCpu + pGpu;
  const tCold = T_AMB + total / gRad;
  const dCpu = pCpu / (mdot * fluid.cp);
  const dGpu = pGpu / (mdot * fluid.cp);
  const rBlock = 0.05 + 0.03 * Math.pow(GEO.qRef / Math.max(qLpm, 0.02), 0.8);
  const tMid = tCold + dCpu;
  const tHot = tMid + dGpu;
  return {
    tCold,
    tMid: Math.min(tMid, 110),
    tHot: Math.min(tHot, 110),
    tCpu: (tCold + Math.min(tMid, 110)) / 2 + pCpu * rBlock,
    tGpu: (Math.min(tMid, 110) + Math.min(tHot, 110)) / 2 + pGpu * rBlock * 0.6,
    dtWater: dCpu + dGpu,
  };
}
