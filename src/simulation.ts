import { FLUIDS, solve, thermalTargets } from "./model";
import type { Fault, Fluid, Hydraulics } from "./model";
import { diagnose } from "./diagnostics";
import type { Diagnosis } from "./diagnostics";

export interface Inputs {
  pump: number; fan: number; cpu: number; gpu: number;
  fluid: Fluid; fault: Fault; mode: "manual" | "auto"; diag: boolean;
}
export interface Simulation {
  time: number; tCold: number; tMid: number; tHot: number; tCpu: number; tGpu: number;
  power: number; pumpEff: number; fanEff: number; rpm: number;
  alarm: "" | "rpm" | "flow"; throttling: boolean; recoveryUntil: number;
  hyd: Hydraulics; diagnosis: Diagnosis;
}
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const referenceInputs = (): Inputs => ({ pump: 100, fan: 100, cpu: 250, gpu: 0,
  fluid: FLUIDS[0], fault: "none", mode: "manual", diag: true });

/** Estado térmico inicial comum: circuito saudável com bomba e ventoinhas a 100 %. */
export function createSimulation(i: Inputs): Simulation {
  const hyd = solve(1, i.fluid, "none");
  const t = thermalTargets(i.cpu, i.gpu, hyd.q, 1, i.fluid);
  const s: Simulation = { ...t, time: 0, power: 1, pumpEff: 100, fanEff: 100, rpm: 4800,
    alarm: "", throttling: false, recoveryUntil: 0, hyd,
    diagnosis: diagnose({ enabled: i.diag, q: hyd.q, rpm: 4800, delta: t.dtWater,
      expectedDelta: t.dtWater, recovering: false, throttling: false }) };
  advanceSimulation(i, s, 0);
  return s;
}

export function refreshDiagnostic(i: Inputs, s: Simulation) {
  const expected = thermalTargets(i.cpu * s.power, i.gpu * s.power, s.hyd.q, s.fanEff / 100, i.fluid);
  s.diagnosis = diagnose({ enabled: i.diag, q: s.hyd.q, rpm: s.rpm,
    delta: s.tHot - s.tCold, expectedDelta: expected.dtWater,
    recovering: s.time < s.recoveryUntil, throttling: s.throttling });
  if (s.alarm && !s.diagnosis.protect) s.diagnosis = {
    state: s.alarm, label: "Proteção ativa: falha de circulação detectada", protect: true, warning: false,
    message: "O diagnóstico detectou uma falha de circulação e manteve PWM em 100 % e carga reduzida. Ajuste os controles ou reinicie o experimento para reavaliar a condição.",
  };
  if (s.throttling && s.diagnosis.protect) s.diagnosis.message += " A proteção térmica do chip também está ativa e pode reduzir a carga ainda mais.";
}

/** Mesmo integrador para a bancada, apresentação e comparação de ensaios. */
export function advanceSimulation(i: Inputs, s: Simulation, dt: number) {
  s.time += dt;
  const auto = i.mode === "auto";
  let pump = auto ? clamp(40 + (s.tHot - 30) * 6, 40, 100) : i.pump;
  let fan = auto ? clamp(30 + (s.tHot - 30) * 5, 30, 100) : i.fan;
  if (!i.diag) s.alarm = "";
  if (s.alarm) pump = fan = 100;
  s.hyd = solve(pump / 100, i.fluid, i.fault);
  s.rpm = i.fault === "stopped" ? 0 : 4800 * pump / 100 * (i.fault === "air" ? 1.06 : 1);
  if (i.diag && (s.rpm < 1 || s.hyd.q < 0.5)) s.alarm = s.rpm < 1 ? "rpm" : "flow";
  if (s.alarm) {
    pump = fan = 100;
    s.hyd = solve(1, i.fluid, i.fault);
    s.rpm = i.fault === "stopped" ? 0 : 4800 * (i.fault === "air" ? 1.06 : 1);
  }
  s.pumpEff = pump; s.fanEff = fan;
  const target = s.alarm ? 0.35 : 1;
  const tMax = Math.max(s.tCpu, s.tGpu);
  s.throttling = s.throttling ? tMax >= 90 : tMax >= 99;
  if (s.throttling) s.power = clamp(s.power - (tMax - 96) * 0.08 * dt, 0.15, 1);
  else s.power += (target - s.power) * clamp(dt * (target < s.power ? 3 : 0.4), 0, 1);
  const t = thermalTargets(i.cpu * s.power, i.gpu * s.power, s.hyd.q, fan / 100, i.fluid);
  const kw = clamp(dt / 10, 0, 1), kc = clamp(dt / 2.2, 0, 1);
  s.tCold += (t.tCold - s.tCold) * kw;
  s.tMid += (t.tMid - s.tMid) * kw;
  s.tHot += (t.tHot - s.tHot) * kw;
  s.tCpu += (t.tCpu - s.tCpu) * kc;
  s.tGpu += (t.tGpu - s.tGpu) * kc;
  refreshDiagnostic(i, s);
}
