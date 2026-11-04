import "./style.css";
import { FLUIDS, GEO, T_AMB, solve, systemLoss, pumpPressure, thermalTargets } from "./model";
import type { Fault, Fluid, Hydraulics } from "./model";
import { QUIZ } from "./quiz";

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
type Mode = "manual" | "auto";
const input = {
  pump: 100, fan: 100, cpu: 250, gpu: 0,
  fluid: FLUIDS[0] as Fluid, fault: "none" as Fault, mode: "manual" as Mode, diag: true,
};

let hyd: Hydraulics = solve(1, input.fluid, "none");
const t0 = thermalTargets(input.cpu, input.gpu, hyd.q, 1, input.fluid);
const sim = {
  time: 0, tCold: t0.tCold, tMid: t0.tMid, tHot: t0.tHot, tCpu: t0.tCpu, tGpu: t0.tGpu,
  power: 1, pumpEff: 100, fanEff: 100, rpm: 4800, alarm: "" as "" | "flow" | "rpm", warn: false, throttling: false,
};

// ---------- controles ----------
const pumpIn = $<HTMLInputElement>("#pump");
const fanIn = $<HTMLInputElement>("#fan");
const cpuIn = $<HTMLInputElement>("#cpu");
const gpuIn = $<HTMLInputElement>("#gpu");
const fluidSel = $<HTMLSelectElement>("#fluid");
const diagIn = $<HTMLInputElement>("#diag");

for (const f of FLUIDS) fluidSel.add(new Option(f.name, f.id));

function readInputs() {
  input.pump = +pumpIn.value;
  input.fan = +fanIn.value;
  input.cpu = +cpuIn.value;
  input.gpu = +gpuIn.value;
  input.fluid = FLUIDS.find((f) => f.id === fluidSel.value) ?? FLUIDS[0];
  input.mode = ($<HTMLInputElement>("#modeAuto").checked ? "auto" : "manual");
  input.fault = ($<HTMLInputElement>('input[name="fault"]:checked').value as Fault);
  input.diag = diagIn.checked;
  pumpIn.disabled = fanIn.disabled = input.mode === "auto";
  setText("#cpuOut", `${input.cpu} W`);
  setText("#gpuOut", `${input.gpu} W`);
  $$<HTMLButtonElement>(".fault-card").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.fault === input.fault)));
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
  }),
);

// ---------- simulação ----------
function step(dt: number) {
  sim.time += dt;
  const auto = input.mode === "auto";
  let pump = auto ? clamp(40 + (sim.tHot - 30) * 6, 40, 100) : input.pump;
  let fan = auto ? clamp(30 + (sim.tHot - 30) * 5, 30, 100) : input.fan;
  if (sim.alarm) { pump = 100; fan = 100; }
  sim.pumpEff = pump; sim.fanEff = fan;
  if (auto) { pumpIn.value = String(Math.round(pump)); fanIn.value = String(Math.round(fan)); }

  const n = pump / 100;
  hyd = solve(n, input.fluid, input.fault);
  sim.rpm = input.fault === "stopped" ? 0 : 4800 * n * (input.fault === "air" ? 1.06 : 1);

  // diagnóstico de vazão (proposta de melhoria)
  const flowLow = hyd.q < 0.5;
  const rpmZero = sim.rpm < 1;
  sim.alarm = input.diag && (rpmZero || flowLow) ? (rpmZero ? "rpm" : "flow") : "";
  sim.warn = input.diag && !sim.alarm && sim.tHot - sim.tCold > 4;

  // limite de potência: alerta do diagnóstico ou throttling da BIOS a 100 °C
  let target = 1;
  if (sim.alarm) target = 0.35;
  const tMax = Math.max(sim.tCpu, sim.tGpu);
  sim.throttling = sim.throttling ? tMax >= 90 && !sim.alarm : tMax >= 99;
  if (sim.throttling) sim.power = clamp(sim.power - (tMax - 96) * 0.08 * dt, 0.15, 1);
  else sim.power += (target - sim.power) * clamp(dt * (target < sim.power ? 3 : 0.4), 0, 1);

  const tg = thermalTargets(input.cpu * sim.power, input.gpu * sim.power, hyd.q, fan / 100, input.fluid);
  const kw = clamp(dt / 10, 0, 1), kc = clamp(dt / 2.2, 0, 1);
  sim.tCold += (tg.tCold - sim.tCold) * kw;
  sim.tMid += (tg.tMid - sim.tMid) * kw;
  sim.tHot += (tg.tHot - sim.tHot) * kw;
  sim.tCpu += (tg.tCpu - sim.tCpu) * kc;
  sim.tGpu += (tg.tGpu - sim.tGpu) * kc;
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
    if (!reduceMotion.matches) {
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
  g += `<path class="pump100" d="${pts((q) => pumpPressure(q, 1, input.fault))}"/>`;
  g += `<path class="pump" d="${pts((q) => pumpPressure(q, n, input.fault))}"/>`;
  g += `<path class="sys" d="${pts((q) => systemLoss(q, input.fluid, input.fault).dpTotal)}"/>`;
  const ox = sx(hyd.q), oy = sy(hyd.dpTotal);
  g += `<circle class="op" cx="${ox}" cy="${oy}" r="7"/>`;
  const lx = clamp(ox + 12, CH.x0 + 4, CH.x0 + CH.w - 150);
  g += `<text class="op-label" x="${lx}" y="${oy - 14}">${F2.format(hyd.q)} L/min · ${F0.format(hyd.dpTotal)} Pa</text>`;
  g += `<g transform="translate(${CH.x0 + 14} ${CH.y0 - CH.h + 6})">
    <line class="sys" x1="0" x2="22" y1="0" y2="0"/><text x="28" y="4">Sistema</text>
    <line class="pump" x1="92" x2="114" y1="0" y2="0"/><text x="120" y="4">Bomba a ${F0.format(sim.pumpEff)} %</text>
    <line class="pump100" x1="0" x2="22" y1="18" y2="18"/><text x="28" y="22">Bomba a 100 %</text></g>`;
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
  let msg = "", warn = false;
  if (sim.alarm === "rpm") msg = "Alerta: bomba parada (S4 = 0 rpm). PWM em 100 %, aviso ao usuário e clock reduzido.";
  else if (sim.alarm === "flow") msg = "Alerta: vazão abaixo de 0,5 L/min mesmo com a bomba girando. Possível ar no circuito. PWM em 100 % e clock reduzido.";
  else if (sim.throttling) msg = "Thermal throttling: o chip chegou a 100 °C e reduziu a frequência sozinho. Sem diagnóstico, a falha só aparece agora.";
  else if (sim.warn) { msg = "Atenção: ΔT da água acima de 4 K. A vazão está baixa para essa carga; verifique entupimento."; warn = true; }
  alert.hidden = !msg;
  if (msg) { setText("#alert", msg); alert.classList.toggle("warn", warn); }

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
  const ref = solve(1, fl, input.fault);
  const ratio = ref.pHyd > 0 ? hyd.pHyd / ref.pHyd : 0;
  setText("#affText", sim.pumpEff >= 99.5
    ? `Com a bomba a 100 %, a vazão é ${F2.format(hyd.q)} L/min e a potência hidráulica é ${F3.format(hyd.pHyd)} W. Baixe o PWM para ver as leis em ação.`
    : `Com a bomba a ${F0.format(sim.pumpEff)} %, a vazão é ${F0.format((hyd.q / Math.max(ref.q, 1e-6)) * 100)} % da vazão a 100 % e a potência hidráulica cai para ${F0.format(ratio * 100)} % (${F3.format(hyd.pHyd)} W).`);
  drawChart();

  // controle
  setText("#stepRead", `S1 ${F2.format(hyd.q)} L/min · S2 ${F1.format(sim.tHot)} °C · S3 ${F1.format(sim.tCold)} °C · S4 ${F0.format(sim.rpm)} rpm`);
  setText("#stepProc", `média móvel · ΔT = S2 − S3 = ${F1.format(Math.max(0, sim.tHot - sim.tCold))} K`);
  setText("#stepCheck", !input.diag ? "diagnóstico desligado: nada é verificado"
    : sim.alarm ? (sim.alarm === "rpm" ? "bomba com 0 rpm: ALERTA" : "vazão < 0,5 L/min: ALERTA")
    : "vazão ≥ 0,5 L/min e bomba girando: ok");
  setText("#stepCurve", sim.alarm ? "falha detectada: bomba e ventoinhas em 100 %"
    : input.mode === "auto" ? `curva pela T da água (${F1.format(sim.tHot)} °C): bomba ${F0.format(sim.pumpEff)} %, ventoinhas ${F0.format(sim.fanEff)} %`
    : `manual: bomba ${F0.format(sim.pumpEff)} %, ventoinhas ${F0.format(sim.fanEff)} %`);
  $("#pwmPump").innerHTML = pwmPath(sim.pumpEff);
  $("#pwmFan").innerHTML = pwmPath(sim.fanEff);
  setText("#pwmPumpTxt", `${F0.format(sim.pumpEff)} %`);
  setText("#pwmFanTxt", `${F0.format(sim.fanEff)} %`);
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
    lastLog = sec;
    logRows.unshift(`<tr><td>${sec}</td><td class="${hyd.q < 0.5 ? "bad" : ""}">${F2.format(hyd.q)}</td><td>${F1.format(sim.tHot)}</td><td class="${sim.tCpu >= 90 ? "bad" : ""}">${F0.format(sim.tCpu)}</td><td>${F0.format(sim.pumpEff)} %</td></tr>`);
    if (logRows.length > 6) logRows.pop();
    $("#logBody").innerHTML = logRows.join("");
  }
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
let last = performance.now(), textT = 1;
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  step(dt);
  animateLoop(dt);
  drawReynolds(dt);
  updateCycle(dt);
  textT += dt;
  if (textT > 0.1) { textT = 0; updateText(); }
  requestAnimationFrame(frame);
}
updateText();
requestAnimationFrame(frame);

// referência rápida no console para conferir com o relatório
(window as unknown as { a3: unknown }).a3 = { GEO, solve, FLUIDS };
