import "./style.css";
import { FLUIDS, GEO, T_AMB, solve, systemLoss, pumpPressure } from "./model";
import type { Fault } from "./model";
import { QUIZ } from "./quiz";
import { referenceInputs, createSimulation, advanceSimulation } from "./simulation";
import { renderCalculations } from "./calculations";
import { renderHistory, runComparison } from "./history";
import type { Sample, SimEvent } from "./history";
import { initScene3d } from "./scene3d";
import { initPresentation } from "./presentation";
import type { Scenario } from "./presentation";

// ---------- utilidades ----------
const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const $$ = <T extends Element = HTMLElement>(sel: string) => Array.from(document.querySelectorAll(sel)) as T[];
const nf = (min: number, max = min) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: min, maximumFractionDigits: max });
const F0 = nf(0), F1 = nf(1), F2 = nf(2), F3 = nf(3), F4 = nf(4);
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const setText = (sel: string, text: string) => { const el = $(sel); if (el.textContent !== text) el.textContent = text; };
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

// ---------- estado ----------
const input = referenceInputs();
const sim = createSimulation(input);
let hyd = sim.hyd;
let paused = false;

// ---------- controles ----------
const pumpIn = $<HTMLInputElement>("#pump");
const fanIn = $<HTMLInputElement>("#fan");
const cpuIn = $<HTMLInputElement>("#cpu");
const gpuIn = $<HTMLInputElement>("#gpu");
const fluidSel = $<HTMLSelectElement>("#fluid");
const diagIn = $<HTMLInputElement>("#diag");

for (const f of FLUIDS) fluidSel.add(new Option(f.name, f.id));

// controles compactos da seção 3D espelham os da bancada
const p3Pump = $<HTMLInputElement>("#p3Pump");
const p3Cpu = $<HTMLInputElement>("#p3Cpu");
p3Pump.addEventListener("input", () => { pumpIn.value = p3Pump.value; readInputs(); });
p3Cpu.addEventListener("input", () => { cpuIn.value = p3Cpu.value; readInputs(); });

function readInputs() {
  const previousFault = input.fault;
  const previousDiag = input.diag;
  input.pump = +pumpIn.value;
  input.fan = +fanIn.value;
  input.cpu = +cpuIn.value;
  input.gpu = +gpuIn.value;
  input.fluid = FLUIDS.find((f) => f.id === fluidSel.value) ?? FLUIDS[0];
  input.mode = ($<HTMLInputElement>("#modeAuto").checked ? "auto" : "manual");
  input.fault = ($<HTMLInputElement>('input[name="fault"]:checked').value as Fault);
  input.diag = diagIn.checked;
  sim.alarm = "";
  if (previousFault !== "none" && input.fault === "none") sim.recoveryUntil = sim.time + 40;
  pumpIn.disabled = fanIn.disabled = input.mode === "auto";
  if (previousFault !== input.fault) addEvent(`Falha: ${faultName(input.fault)}`);
  if (previousDiag !== input.diag) addEvent(`Diagnóstico ${input.diag ? "ligado" : "desligado"}`);
  advanceSimulation(input, sim, 0);
  hyd = sim.hyd;
  setText("#cpuOut", `${input.cpu} W`);
  setText("#gpuOut", `${input.gpu} W`);
  p3Pump.disabled = input.mode === "auto";
  if (document.activeElement !== p3Cpu) p3Cpu.value = cpuIn.value;
  setText("#p3CpuOut", `${input.cpu} W`);
  $$<HTMLButtonElement>(".fault-card").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.fault === input.fault)));
  updateText();
  if (previousFault !== input.fault || previousDiag !== input.diag) recordSample();
}
$("#controls").addEventListener("input", readInputs);
$("#controls").addEventListener("change", readInputs);
$("#controls").addEventListener("submit", (e) => e.preventDefault());

function setFault(f: Fault) {
  $<HTMLInputElement>(`input[name="fault"][value="${f}"]`).checked = true;
  readInputs();
}
$$<HTMLButtonElement>(".fault-card").forEach((b) =>
  b.addEventListener("click", () => {
    setFault(b.dataset.fault as Fault);
    $("#bancada").scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth" });
  }),
);

const PRESETS: Record<string, Partial<{ pump: number; fan: number; cpu: number; gpu: number }>> = {
  ref: { pump: 100, fan: 100, cpu: 250, gpu: 0 },
  pwm70: { pump: 70, fan: 100, cpu: 250, gpu: 0 },
  max: { pump: 100, fan: 100, cpu: 300, gpu: 400 },
};
$$<HTMLButtonElement>("[data-preset]").forEach((b) =>
  b.addEventListener("click", () => {
    const p = PRESETS[b.dataset.preset ?? "ref"];
    pumpIn.value = String(p.pump); fanIn.value = String(p.fan);
    cpuIn.value = String(p.cpu); gpuIn.value = String(p.gpu);
    fluidSel.value = "agua";
    $<HTMLInputElement>("#modeManual").checked = true;
    setFault("none");
    resetExperiment();
  }),
);

// ---------- simulação ----------
function step(dt: number) {
  advanceSimulation(input, sim, dt);
  hyd = sim.hyd;
  if (input.mode === "auto") {
    pumpIn.value = String(Math.round(sim.pumpEff));
    fanIn.value = String(Math.round(sim.fanEff));
  }
}

// ---------- cores pela temperatura ----------
let COLD = [10, 143, 176], HOT = [210, 73, 42];
function readPalette() {
  const cs = getComputedStyle(document.documentElement);
  const hex = (v: string) => { const h = v.trim().replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  COLD = hex(cs.getPropertyValue("--cold"));
  HOT = hex(cs.getPropertyValue("--hot"));
}
const tempColor = (t: number) => {
  const k = clamp((t - 28) / 22, 0, 1);
  const c = COLD.map((v, i) => Math.round(v + (HOT[i] - v) * k));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
};
readPalette();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readPalette);
new MutationObserver(readPalette).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

// ---------- ilustração animada ----------
const SVGNS = "http://www.w3.org/2000/svg";
const fans = $$<SVGGElement>(".fan");
for (const g of fans) {
  const cx = +(g.dataset.cx ?? 0), cy = +(g.dataset.cy ?? 0);
  const blades = g.querySelector(".blades") as SVGGElement;
  for (let i = 0; i < 7; i++) {
    const p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", `M${cx} ${cy} q 10 -14 4 -26 q -12 4 -8 26 z`);
    p.setAttribute("transform", `rotate(${(360 / 7) * i} ${cx} ${cy})`);
    blades.appendChild(p);
  }
  const hub = document.createElementNS(SVGNS, "circle");
  hub.setAttribute("cx", String(cx)); hub.setAttribute("cy", String(cy)); hub.setAttribute("r", "6");
  hub.setAttribute("fill", "var(--ink)");
  g.appendChild(hub);
}
const tubes = ["#t1", "#t2", "#t3", "#t4", "#t5"].map((s) => $<SVGPathElement>(s));
const flows = $$<SVGPathElement>(".flow");
const rotor = $<SVGGElement>("#pumpRotor");
const bubble = $<SVGEllipseElement>("#bubble");
let dash = 0, rotorAng = 0, fanAng = 0, bubbleY = 0;

function animateLoop(dt: number) {
  const moving = !reduceMotion.matches;
  if (moving) {
    dash -= hyd.v * 140 * dt;
    rotorAng = (rotorAng + (sim.rpm / 4800) * 420 * dt) % 360;
    fanAng = (fanAng + (sim.fanEff / 100) * 600 * dt) % 360;
  }
  for (const f of flows) {
    f.style.strokeDashoffset = String(dash);
    f.style.opacity = hyd.q < 0.05 ? "0" : "1";
  }
  rotor.setAttribute("transform", `rotate(${rotorAng} 75 112)`);
  for (const g of fans) {
    const blades = g.querySelector(".blades") as SVGGElement;
    blades.setAttribute("transform", `rotate(${fanAng} ${g.dataset.cx} ${g.dataset.cy})`);
  }
  // tubos: frio antes dos blocos, morno entre CPU e GPU, quente até o radiador
  const temps = [sim.tCold, sim.tCold, sim.tMid, sim.tHot, sim.tCold + (sim.tHot - sim.tCold) * 0.15];
  tubes.forEach((t, i) => (t.style.stroke = tempColor(temps[i])));
  $<SVGRectElement>("#cpuGlow").setAttribute("opacity", String(clamp((sim.tCpu - 35) / 60, 0.08, 1)));
  $<SVGRectElement>("#gpuGlow").setAttribute("opacity", String(clamp((sim.tGpu - 35) / 60, 0.08, 1)));
  if (input.fault === "air") {
    bubbleY = moving ? (bubbleY + dt * 30) % 90 : 40;
    bubble.setAttribute("cy", String(368 - bubbleY));
    bubble.setAttribute("opacity", "0.9");
  } else bubble.setAttribute("opacity", "0");
}

// ---------- Reynolds: partículas na mangueira ----------
const canvas = $<HTMLCanvasElement>("#reCanvas");
const ctx = canvas.getContext("2d")!;
interface P { x: number; y: number; }
const parts: P[] = Array.from({ length: 160 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * 2 - 1 }));
function turbulence(re: number) { return clamp((re - 2300) / 1700, 0, 1); }
function drawReynolds(dt: number) {
  const W = canvas.width, H = canvas.height, pad = 30, r = (H - 2 * pad) / 2, cy = H / 2;
  const cs = getComputedStyle(document.documentElement);
  const bg = cs.getPropertyValue("--glass").trim();
  const ink = cs.getPropertyValue("--line-strong").trim();
  const tb = turbulence(hyd.re);
  ctx.globalAlpha = reduceMotion.matches ? 1 : 0.28;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = ink; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, pad - 2); ctx.lineTo(W, pad - 2); ctx.moveTo(0, H - pad + 2); ctx.lineTo(W, H - pad + 2); ctx.stroke();
  const umax = hyd.v * 520;
  ctx.fillStyle = tempColor(sim.tCold + (sim.tHot - sim.tCold) * 0.5);
  for (const p of parts) {
    const prof = tb > 0 ? (1 - tb) * (1 - p.y * p.y) + tb * Math.pow(1 - Math.abs(p.y), 1 / 7) : 1 - p.y * p.y;
    if (!reduceMotion.matches && dt > 0) {
      p.x += umax * prof * dt * (1 + tb * (Math.random() - 0.5) * 0.6);
      p.y += tb * (Math.random() - 0.5) * 0.35 * Math.min(1, hyd.v * 4);
      if (p.y > 0.98) p.y = 1.96 - p.y;
      if (p.y < -0.98) p.y = -1.96 - p.y;
      if (p.x > W) { p.x -= W; p.y = Math.random() * 2 - 1; }
    }
    ctx.beginPath();
    ctx.arc(p.x, cy + p.y * r, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- gráfico: bomba × sistema ----------
const chart = $<SVGSVGElement>("#chart");
const CH = { x0: 56, y0: 300, w: 470, h: 270, qMax: 3, pMax: 3200 };
const sx = (q: number) => CH.x0 + (q / CH.qMax) * CH.w;
const sy = (p: number) => CH.y0 - (clamp(p, 0, CH.pMax) / CH.pMax) * CH.h;
function drawChart() {
  const n = sim.pumpEff / 100;
  const pts = (fn: (q: number) => number, qEnd = CH.qMax) => {
    const out: string[] = [];
    for (let i = 0; i <= 60; i++) {
      const q = (qEnd * i) / 60;
      const p = fn(q);
      if (p < 0 || p > CH.pMax) break;
      out.push(`${i ? "L" : "M"}${sx(q).toFixed(1)} ${sy(p).toFixed(1)}`);
    }
    return out.join(" ");
  };
  let g = "";
  for (let p = 0; p <= CH.pMax; p += 500) {
    g += `<line class="grid" x1="${CH.x0}" x2="${CH.x0 + CH.w}" y1="${sy(p)}" y2="${sy(p)}"/>`;
    g += `<text x="${CH.x0 - 8}" y="${sy(p) + 4}" text-anchor="end">${F0.format(p)}</text>`;
  }
  for (let q = 0; q <= CH.qMax; q += 0.5) {
    g += `<text x="${sx(q)}" y="${CH.y0 + 18}" text-anchor="middle">${F1.format(q)}</text>`;
  }
  g += `<line class="axis" x1="${CH.x0}" x2="${CH.x0 + CH.w}" y1="${CH.y0}" y2="${CH.y0}"/>`;
  g += `<line class="axis" x1="${CH.x0}" x2="${CH.x0}" y1="${CH.y0}" y2="${CH.y0 - CH.h}"/>`;
  g += `<text x="${CH.x0 + CH.w / 2}" y="${CH.y0 + 36}" text-anchor="middle">Vazão Q (L/min)</text>`;
  g += `<text x="14" y="${CH.y0 - CH.h / 2}" text-anchor="middle" transform="rotate(-90 14 ${CH.y0 - CH.h / 2})">Pressão (Pa)</text>`;
  g += `<path class="pump100" d="${pts((q) => pumpPressure(q, 1, "none"))}"/>`;
  g += `<path class="pump" d="${pts((q) => pumpPressure(q, n, input.fault))}"/>`;
  g += `<path class="sys" d="${pts((q) => systemLoss(q, input.fluid, input.fault).dpTotal)}"/>`;
  const ox = sx(hyd.q), oy = sy(hyd.dpTotal);
  g += `<circle class="op" cx="${ox}" cy="${oy}" r="7"/>`;
  const lx = clamp(ox + 12, CH.x0 + 4, CH.x0 + CH.w - 150);
  g += `<text class="op-label" x="${lx}" y="${oy - 14}">${F2.format(hyd.q)} L/min · ${F0.format(hyd.dpTotal)} Pa</text>`;
  g += `<g transform="translate(${CH.x0 + 14} ${CH.y0 - CH.h + 6})">
    <line class="sys" x1="0" x2="22" y1="0" y2="0"/><text x="28" y="4">Sistema</text>
    <line class="pump" x1="92" x2="114" y1="0" y2="0"/><text x="120" y="4">Bomba a ${F0.format(sim.pumpEff)} %</text>
    <line class="pump100" x1="0" x2="22" y1="18" y2="18"/><text x="28" y="22">Referência saudável 100 %</text></g>`;
  chart.innerHTML = g;
}

// ---------- PWM ----------
function pwmPath(duty: number) {
  const per = 75, hi = 8, lo = 42, d = clamp(duty / 100, 0, 1) * per;
  let s = `M0 ${lo}`;
  for (let i = 0; i < 4; i++) {
    const x = i * per;
    if (d <= 0) { s += ` L${x + per} ${lo}`; continue; }
    if (d >= per) { s += ` L${x} ${hi} L${x + per} ${hi}`; continue; }
    s += ` L${x} ${hi} L${x + d} ${hi} L${x + d} ${lo} L${x + per} ${lo}`;
  }
  return `<path d="${s}"/>`;
}

// ---------- textos e leituras ----------
const logRows: string[] = [];
let lastLog = -1, cycleStep = 0, cycleT = 0;

function updateText() {
  const fl = input.fluid;
  setText("#pumpOut", `${Math.round(sim.pumpEff)} %`);
  setText("#p3PumpOut", `${Math.round(sim.pumpEff)} %`);
  if (document.activeElement !== p3Pump) p3Pump.value = String(Math.round(sim.pumpEff));
  setText("#fanOut", `${Math.round(sim.fanEff)} %`);
  setText("#gQ", F2.format(hyd.q));
  setText("#gRe", F0.format(hyd.re));
  const chip = $("#gRegime");
  setText("#gRegime", hyd.regime);
  chip.className = "chip " + (hyd.regime === "laminar" ? "laminar" : hyd.regime === "transição" ? "transicao" : "");
  setText("#gDp", F0.format(hyd.dpTotal));
  setText("#gP", F3.format(hyd.pHyd));
  setText("#gDt", F1.format(Math.max(0, sim.tHot - sim.tCold)));
  setText("#gCpu", F0.format(sim.tCpu));
  $("#gCpu").classList.toggle("g-hot", sim.tCpu >= 85);
  const bar = $("#gCpuBar");
  bar.style.width = `${clamp(((sim.tCpu - T_AMB) / (100 - T_AMB)) * 100, 2, 100)}%`;
  bar.style.background = tempColor(sim.tCpu - 30);

  setText("#cpuTempTxt", `CPU ${F0.format(sim.tCpu)} °C`);
  setText("#gpuTempTxt", `GPU ${F0.format(sim.tGpu)} °C`);
  setText("#s1Txt", `${F2.format(hyd.q)} L/min`);
  setText("#s2Txt", `${F1.format(sim.tHot)} °C`);
  setText("#s3Txt", `${F1.format(sim.tCold)} °C`);
  setText("#s4Txt", `${F0.format(sim.rpm)} rpm`);
  const sensors = $$<SVGGElement>(".sensor");
  sensors[0].classList.toggle("bad", hyd.q < 0.5);
  sensors[3].classList.toggle("bad", sim.rpm < 1);

  // alerta
  const alert = $("#alert");
  const diagnosis = sim.diagnosis;
  alert.hidden = !diagnosis.message;
  setText("#alert", diagnosis.message);
  alert.classList.toggle("warn", diagnosis.warning);
  setText("#experimentStatus", `${paused ? "Pausado" : "Em execução"} · ${F0.format(sim.time)} s`);

  // conceitos
  setText("#cRho", F0.format(fl.rho));
  setText("#cMu", F2.format(fl.mu * 1000));
  setText("#cV", F2.format(hyd.v));
  setText("#cVc", F2.format(hyd.vChannel));
  setText("#cRe", F0.format(hyd.re));
  setText("#cF", hyd.f ? F4.format(hyd.f) : "—");
  setText("#cDd", F0.format(hyd.dpDist));
  setText("#cDl", F0.format(hyd.dpLocal));
  $<HTMLElement>(".pipe.wide").style.setProperty("--dur", `${clamp(0.06 / Math.max(hyd.v, 0.005), 0.05, 20)}s`);
  $<HTMLElement>(".pipe.narrow").style.setProperty("--dur", `${clamp(0.06 / Math.max(hyd.vChannel, 0.005), 0.05, 20)}s`);
  $$(".pipe").forEach(p => p.classList.toggle("paused", paused || hyd.q === 0));
  setText("#reCaption", `V = ${F2.format(hyd.v)} m/s · Re ≈ ${F0.format(hyd.re)} · ${hyd.regime}`);
  const pos = clamp(hyd.re / 6000, 0, 1);
  $("#reMarker").style.left = `${pos * 100}%`;

  // curvas
  const tot = Math.max(hyd.dpTotal, 1);
  const stack = $$<HTMLElement>("#stack i");
  [hyd.dpDist, hyd.dpLocal, hyd.dpComp].forEach((v, i) => (stack[i].style.flex = `0 0 ${(v / tot) * 100}%`));
  setText("#lDist", `${F0.format(hyd.dpDist)} Pa`);
  setText("#lLoc", `${F0.format(hyd.dpLocal)} Pa`);
  setText("#lComp", `${F0.format(hyd.dpComp)} Pa`);
  const ref = solve(1, fl, "none");
  const ratio = ref.pHyd > 0 ? hyd.pHyd / ref.pHyd : 0;
  setText("#affText", input.fault !== "none"
    ? "Há uma falha ativa: compare a curva atual com a referência saudável. As leis de semelhança isoladas não descrevem uma mudança de falha."
    : sim.pumpEff >= 99.5
    ? `Com a bomba a 100 %, a vazão é ${F2.format(hyd.q)} L/min e a potência hidráulica é ${F3.format(hyd.pHyd)} W. Baixe o PWM para ver as leis em ação.`
    : `Com a bomba a ${F0.format(sim.pumpEff)} %, a vazão é ${F0.format((hyd.q / Math.max(ref.q, 1e-6)) * 100)} % da vazão a 100 % e a potência hidráulica cai para ${F0.format(ratio * 100)} % (${F3.format(hyd.pHyd)} W).`);
  drawChart();

  // controle
  setText("#stepRead", `S1 ${F2.format(hyd.q)} L/min · S2 ${F1.format(sim.tHot)} °C · S3 ${F1.format(sim.tCold)} °C · S4 ${F0.format(sim.rpm)} rpm`);
  setText("#stepProc", `ΔT = S2 − S3 = ${F1.format(Math.max(0, sim.tHot - sim.tCold))} K`);
  setText("#stepCheck", sim.diagnosis.label);
  setText("#stepCurve", sim.alarm ? "falha detectada: bomba e ventoinhas em 100 %"
    : input.mode === "auto" ? `curva pela T da água (${F1.format(sim.tHot)} °C): bomba ${F0.format(sim.pumpEff)} %, ventoinhas ${F0.format(sim.fanEff)} %`
    : `manual: bomba ${F0.format(sim.pumpEff)} %, ventoinhas ${F0.format(sim.fanEff)} %`);
  $("#pwmPump").innerHTML = pwmPath(sim.pumpEff);
  $("#pwmFan").innerHTML = pwmPath(sim.fanEff);
  setText("#pwmPumpTxt", `${F0.format(sim.pumpEff)} %`);
  setText("#pwmFanTxt", `${F0.format(sim.fanEff)} %`);
  renderCalculations(input, sim);
}

function updateCycle(dt: number) {
  cycleT += dt;
  if (cycleT > 0.45) { cycleT = 0; cycleStep = (cycleStep + 1) % 5; }
  $$<HTMLLIElement>("#cycle li").forEach((li, i) => {
    li.classList.toggle("on", i === cycleStep);
    li.classList.toggle("alarm", i === 2 && !!sim.alarm);
  });
  const sec = Math.floor(sim.time);
  if (sec !== lastLog) {
    recordSample();
    lastLog = sec;
  }
}

// ---------- experimentos e registro ----------
const samples: Sample[] = [];
const events: SimEvent[] = [];
let lastDiagnosis = sim.diagnosis.state;
const faultName = (f: Fault) => ({ none: "retirada / circuito normal", stopped: "bomba parada", air: "ar no circuito", clog: "microcanais entupidos" })[f];
function addEvent(label: string) {
  events.push({ time: sim.time, label });
  if (events.length > 100) events.shift();
}
function recordSample() {
  if (sim.diagnosis.state !== lastDiagnosis) {
    addEvent(sim.diagnosis.label);
    lastDiagnosis = sim.diagnosis.state;
  }
  samples.push({ time: sim.time, q: hyd.q, water: sim.tHot, cold: sim.tCold, cpu: sim.tCpu, gpu: sim.tGpu,
    pump: sim.pumpEff, fan: sim.fanEff, rpm: sim.rpm, power: sim.power,
    fault: input.fault, diagnosis: sim.diagnosis.label });
  if (samples.length > 1800) samples.shift();
  logRows.unshift(`<tr><td>${F1.format(sim.time)}</td><td class="${hyd.q < 0.5 ? "bad" : ""}">${F2.format(hyd.q)}</td><td>${F1.format(sim.tHot)}</td><td class="${sim.tCpu >= 90 ? "bad" : ""}">${F0.format(sim.tCpu)}</td><td>${F0.format(sim.pumpEff)} %</td></tr>`);
  if (logRows.length > 6) logRows.pop();
  $("#logBody").innerHTML = logRows.join("");
  renderHistory(samples, events);
}
function clearHistory() {
  samples.length = events.length = logRows.length = 0;
  lastLog = -1;
  $("#logBody").innerHTML = "";
  addEvent("Início do registro");
  recordSample();
  lastLog = Math.floor(sim.time);
}
function resetExperiment() {
  Object.assign(sim, createSimulation(input));
  hyd = sim.hyd;
  lastDiagnosis = sim.diagnosis.state;
  cycleT = cycleStep = 0;
  dash = rotorAng = fanAng = bubbleY = 0;
  clearHistory();
  updateText();
}
function togglePause() {
  paused = !paused;
  setText("#pause", paused ? "Retomar" : "Pausar");
  updateText();
}
$("#pause").addEventListener("click", togglePause);
$("#reset").addEventListener("click", resetExperiment);
$("#clearHistory").addEventListener("click", clearHistory);
$("#runComparison").addEventListener("click", () => runComparison($<HTMLSelectElement>("#comparison").value));
$("#exportCsv").addEventListener("click", () => {
  const quote = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
  const rows: unknown[][] = [["tempo_s", "vazao_L_min", "agua_quente_C", "agua_fria_C", "CPU_C", "GPU_C", "PWM_bomba_pct", "PWM_ventoinhas_pct", "RPM", "fator_carga", "falha", "diagnostico", "eventos"]];
  samples.forEach((s, idx) => rows.push([s.time.toFixed(2), s.q, s.water, s.cold, s.cpu, s.gpu, s.pump, s.fan, s.rpm, s.power, s.fault, s.diagnosis,
    events.filter(e => e.time <= s.time && e.time > (samples[idx - 1]?.time ?? -1)).map(e => e.label).join(" | ")]));
  const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map(r => r.map(quote).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "water-cooler-experimento.csv";
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// Cada indicador leva à respectiva memória de cálculo por teclado ou mouse.
["q", "re", "dp", "p", "dt", "cpu"].forEach((id, idx) => {
  const button = document.createElement("button");
  button.type = "button"; button.className = "calc-link"; button.textContent = "Ver cálculo";
  button.setAttribute("aria-controls", `calc-${id}`);
  const names = ["vazão", "Reynolds", "perda de carga", "potência hidráulica", "ΔT da água", "temperatura da CPU"];
  button.setAttribute("aria-label", `Ver cálculo de ${names[idx]}`);
  button.addEventListener("click", () => {
    const details = $<HTMLDetailsElement>(`#calc-${id}`); details.open = true;
    renderCalculations(input, sim);
    details.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "center" });
    details.querySelector("summary")!.focus({ preventScroll: true });
  });
  $$(".gauge")[idx].appendChild(button);
});

// ---------- cenários usados pelo modo apresentação ----------
// Cada cenário parte das mesmas condições térmicas: água, CPU 250 W, GPU 0 W, ventoinhas 100 %.
function applyScenario(name: Scenario) {
  pumpIn.value = name === "pwm70" ? "70" : "100"; fanIn.value = "100";
  cpuIn.value = "250"; gpuIn.value = "0"; fluidSel.value = "agua";
  $<HTMLInputElement>("#modeManual").checked = true;
  diagIn.checked = name !== "stoppedNoDiag";
  setFault(name === "stoppedNoDiag" || name === "stoppedDiag" ? "stopped" : "none");
  if (paused) togglePause();
  resetExperiment();
}

// ---------- quiz ----------
const quizList = $("#quizList");
quizList.innerHTML = QUIZ.map((q, i) =>
  `<details id="q${i}"><summary>${q.q}</summary><p>${q.a}</p><span class="who">${q.topic}</span></details>`).join("");
const opened = new Set<number>();
quizList.addEventListener("toggle", (e) => {
  const d = e.target as HTMLDetailsElement;
  if (d.open) opened.add(+d.id.slice(1));
  setText("#quizScore", `${opened.size} de ${QUIZ.length} abertas`);
}, true);

// ---------- laço principal ----------
readInputs();
clearHistory();
let last = performance.now(), textT = 1;
function frame(now: number) {
  const dt = clamp((now - last) / 1000, 0, 0.1);
  last = now;
  if (!paused) step(dt);
  animateLoop(paused ? 0 : dt);
  drawReynolds(paused ? 0 : dt);
  if (!paused) updateCycle(dt);
  textT += dt;
  if (textT > 0.1) { textT = 0; updateText(); }
  requestAnimationFrame(frame);
}
updateText();
requestAnimationFrame(frame);

const scene3d = initScene3d($("#scene3d"), () => ({
  hyd, tCold: sim.tCold, tMid: sim.tMid, tHot: sim.tHot, tCpu: sim.tCpu, tGpu: sim.tGpu,
  rpm: sim.rpm, pump: sim.pumpEff, fan: sim.fanEff, fault: input.fault,
  cpuW: input.cpu * sim.power, gpuW: input.gpu * sim.power,
  radW: hyd.qSI * input.fluid.rho * input.fluid.cp * Math.max(0, sim.tHot - sim.tCold),
}));
initPresentation({ applyScenario, scene3d });

// referência rápida no console para conferir com o relatório
(window as unknown as { a3: unknown }).a3 = { GEO, solve, FLUIDS };
