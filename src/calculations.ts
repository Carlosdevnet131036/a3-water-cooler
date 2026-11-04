import { GEO, T_AMB } from "./model";
import type { Inputs, Simulation } from "./simulation";

const fmt = (v: number, digits = 3) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(v);
const steps = (lines: string[]) => lines.map(l => `<p>${l}</p>`).join("");
const items = [
  ["q", "Vazão e velocidade"], ["re", "Número de Reynolds"], ["dp", "Perdas de carga"],
  ["p", "Potência hidráulica"], ["dt", "ΔT da água"], ["cpu", "Temperatura da CPU"],
];

export function renderCalculations(i: Inputs, s: Simulation) {
  const root = document.querySelector("#calculations")!;
  if (!root.children.length) root.innerHTML = items.map(([id, title]) =>
    `<details id="calc-${id}"><summary>${title}</summary><div class="calc-body"></div></details>`).join("");
  const h = s.hyd, fl = i.fluid, area = Math.PI * GEO.D ** 2 / 4;
  const heat = (i.cpu + i.gpu) * s.power;
  const mass = fl.rho * h.qSI;
  const dyn = fl.rho * h.v ** 2 / 2;
  const friction = h.regime === "laminar" ? "64/Re" : h.regime === "transição" ? "interpolação entre os limites de 2.300 e 4.000 (aproximação)" : "0,316/Re⁰·²⁵";
  const values: Record<string, string[]> = {
    q: [
      `O ponto de operação resolve <b>Δp da bomba = Δp do circuito</b> por bisseção, para rotação relativa n = ${fmt(s.pumpEff / 100, 2)} e a falha selecionada. A vazão é resultado, não uma entrada fixa.`,
      `<b>Conversão:</b> Q = ${fmt(h.q, 5)} L/min ÷ 60.000 = ${h.qSI.toExponential(4)} m³/s.`,
      `A = πD²/4 = π · 0,010²/4 = ${area.toExponential(4)} m².`,
      `<b>V = Q/A = ${fmt(h.v, 4)} m/s</b> na mangueira. Nos 40 canais em paralelo, a área total é ${GEO.channelArea.toExponential(2)} m² e V = ${fmt(h.vChannel, 4)} m/s.`,
    ],
    re: [
      `ρ = ${fmt(fl.rho)} kg/m³; μ = ${fmt(fl.mu, 6)} Pa·s; D = 0,010 m; V = ${fmt(h.v, 5)} m/s.`,
      `<b>Re = ρVD/μ = ${fmt(fl.rho)} · ${fmt(h.v, 5)} · 0,010 / ${fmt(fl.mu, 6)} ≈ ${fmt(h.re, 0)}</b> (adimensional).`,
      h.q === 0 ? "Não há circulação: o estado é <b>sem escoamento</b>. A classificação laminar/turbulento não é aplicada." : `Classificação da mangueira: <b>${h.regime}</b>. Limiares didáticos: Re &lt; 2.300, 2.300–4.000 e ≥ 4.000. Não aplicar este Reynolds aos microcanais.`,
    ],
    dp: [
      `Pressão dinâmica: ρV²/2 = ${fmt(dyn)} Pa. ${h.q > 0 ? `Fator de Darcy f = ${friction} = ${fmt(h.f, 5)}.` : "Sem circulação, todas as perdas por escoamento são zero."}`,
      `Distribuída: Δp = f · (L/D) · ρV²/2 = ${fmt(h.f, 5)} · (1,2/0,010) · ${fmt(dyn)} = <b>${fmt(h.dpDist)} Pa</b>.`,
      `Localizada: Δp = ΣK · ρV²/2 = 5 · ${fmt(dyn)} = <b>${fmt(h.dpLocal)} Pa</b>.`,
      `Componentes: Δp = 1.600 · (${fmt(h.q, 5)}/1,5)² · (${fmt(fl.mu, 6)}/0,00072)⁰·²⁵${i.fault === "clog" ? " · 5" : ""} = <b>${fmt(h.dpComp)} Pa</b>. Os 1.600 Pa são um dado hipotético adotado.`,
      `<b>Total = ${fmt(h.dpDist)} + ${fmt(h.dpLocal)} + ${fmt(h.dpComp)} = ${fmt(h.dpTotal)} Pa</b>. Altura equivalente H = Δp/(ρg) = ${fmt(h.head, 4)} m.`,
    ],
    p: [
      `Δp = ${fmt(h.dpTotal, 4)} Pa; Q = ${h.qSI.toExponential(4)} m³/s.`,
      `<b>Pₕ = Δp · Q = ${fmt(h.pHyd, 6)} W.</b> Pa · m³/s = W.`,
      "Esta é a potência transferida ao fluido. O consumo elétrico requer a eficiência conjunta da bomba e do motor: Pₑ = Pₕ/η. Sem η, o modelo não calcula o consumo elétrico.",
    ],
    dt: [
      `Carga solicitada = ${i.cpu} + ${i.gpu} W; fator efetivo de carga = ${fmt(s.power * 100, 1)} %. Calor usado no modelo = <b>${fmt(heat)} W</b>.`,
      h.q > 1e-9 ? `ṁ = ρQ = ${fmt(fl.rho)} · ${h.qSI.toExponential(4)} = ${fmt(mass, 6)} kg/s. <b>ΔT de equilíbrio = P/(ṁcₚ) = ${fmt(heat)} / (${fmt(mass, 6)} · ${fmt(fl.cp)}) = ${fmt(heat / (mass * fl.cp))} K</b>.` : "<b>Balanço de transporte indisponível: Q = 0.</b> A expressão P/(ṁcₚ) não pode ser usada com denominador zero. O comportamento térmico de falha é apenas ilustrativo.",
      `Leitura instantânea: <b>S2 − S3 = ${fmt(s.tHot)} − ${fmt(s.tCold)} = ${fmt(s.tHot - s.tCold)} K</b>. Durante um transiente, ela pode diferir do valor de equilíbrio.`,
    ],
    cpu: [
      `Ambiente = ${T_AMB} °C. Condutância do radiador G = 12 + 38·(${fmt(s.fanEff / 100, 2)})⁰·⁷ = ${fmt(12 + 38 * (s.fanEff / 100) ** 0.7)} W/K.`,
      "Alvo da água fria: Tₐ + Ptotal/G. Alvo da CPU: média da água antes/depois do bloco + PCPU · Rbloco. Rbloco = 0,05 + 0,03·(1,5/Q)⁰·⁸ K/W.",
      `Temperatura instantânea da CPU: <b>${fmt(s.tCpu, 1)} °C</b>. Resposta de primeira ordem: constante de tempo de 2,2 s no chip e 10 s na água.`,
      "É uma estimativa didática. Sem circulação, o código regulariza Q em 0,02 L/min e limita alvos da água em 110 °C para manter a animação numérica; isso não prevê a temperatura real de uma falha.",
    ],
  };
  for (const [id] of items) {
    const details = document.querySelector<HTMLDetailsElement>(`#calc-${id}`)!;
    if (details.open || !details.querySelector(".calc-body")!.children.length) {
      const body = details.querySelector(".calc-body")!;
      const html = steps(values[id]);
      if (body.innerHTML !== html) body.innerHTML = html;
    }
  }
}
