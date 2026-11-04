import { referenceInputs, createSimulation, advanceSimulation } from "./simulation";

export interface Sample {
  time: number; q: number; water: number; cpu: number; gpu: number; cold: number;
  pump: number; fan: number; rpm: number; power: number; fault: string; diagnosis: string;
}
export interface SimEvent { time: number; label: string; }
const fmt = (v: number, digits = 1) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(v);
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

function plot(samples: Sample[], keys: Array<"cpu" | "water" | "q">, events: SimEvent[], comparison = false, names?: string[]): string {
  if (!samples.length) return '<p class="small">Aguardando a primeira amostra.</p>';
  const maxTime = Math.max(1, ...samples.map(s => s.time));
  const minTime = Math.max(0, maxTime - 120), range = Math.max(10, maxTime - minTime);
  const visible = samples.filter(s => s.time >= minTime);
  const maxValue = keys[0] === "q" ? Math.max(2, ...visible.map(s => s.q)) * 1.1 : Math.max(60, ...visible.flatMap(s => keys.map(k => s[k]))) * 1.1;
  const x = (t: number) => 48 + (t - minTime) / range * 580;
  const y = (v: number) => 190 - v / maxValue * 150;
  const unit = keys[0] === "q" ? "L/min" : "°C";
  const series = comparison ? [visible.filter((_, idx) => idx % 2 === 0), visible.filter((_, idx) => idx % 2 === 1)] : keys.map(() => visible);
  const labels = names ?? (keys[0] === "q" ? ["Vazão"] : ["CPU", "Água quente"]);
  let out = `<svg viewBox="0 0 650 230" role="img" aria-label="${escape(labels.join(' e '))} ao longo do tempo, ${unit}"><text x="8" y="20">${unit}</text>`;
  for (let n = 0; n <= 4; n++) {
    const value = n * maxValue / 4;
    out += `<line class="grid" x1="48" x2="628" y1="${y(value)}" y2="${y(value)}"/><text x="40" y="${y(value) + 4}" text-anchor="end">${fmt(value, keys[0] === "q" ? 1 : 0)}</text>`;
    const t = minTime + n * range / 4;
    out += `<text x="${x(t)}" y="211" text-anchor="middle">${fmt(t, 0)} s</text>`;
  }
  for (const event of events.filter(e => e.time >= minTime && e.time <= maxTime).slice(-12)) {
    out += `<line class="event-line" x1="${x(event.time)}" x2="${x(event.time)}" y1="35" y2="190"><title>${escape(event.label)}</title></line>`;
  }
  series.forEach((data, idx) => {
    const key = comparison ? keys[0] : keys[idx];
    out += `<path class="series series-${idx}" d="${data.map((s, j) => `${j ? 'L' : 'M'}${x(s.time).toFixed(1)} ${y(s[key]).toFixed(1)}`).join(' ')}"/>`;
  });
  return out + `</svg><div class="history-legend">${labels.map((label, n) => `<span class="legend-${n}">${escape(label)}</span>`).join('')}</div>`;
}

export function renderHistory(samples: Sample[], events: SimEvent[]) {
  document.querySelector("#historyCharts")!.innerHTML = `<div>${plot(samples, ["cpu", "water"], events)}</div><div>${plot(samples, ["q"], events)}</div>`;
  document.querySelector("#eventList")!.innerHTML = events.slice(-6).reverse().map(e => `<li><b>${fmt(e.time, 0)} s</b> ${escape(e.label)}</li>`).join("");
}

export function runComparison(kind: string) {
  const series: Sample[][] = [];
  const detections: Array<number | null> = [];
  const peaks: number[] = [];
  const names = kind === "protection" ? ["Diagnóstico ligado", "Diagnóstico desligado"] : ["Bomba 100 %", "Bomba 70 %"];
  for (let run = 0; run < 2; run++) {
    const input = referenceInputs();
    const s = createSimulation(input);
    if (kind === "protection") { input.fault = "stopped"; input.diag = run === 0; }
    else input.pump = run === 0 ? 100 : 70;
    const data: Sample[] = [];
    let detection: number | null = null, peak = s.tCpu;
    for (let tick = 0; tick <= 600; tick++) {
      advanceSimulation(input, s, tick ? 0.1 : 0);
      if (detection === null && (s.diagnosis.protect || s.throttling)) detection = s.time;
      peak = Math.max(peak, s.tCpu);
      if (tick % 10 === 0) data.push({ time: s.time, q: s.hyd.q, water: s.tHot, cold: s.tCold, cpu: s.tCpu, gpu: s.tGpu,
        pump: s.pumpEff, fan: s.fanEff, rpm: s.rpm, power: s.power, fault: input.fault, diagnosis: s.diagnosis.label });
    }
    series.push(data);
    detections.push(detection); peaks.push(peak);
  }
  const zipped = series[0].flatMap((s, idx) => [s, series[1][idx]]);
  document.querySelector("#comparisonResult")!.innerHTML =
    `<div class="history-charts"><div>${plot(zipped, ["cpu"], [], true, names)}</div><div>${plot(zipped, ["q"], [], true, names)}</div></div>` +
    `<div class="log-wrap"><table class="log"><caption>Resultado aos 60 s (temperaturas instantâneas)</caption><thead><tr><th>Ensaio</th><th>Q (L/min)</th><th>CPU (°C)</th><th>Pico CPU (°C)</th><th>Primeira proteção</th><th>Carga efetiva</th></tr></thead><tbody>${series.map((d, idx) => { const s = d[d.length - 1]; return `<tr><td>${names[idx]}</td><td>${fmt(s.q, 2)}</td><td>${fmt(s.cpu)}</td><td>${fmt(peaks[idx])}</td><td>${detections[idx] === null ? "Não acionada" : `${fmt(detections[idx]!)} s`}</td><td>${fmt(250 * s.power, 0)} W</td></tr>`; }).join('')}</tbody></table></div>` +
    (kind === "protection" ? '<p class="small">Sem circulação, ambos os ensaios podem atingir a proteção térmica e convergir. O diagnóstico antecipa a ação; não repara a bomba nem garante temperatura segura. Os picos de falha são ilustrativos.</p>' : '');
  return series;
}
