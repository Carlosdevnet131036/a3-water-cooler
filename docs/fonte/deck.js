const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");

const DIR = __dirname;
const OUT = path.join(DIR, "A3_Grupo3_WaterCooler_Slides.pptx");

const THEME = {
  name: "Water Cooler",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "14202B", lt1: "FFFFFF", dk2: "0B2540", lt2: "EEF5F8",
    accent1: "0096B7", accent2: "D9482B", accent3: "1E8449", accent4: "5B6B78",
    accent5: "7FD3E6", accent6: "F2B134", hlink: "0096B7", folHlink: "5B6B78",
  },
};
const HEX = THEME.colors;

async function icon(Comp, color = "FFFFFF") {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: 256 }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title = "A3 – Grupo 3 – Water cooler";
  pres.author = "Grupo 3";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  const ICON = {
    temp: await icon(fa.FaThermometerHalf), drop: await icon(fa.FaTint),
    chip: await icon(fa.FaMicrochip), fan: await icon(fa.FaFan),
    gauge: await icon(fa.FaTachometerAlt), warn: await icon(fa.FaExclamationTriangle),
    bolt: await icon(fa.FaBolt), wrench: await icon(fa.FaWrench),
    water: await icon(fa.FaWater), book: await icon(fa.FaBook),
    cogs: await icon(fa.FaCogs), check: await icon(fa.FaCheck),
    wave: await icon(fa.FaWaveSquare),
  };

  // ---------- layouts ----------
  const footer = (dark) => [
    { text: { text: "A3 · Sistemas Fluidomecânicos · Grupo 3", options: {
      x: 0.5, y: 5.2, w: 6, h: 0.3, fontSize: 10, color: dark ? C.accent5 : C.accent4, margin: 0 } } },
  ];
  pres.defineSlideMaster({
    title: "TITULO", background: { color: HEX.dk2 },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 1.2, w: 5.7, h: 1.9,
        fontSize: 34, bold: true, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "subtitle", type: "body", x: 0.5, y: 3.3, w: 5.6, h: 0.8,
        fontSize: 16, color: C.accent5, valign: "top", margin: 0 }, text: "" } },
    ],
  });
  pres.defineSlideMaster({
    title: "CONTEUDO", background: { color: HEX.lt1 },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.3, w: 9, h: 0.7,
        fontSize: 32, bold: true, color: C.text2, valign: "middle", align: "left", margin: 0 }, text: "" } },
      ...footer(false),
    ],
    slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.3, fontSize: 10, color: C.accent4, align: "right" },
  });
  pres.defineSlideMaster({
    title: "ESCURO", background: { color: HEX.dk2 },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.3, w: 9, h: 0.7,
        fontSize: 32, bold: true, color: C.background1, valign: "middle", align: "left", margin: 0 }, text: "" } },
      ...footer(true),
    ],
    slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.3, fontSize: 10, color: C.accent5, align: "right" },
  });

  // ---------- helpers ----------
  const T = (s, text, o) => s.addText(text, { isTextBox: true, fontSize: 14, color: C.text1, margin: 0, valign: "top", ...o });
  const circleIcon = (s, img, x, y, d = 0.5, fill = C.accent1) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { type: "none" } });
    s.addImage({ data: img, x: x + d * 0.22, y: y + d * 0.22, w: d * 0.56, h: d * 0.56 });
  };
  const card = (s, x, y, w, h, fill = C.background2) =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { type: "none" } });
  const src = (s, text, dark = false) => T(s, text, { x: 0.5, y: 4.9, w: 9, h: 0.25, fontSize: 10, italic: true, color: dark ? C.accent5 : C.accent4 });
  const slide = (master, section) => pres.addSlide({ masterName: master, sectionTitle: section });

  // ===== 1. Capa =====
  pres.addSection({ title: "Abertura" });
  let s = slide("TITULO", "Abertura");
  s.addText("Water cooler para processadores e placas de vídeo", { placeholder: "title" });
  s.addText("Escoamento em circuito fechado, perdas de carga e controle por PWM", { placeholder: "subtitle" });
  T(s, "A3 · SISTEMAS FLUIDOMECÂNICOS · GRUPO 3", { x: 0.5, y: 0.75, w: 5.6, h: 0.3, fontSize: 12, bold: true, color: C.accent5, charSpacing: 2 });
  T(s, "Prof. Dr. Ronyclei Raimundo da Silva · UNP · Novembro de 2026", { x: 0.5, y: 4.6, w: 5.6, h: 0.3, fontSize: 12, color: C.background1 });
  card(s, 6.5, 0.75, 3.0, 4.15, "13304F");
  circleIcon(s, ICON.drop, 6.75, 1.0, 0.55);
  T(s, "Integrantes", { x: 6.75, y: 1.7, w: 2.6, h: 0.35, fontSize: 16, bold: true, color: C.background1 });
  T(s, ["Alexandre Pinho do Rosario Filho", "Carlos Henrique Pereira da Silva", "Daniela Brito da Silva",
        "Raffael Morais Dutra", "Victor Hugo Paiva dos Santos"].map((n, i, a) => ({ text: n, options: { breakLine: i < a.length - 1 } })),
    { x: 6.75, y: 2.15, w: 2.6, h: 2.5, fontSize: 14, color: C.background1, paraSpaceAfter: 8 });
  s.addNotes("Apresentador: Alexandre. Apresentar o grupo, o tema 01 e o roteiro: problema, conceitos de fluidos, sistema, integração com a Computação, exemplo numérico, falha e melhoria, conclusão.");

  // ===== 2. Problema =====
  pres.addSection({ title: "Problema e sistema" });
  s = slide("CONTEUDO", "Problema e sistema");
  s.addText("O problema: calor demais em pouco espaço", { placeholder: "title" });
  const stats = [
    ["250 W", "calor dissipado por uma CPU de alto desempenho", ICON.chip],
    ["> 300 W", "calor de uma placa de vídeo topo de linha", ICON.temp],
    ["≈ 3.500×", "mais energia por volume na água do que no ar", ICON.water],
  ];
  stats.forEach(([n, l, ic], i) => {
    const x = 0.5 + i * 3.07;
    card(s, x, 1.25, 2.86, 2.0);
    circleIcon(s, ic, x + 0.25, 1.45, 0.5);
    T(s, n, { x: x + 0.25, y: 2.05, w: 2.4, h: 0.6, fontSize: 36, bold: true, color: i === 0 ? C.accent2 : C.text2 });
    T(s, l, { x: x + 0.25, y: 2.65, w: 2.4, h: 0.55, fontSize: 13, color: C.accent4 });
  });
  card(s, 0.5, 3.45, 9.0, 1.3, C.background2);
  T(s, [
    { text: "Pergunta do trabalho: ", options: { bold: true, color: C.accent1 } },
    { text: "como garantir vazão suficiente para retirar o calor da CPU e da GPU sem desperdiçar energia na bomba nem gerar ruído excessivo?", options: { breakLine: true } },
    { text: "Objetivo: ", options: { bold: true, color: C.accent1 } },
    { text: "calcular vazão, regime, perdas de carga e potência da bomba, e controlar bomba e ventoinhas por PWM." },
  ], { x: 0.75, y: 3.6, w: 8.5, h: 1.05, fontSize: 14, paraSpaceAfter: 6 });
  s.addNotes("Apresentador: Alexandre. Acima de ~95 °C o chip reduz a frequência (thermal throttling). Água: ρ·cp ≈ 4,16 MJ/(m³·K) contra ≈ 1,2 kJ/(m³·K) do ar, daí a razão de ~3.500 vezes.");

  // ===== 3. Sistema =====
  s = slide("CONTEUDO", "Problema e sistema");
  s.addText("Como funciona o circuito fechado", { placeholder: "title" });
  s.addImage({ path: path.join(DIR, "fig1_circuito.png"), x: 0.4, y: 1.15, w: 5.9, h: 3.39 });
  const comps = [
    ["Fluido", "água destilada + aditivo (≈ água a 35 °C)"],
    ["Bomba", "centrífuga 12 V, controlada por PWM"],
    ["Blocos", "cobre com microcanais na CPU e na GPU"],
    ["Radiador", "360 mm com 3 ventoinhas PWM"],
    ["Mangueiras", "Ø interno 10 mm"],
  ];
  T(s, comps.flatMap(([a, b], i) => [
    { text: a + ": ", options: { bold: true, color: C.accent1 } },
    { text: b, options: { breakLine: i < comps.length - 1 } },
  ]), { x: 6.55, y: 1.25, w: 2.95, h: 3.3, fontSize: 14, paraSpaceAfter: 10 });
  src(s, "Fonte: elaborado pelos autores (2026).");
  s.addNotes("Apresentador: Alexandre. Seguir o sentido do escoamento: reservatório → bomba → bloco da CPU → bloco da GPU → radiador → reservatório. Apontar os sensores S1 a S4, que serão explicados na parte de Computação.");

  // ===== 4. Massa específica e viscosidade =====
  pres.addSection({ title: "Conceitos de fluidos" });
  s = slide("CONTEUDO", "Conceitos de fluidos");
  s.addText("Massa específica e viscosidade", { placeholder: "title" });
  [[ICON.drop, "Massa específica (ρ)", "Massa por unidade de volume.", "ρ ≈ 994 kg/m³ (água a 35 °C)"],
   [ICON.wave, "Viscosidade dinâmica (μ)", "Atrito interno entre camadas do fluido; cai quando a temperatura sobe.", "μ ≈ 0,72 × 10⁻³ Pa·s (35 °C)"]]
    .forEach(([ic, h, d, v], i) => {
      const y = 1.2 + i * 1.75;
      card(s, 0.5, y, 4.2, 1.55);
      circleIcon(s, ic, 0.7, y + 0.2, 0.5);
      T(s, h, { x: 1.35, y: y + 0.22, w: 3.2, h: 0.4, fontSize: 18, bold: true, color: C.text2 });
      T(s, d, { x: 1.35, y: y + 0.62, w: 3.2, h: 0.5, fontSize: 13, color: C.accent4 });
      T(s, v, { x: 1.35, y: y + 1.1, w: 3.2, h: 0.3, fontSize: 14, bold: true, color: C.accent1 });
    });
  s.addChart(pres.charts.LINE, [{ name: "μ (mPa·s)", labels: ["20 °C", "30 °C", "40 °C", "50 °C", "60 °C"],
    values: [1.002, 0.798, 0.653, 0.547, 0.467] }], {
    x: 5.0, y: 1.15, w: 4.5, h: 3.4, showTitle: true, title: "Viscosidade da água × temperatura (mPa·s)",
    titleFontSize: 13, titleColor: HEX.dk2, titleFontFace: "+mn-lt",
    chartColors: [HEX.accent1], lineSize: 3, lineDataSymbolSize: 8,
    showValue: true, dataLabelPosition: "t", dataLabelFontSize: 11, dataLabelColor: HEX.dk1, dataLabelFormatCode: "0.00",
    dataLabelFontFace: "+mn-lt", catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
    catAxisLabelColor: HEX.accent4, valAxisLabelColor: HEX.accent4, catAxisLabelFontSize: 11, valAxisLabelFontSize: 11,
    valAxisMinVal: 0, valAxisMaxVal: 1.2, valAxisLabelFormatCode: "0.0",
    valGridLine: { color: "DDE5EA", size: 0.5 }, catGridLine: { style: "none" }, showLegend: false,
  });
  src(s, "Fonte dos dados de viscosidade: Çengel e Cimbala (2015).");
  s.addNotes("Apresentador: Carlos. Viscosidade maior significa mais perda de carga. Aditivos com glicol aumentam a viscosidade; por isso a escolha do fluido afeta a bomba.");

  // ===== 5. Vazão, continuidade e Reynolds =====
  s = slide("CONTEUDO", "Conceitos de fluidos");
  s.addText("Vazão, continuidade e Reynolds", { placeholder: "title" });
  [["Vazão", "Q = V · A", "volume que passa por segundo (m³/s)"],
   ["Continuidade", "ρ·V₁·A₁ = ρ·V₂·A₂", "área menor → velocidade maior (microcanais)"],
   ["Reynolds", "Re = ρ · V · D / μ", "inércia ÷ viscosidade: define o regime"]]
    .forEach(([h, eq, d], i) => {
      const x = 0.5 + i * 3.07;
      card(s, x, 1.2, 2.86, 1.85);
      T(s, h, { x: x + 0.2, y: 1.35, w: 2.46, h: 0.35, fontSize: 16, bold: true, color: C.accent1 });
      T(s, eq, { x: x + 0.2, y: 1.75, w: 2.46, h: 0.5, fontSize: 20, bold: true, color: C.text2 });
      T(s, d, { x: x + 0.2, y: 2.35, w: 2.46, h: 0.6, fontSize: 13, color: C.accent4 });
    });
  // régua de regimes
  T(s, "Regime de escoamento em tubos", { x: 0.5, y: 3.3, w: 5, h: 0.3, fontSize: 14, bold: true, color: C.text2 });
  const bands = [["Laminar  Re < 2.300", 0.5, 3.0, "B9E6F0"], ["Transição", 3.5, 2.6, "7FD3E6"], ["Turbulento  Re > 4.000", 6.1, 3.4, "0096B7"]];
  bands.forEach(([t, x, w, col], i) => {
    s.addShape(pres.shapes.RECTANGLE, { x, y: 3.7, w, h: 0.5, fill: { color: col }, line: { color: "FFFFFF", width: 2 } });
    T(s, t, { x, y: 3.7, w, h: 0.5, align: "center", valign: "middle", fontSize: 13, bold: true, color: i === 2 ? C.background1 : C.text2 });
  });
  s.addShape(pres.shapes.ISOSCELES_TRIANGLE, { x: 6.27, y: 4.25, w: 0.22, h: 0.18, fill: { color: C.accent2 }, line: { type: "none" } });
  T(s, "nosso caso: Re ≈ 4.394", { x: 5.5, y: 4.45, w: 2.5, h: 0.3, fontSize: 13, bold: true, color: C.accent2 });
  s.addNotes("Apresentador: Carlos. Em circuito fechado, a vazão mássica é a mesma em todos os pontos. No exemplo, o escoamento nas mangueiras é turbulento, mas próximo da transição.");

  // ===== 6. Perdas de carga e bomba =====
  s = slide("CONTEUDO", "Conceitos de fluidos");
  s.addText("Perdas de carga e a bomba", { placeholder: "title" });
  [["Distribuída", "Δp = f · (L/D) · ρV²/2", "atrito ao longo dos tubos retos", "f = 0,316 / Re^0,25 (Blasius)"],
   ["Localizada", "Δp = ΣK · ρV²/2", "conexões, curvas, entradas e saídas", "K tabelado para cada acessório"]]
    .forEach(([h, eq, d, extra], i) => {
      const x = 0.5 + i * 4.6;
      card(s, x, 1.2, 4.4, 1.75);
      T(s, "Perda " + h.toLowerCase(), { x: x + 0.25, y: 1.32, w: 3.9, h: 0.35, fontSize: 16, bold: true, color: C.accent1 });
      T(s, eq, { x: x + 0.25, y: 1.7, w: 3.9, h: 0.45, fontSize: 20, bold: true, color: C.text2 });
      T(s, d + "\n" + extra, { x: x + 0.25, y: 2.2, w: 3.9, h: 0.65, fontSize: 13, color: C.accent4 });
    });
  card(s, 0.5, 3.15, 9.0, 1.6, C.text2);
  circleIcon(s, ICON.cogs, 0.75, 3.35, 0.55);
  T(s, "A bomba vence a soma das perdas", { x: 1.5, y: 3.35, w: 3.6, h: 0.35, fontSize: 16, bold: true, color: C.background1 });
  T(s, "P_h = Δp · Q      H = Δp / (ρ·g)", { x: 1.5, y: 3.8, w: 3.6, h: 0.4, fontSize: 16, color: C.accent5 });
  T(s, "Leis de semelhança (rotação n):", { x: 5.4, y: 3.35, w: 3.9, h: 0.35, fontSize: 14, bold: true, color: C.background1 });
  T(s, "Q ∝ n      Δp ∝ n²      P ∝ n³", { x: 5.4, y: 3.8, w: 3.9, h: 0.4, fontSize: 18, bold: true, color: C.accent6 });
  T(s, "Reduzir a rotação economiza muito mais potência do que vazão.", { x: 1.5, y: 4.25, w: 7.8, h: 0.35, fontSize: 13, italic: true, color: C.background1 });
  s.addNotes("Apresentador: Daniela. Curva do sistema: Δp ≈ k·Q². Como a potência cai com o cubo da rotação, baixar o PWM da bomba reduz bastante a potência e o ruído.");

  // ===== 7. Sensores e PWM =====
  pres.addSection({ title: "Integração com a Computação" });
  s = slide("CONTEUDO", "Integração com a Computação");
  s.addText("Sensores e controle por PWM", { placeholder: "title" });
  const sens = [
    [ICON.water, "S1 · Fluxo", "turbina com efeito Hall: pulsos ∝ vazão"],
    [ICON.temp, "S2 e S3 · Temperatura", "NTC 10 kΩ na água quente e na fria"],
    [ICON.gauge, "S4 · Rotação", "tacômetro da bomba: 2 pulsos por volta"],
    [ICON.chip, "CPU e GPU", "sensores internos lidos pela BIOS"],
  ];
  sens.forEach(([ic, h, d], i) => {
    const x = 0.5 + (i % 2) * 2.85, y = 1.2 + Math.floor(i / 2) * 1.75;
    card(s, x, y, 2.7, 1.6);
    circleIcon(s, ic, x + 0.2, y + 0.2, 0.5);
    T(s, h, { x: x + 0.2, y: y + 0.8, w: 2.35, h: 0.3, fontSize: 14, bold: true, color: C.text2 });
    T(s, d, { x: x + 0.2, y: y + 1.1, w: 2.35, h: 0.45, fontSize: 12, color: C.accent4 });
  });
  // PWM
  card(s, 6.3, 1.2, 3.2, 3.35, C.text2);
  T(s, "PWM de 25 kHz", { x: 6.5, y: 1.35, w: 2.8, h: 0.35, fontSize: 16, bold: true, color: C.background1 });
  [0, 1, 2].forEach((k) => {
    const x0 = 6.55 + k * 0.92;
    s.addShape(pres.shapes.RECTANGLE, { x: x0, y: 1.9, w: 0.64, h: 0.55, fill: { color: C.accent5 }, line: { type: "none" } });
    s.addShape(pres.shapes.LINE, { x: x0 + 0.64, y: 2.45, w: 0.28, h: 0, line: { color: C.accent5, width: 2 } });
  });
  T(s, "duty 70 % → ≈ 70 % da rotação", { x: 6.5, y: 2.6, w: 2.8, h: 0.3, fontSize: 13, bold: true, color: C.accent6 });
  T(s, "Referência do controle: temperatura do líquido, que muda devagar. Assim a bomba e as ventoinhas não oscilam a cada pico de carga.",
    { x: 6.5, y: 3.0, w: 2.8, h: 1.4, fontSize: 13, color: C.background1 });
  s.addNotes("Apresentadora: Daniela. NTC lido pelo ADC do microcontrolador (divisor resistivo + equação de Steinhart-Hart). Sensor de fluxo contado por interrupção. PWM conforme a especificação de ventoinhas de 4 fios da Intel (2005).");

  // ===== 8. Fluxograma =====
  s = slide("CONTEUDO", "Integração com a Computação");
  s.addText("Medição, processamento e ação", { placeholder: "title" });
  s.addImage({ path: path.join(DIR, "fig2_fluxograma.png"), x: 0.4, y: 1.05, w: 3.4, h: 3.93 });
  const steps = [
    [ICON.gauge, "Medir", "temperaturas, vazão e RPM a cada 1 s"],
    [ICON.cogs, "Processar", "média móvel e ΔT = S2 − S3"],
    [ICON.warn, "Proteger", "vazão baixa ou bomba parada → alerta, 100 % e redução de clock"],
    [ICON.fan, "Agir", "curva T água → duty da bomba e das ventoinhas"],
  ];
  steps.forEach(([ic, h, d], i) => {
    const y = 1.15 + i * 0.92;
    circleIcon(s, ic, 4.1, y, 0.55, i === 2 ? C.accent2 : C.accent1);
    T(s, h, { x: 4.85, y: y - 0.02, w: 4.6, h: 0.3, fontSize: 16, bold: true, color: C.text2 });
    T(s, d, { x: 4.85, y: y + 0.3, w: 4.6, h: 0.5, fontSize: 13, color: C.accent4 });
  });
  s.addNotes("Apresentadora: Daniela. Percorrer o fluxograma de cima para baixo. Destacar o ramo de alerta: é ele que protege o hardware se a circulação parar.");

  // ===== 9. Dados do exemplo =====
  pres.addSection({ title: "Exemplo numérico" });
  s = slide("CONTEUDO", "Exemplo numérico");
  s.addText("Exemplo numérico: dados e hipóteses", { placeholder: "title" });
  const hdr = (t) => ({ text: t, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 } } });
  const rows = [
    [hdr("Grandeza"), hdr("Valor (SI)")],
    ["Calor a dissipar (CPU)", "250 W"],
    ["Vazão com bomba a 100 %", "1,5 L/min = 2,5 × 10⁻⁵ m³/s"],
    ["Diâmetro e comprimento da mangueira", "D = 0,010 m; L = 1,2 m"],
    ["Conexões e curvas", "ΣK = 5,0"],
    ["Perdas no bloco + radiador", "1.200 + 400 = 1.600 Pa"],
    ["Água a 35 °C", "ρ = 994 kg/m³; μ = 0,72 mPa·s; cp = 4.178 J/(kg·K)"],
  ];
  s.addTable(rows, { x: 0.5, y: 1.15, w: 6.1, colW: [2.6, 3.5], fontSize: 12, color: HEX.dk1,
    border: { type: "solid", pt: 0.5, color: "C9D6DE" }, fill: { color: HEX.lt1 }, rowH: 0.42, valign: "middle" });
  card(s, 6.85, 1.15, 2.65, 3.5);
  circleIcon(s, ICON.check, 7.05, 1.35, 0.5, C.accent3);
  T(s, "Hipóteses", { x: 7.05, y: 1.95, w: 2.3, h: 0.35, fontSize: 16, bold: true, color: C.text2 });
  T(s, ["Regime permanente", "Fluido incompressível", "Tubos lisos", "Perdas dos componentes ∝ Q²"]
      .map((t, i, a) => ({ text: t, options: { bullet: true, breakLine: i < a.length - 1 } })),
    { x: 7.05, y: 2.35, w: 2.3, h: 1.5, fontSize: 13, color: C.accent4, paraSpaceAfter: 4 });
  T(s, "Dados adotados (hipotéticos), com valores típicos de catálogos.", { x: 7.05, y: 3.85, w: 2.3, h: 0.7, fontSize: 11, italic: true, color: C.accent2 });
  s.addNotes("Apresentador: Raffael. Deixar claro que os dados são hipotéticos/adotados, como o relatório identifica. O bloco da CPU é o componente com maior perda.");

  // ===== 10. Cálculos =====
  s = slide("CONTEUDO", "Exemplo numérico");
  s.addText("Resolução passo a passo", { placeholder: "title" });
  const calc = [
    ["a) Regime", "Re ≈ 4.394", "V = Q/A = 0,318 m/s\nRe = ρVD/μ → turbulento"],
    ["b) Perdas", "2.086 Pa", "distribuída 235 Pa\nlocalizada 252 Pa\ncomponentes 1.600 Pa"],
    ["c) Bomba", "0,052 W", "H = Δp/(ρg) = 0,214 m\nP_h = Δp · Q"],
    ["d) Aquecimento", "ΔT ≈ 2,4 K", "ṁ = ρQ = 0,0249 kg/s\nΔT = Q̇ / (ṁ·cp)"],
  ];
  calc.forEach(([h, big, d], i) => {
    const x = 0.5 + i * 2.3;
    card(s, x, 1.2, 2.15, 3.3);
    T(s, h, { x: x + 0.18, y: 1.35, w: 1.8, h: 0.35, fontSize: 15, bold: true, color: C.accent1 });
    T(s, big, { x: x + 0.18, y: 1.8, w: 1.8, h: 0.6, fontSize: 26, bold: true, color: i === 1 ? C.accent2 : C.text2 });
    T(s, d, { x: x + 0.18, y: 2.6, w: 1.85, h: 1.7, fontSize: 13, color: C.accent4 });
  });
  s.addNotes("Apresentador: Raffael. a) A = π·D²/4 = 7,854×10⁻⁵ m²; V = 0,318 m/s; Re = 994×0,318×0,010/0,72×10⁻³ ≈ 4.394. b) ρV²/2 = 50,4 Pa; f = 0,0388; Δp_d = 0,0388×120×50,4 ≈ 235 Pa; Δp_L = 5×50,4 ≈ 252 Pa; total ≈ 2.086 Pa. c) H ≈ 0,214 m; P_h = 2.086×2,5×10⁻⁵ ≈ 0,052 W. d) ΔT = 250/(0,0249×4.178) ≈ 2,4 K.");

  // ===== 11. Efeito do PWM =====
  s = slide("CONTEUDO", "Exemplo numérico");
  s.addText("Reduzindo a bomba para 70 %", { placeholder: "title" });
  const qs = [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
  const k = 2086 / 1.5 ** 2;
  s.addChart(pres.charts.LINE, [{ name: "Curva do sistema", labels: qs.map((q) => q.toFixed(2).replace(".", ",")),
    values: qs.map((q) => Math.round(k * q * q)) }], {
    x: 0.4, y: 1.1, w: 5.0, h: 3.6, showTitle: true, title: "Curva do sistema: Δp (Pa) × Q (L/min)",
    titleFontSize: 13, titleColor: HEX.dk2, titleFontFace: "+mn-lt",
    chartColors: [HEX.accent1], lineSize: 3, lineDataSymbol: "none",
    catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
    catAxisLabelColor: HEX.accent4, valAxisLabelColor: HEX.accent4, catAxisLabelFontSize: 11, valAxisLabelFontSize: 11,
    valGridLine: { color: "DDE5EA", size: 0.5 }, catGridLine: { style: "none" }, showLegend: false,
    valAxisMinVal: 0, valAxisMaxVal: 4000,
  });
  const cmp = [
    [hdr(""), hdr("PWM 100 %"), hdr("PWM 70 %")],
    ["Vazão (L/min)", "1,50", "1,05"],
    ["Reynolds", "4.394", "3.076"],
    ["Perda total (Pa)", "2.086", "≈ 1.022"],
    ["Potência hidráulica (W)", "0,052", "0,018"],
    ["ΔT do líquido (K)", "2,4", "3,4"],
  ];
  s.addTable(cmp, { x: 5.7, y: 1.15, w: 3.8, colW: [1.7, 1.05, 1.05], fontSize: 12, color: HEX.dk1, align: "center",
    border: { type: "solid", pt: 0.5, color: "C9D6DE" }, fill: { color: HEX.lt1 }, rowH: 0.36, valign: "middle" });
  card(s, 5.7, 3.45, 3.8, 1.25, C.background2);
  T(s, [
    { text: "−30 % de vazão custa só +1 K", options: { bold: true, color: C.accent2, breakLine: true } },
    { text: "e a potência hidráulica cai ≈ 65 % (∝ n³), com menos ruído." },
  ], { x: 5.9, y: 3.58, w: 3.45, h: 1.0, fontSize: 14 });
  s.addNotes("Apresentador: Victor. Leis de semelhança com n₂/n₁ = 0,7: Q × 0,7; Δp × 0,49; P × 0,343. O cálculo direto dá 1.033 Pa, perto dos 1.022 Pa previstos: o fator de atrito sobe um pouco quando Re cai. A potência elétrica real da bomba (5–20 W) é muito maior que a hidráulica, e quase toda vira calor no circuito.");

  // ===== 12. Falha e melhoria =====
  pres.addSection({ title: "Discussão e conclusão" });
  s = slide("CONTEUDO", "Discussão e conclusão");
  s.addText("Falha crítica e proposta de melhoria", { placeholder: "title" });
  card(s, 0.5, 1.2, 4.35, 3.5, "FBE9E5");
  circleIcon(s, ICON.warn, 0.75, 1.4, 0.55, C.accent2);
  T(s, "Falha: a circulação para", { x: 1.45, y: 1.48, w: 3.3, h: 0.4, fontSize: 17, bold: true, color: C.accent2 });
  T(s, ["Bomba parada", "Ar preso no rotor", "Microcanais entupidos"].map((t, i, a) => ({ text: t, options: { bullet: true, breakLine: i < a.length - 1 } })),
    { x: 0.75, y: 2.15, w: 3.9, h: 1.0, fontSize: 14, paraSpaceAfter: 4 });
  T(s, "O RPM da bomba pode parecer normal com vazão quase nula. Só a temperatura do chip denuncia, tarde demais.",
    { x: 0.75, y: 3.3, w: 3.9, h: 1.2, fontSize: 13, color: C.accent4 });
  card(s, 5.15, 1.2, 4.35, 3.5, "E3F4E8");
  circleIcon(s, ICON.wrench, 5.4, 1.4, 0.55, C.accent3);
  T(s, "Melhoria: diagnóstico da vazão", { x: 6.1, y: 1.48, w: 3.3, h: 0.4, fontSize: 17, bold: true, color: C.accent3 });
  T(s, ["Vazão (S1) < 0,5 L/min", "RPM da bomba (S4) = 0", "ΔT (S2 − S3) subindo com a mesma carga"].map((t, i, a) => ({ text: t, options: { bullet: true, breakLine: i < a.length - 1 } })),
    { x: 5.4, y: 2.15, w: 3.9, h: 1.0, fontSize: 14, paraSpaceAfter: 4 });
  T(s, "Ao detectar: PWM 100 %, alerta e redução de clock. O histórico de vazão orienta a manutenção preventiva.",
    { x: 5.4, y: 3.3, w: 3.9, h: 1.2, fontSize: 13, color: C.accent4 });
  s.addNotes("Apresentador: Victor. Sem escoamento, o líquido parado no bloco aquece em segundos. O sensor de fluxo mede a grandeza que realmente importa: a vazão.");

  // ===== 13. Conclusão =====
  s = slide("ESCURO", "Discussão e conclusão");
  s.addText("Conclusão", { placeholder: "title" });
  const concl = [
    [ICON.drop, "A vazão define quanto calor o líquido transporta", "1,5 L/min mantém ΔT ≈ 2,4 K com 250 W."],
    [ICON.cogs, "As perdas se concentram nos componentes", "≈ 77 % da perda total está no bloco e no radiador."],
    [ICON.bolt, "PWM economiza com pouco impacto térmico", "70 % de rotação: −65 % de potência, +1 K."],
    [ICON.warn, "Sensores de vazão evitam falhas silenciosas", "Diagnóstico antes do throttling."],
  ];
  concl.forEach(([ic, h, d], i) => {
    const x = 0.5 + (i % 2) * 4.6, y = 1.25 + Math.floor(i / 2) * 1.65;
    card(s, x, y, 4.4, 1.45, "13304F");
    circleIcon(s, ic, x + 0.22, y + 0.25, 0.55);
    T(s, h, { x: x + 0.95, y: y + 0.2, w: 3.3, h: 0.6, fontSize: 15, bold: true, color: C.background1 });
    T(s, d, { x: x + 0.95, y: y + 0.85, w: 3.3, h: 0.45, fontSize: 13, color: C.accent5 });
  });
  s.addNotes("Apresentador: Victor. Retomar a pergunta do slide 2 e responder com os números. Encerrar convidando para as perguntas.");

  // ===== 14. Referências =====
  s = slide("CONTEUDO", "Discussão e conclusão");
  s.addText("Referências", { placeholder: "title" });
  circleIcon(s, ICON.book, 0.5, 1.25, 0.55);
  const refs = [
    "ÇENGEL, Y. A.; CIMBALA, J. M. Mecânica dos fluidos: fundamentos e aplicações. 3. ed. Porto Alegre: AMGH, 2015.",
    "FOX, R. W.; McDONALD, A. T.; PRITCHARD, P. J. Introdução à mecânica dos fluidos. 8. ed. Rio de Janeiro: LTC, 2014.",
    "INCROPERA, F. P. et al. Fundamentos de transferência de calor e de massa. 6. ed. Rio de Janeiro: LTC, 2008.",
    "INTEL CORPORATION. 4-Wire Pulse Width Modulation (PWM) Controlled Fans: specification. Rev. 1.3. Intel, 2005.",
    "WHITE, F. M. Mecânica dos fluidos. 6. ed. Porto Alegre: AMGH, 2011.",
  ];
  T(s, refs.map((r, i) => ({ text: r, options: { breakLine: i < refs.length - 1 } })),
    { x: 1.3, y: 1.25, w: 8.2, h: 3.0, fontSize: 13, paraSpaceAfter: 10 });
  T(s, "Obrigado! Perguntas?", { x: 1.3, y: 4.35, w: 8.2, h: 0.45, fontSize: 22, bold: true, color: C.accent1 });
  s.addNotes("Todos. Cada integrante deve estar pronto para responder sobre qualquer parte, principalmente os cálculos.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("ok");
})();
