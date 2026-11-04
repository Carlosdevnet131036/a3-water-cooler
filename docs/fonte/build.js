const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, WidthType, ShadingType, BorderStyle, Footer,
  PageNumber, PageBreak, LevelFormat,
} = require("docx");

const DIR = __dirname;
const FONT = "Arial";
const LINE = 360; // espaçamento 1,5
const CM = 567;   // 1 cm em DXA
const TEXT_W = 11906 - 2 * Math.round(2.5 * CM); // largura útil A4

// ---------- auxiliares ----------
function runs(text, opts = {}) {
  // **negrito** e _itálico_ simples
  const out = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...opts }));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...opts }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...opts }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...opts }));
  return out;
}
const P = (text) => new Paragraph({
  children: runs(text), alignment: AlignmentType.JUSTIFIED,
  indent: { firstLine: Math.round(1.25 * CM) }, spacing: { line: LINE, after: 120 },
});
const H1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
const EQ = (expr, n) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { line: LINE, before: 60, after: 60 },
  children: [new TextRun({ text: expr, italics: false }), new TextRun({ text: `     (${n})` })],
});
const BUL = (text) => new Paragraph({
  numbering: { reference: "bul", level: 0 }, alignment: AlignmentType.JUSTIFIED,
  spacing: { line: LINE, after: 60 }, children: runs(text),
});
const CALC = (text) => new Paragraph({
  indent: { left: Math.round(1.0 * CM) }, spacing: { line: LINE, after: 40 }, children: [new TextRun(text)],
});
const CAP = (text) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 60, after: 0 },
  children: runs(text, { size: 20 }),
});
const SRC = (text) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after: 200 },
  children: [new TextRun({ text, size: 20 })],
});
function FIG(file, wPx, hPx, widthCm) {
  const w = Math.round(widthCm * 37.8);
  return new Paragraph({
    alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120 },
    children: [new ImageRun({
      type: "png", data: fs.readFileSync(path.join(DIR, file)),
      transformation: { width: w, height: Math.round(w * hPx / wPx) },
    })],
  });
}
const border = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
const borders = { top: border, bottom: border, left: border, right: border };
function TABLE(rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    alignment: AlignmentType.CENTER,
    rows: rows.map((r, i) => new TableRow({
      tableHeader: i === 0,
      children: r.map((c, j) => new TableCell({
        borders, width: { size: widths[j], type: WidthType.DXA },
        shading: i === 0 ? { fill: "D9E2F3", type: ShadingType.CLEAR, color: "auto" } : undefined,
        margins: { top: 40, bottom: 40, left: 100, right: 100 },
        children: [new Paragraph({
          alignment: j === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
          children: [new TextRun({ text: c, size: 20, bold: i === 0 })],
        })],
      })),
    })),
  });
}
const C = (text, o = {}) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { line: LINE, after: o.after ?? 0, before: o.before ?? 0 },
  children: [new TextRun({ text, bold: !!o.bold, size: o.size ?? 24 })],
});
const blank = (n = 1) => Array.from({ length: n }, () => new Paragraph({ children: [] }));

// ---------- capa ----------
const integrantes = [
  ["Alexandre Pinho do Rosario Filho", "12825211259"],
  ["Carlos Henrique Pereira da Silva", "12823112833"],
  ["Daniela Brito da Silva", "12822118118"],
  ["Raffael Morais Dutra", "12825133242"],
  ["Victor Hugo Paiva dos Santos", "12823129297"],
];
const capa = [
  C("UNIVERSIDADE POTIGUAR – UNP", { bold: true }),
  C("Sistemas Fluidomecânicos"),
  C("Prof. Dr. Ronyclei Raimundo da Silva"),
  ...blank(5),
  C("A3 – GRUPO 3", { bold: true }),
  C("WATER COOLER PARA PROCESSADORES E PLACAS DE VÍDEO", { bold: true, size: 28 }),
  C("Escoamento em circuito fechado, perdas de carga e controle por PWM", { after: 0 }),
  ...blank(5),
  ...integrantes.map(([n, ra]) => C(`${n} – Matrícula: ${ra}`)),
  ...blank(5),
  C("Natal/RN"),
  C("Novembro de 2026"),
  new Paragraph({ children: [new PageBreak()] }),
];

// ---------- conteúdo ----------
const corpo = [
  H1("1 Introdução e objetivo"),
  P("Processadores (CPU) e placas de vídeo (GPU) modernos convertem praticamente toda a energia elétrica que consomem em calor. Um processador de desempenho pode dissipar mais de 250 W em uma área de silício de poucos centímetros quadrados, e uma placa de vídeo topo de linha ultrapassa 300 W. Quando a temperatura do chip se aproxima do limite de operação, normalmente em torno de 95 a 100 °C, o próprio hardware reduz a frequência de trabalho (_thermal throttling_) para se proteger, o que significa perda direta de desempenho."),
  P("O resfriamento a ar, formado por dissipador metálico e ventoinha, tem limitações nesse cenário, porque o ar possui baixa massa específica e baixo calor específico. A água, por outro lado, transporta cerca de 3.500 vezes mais energia térmica por unidade de volume que o ar para a mesma variação de temperatura. Por isso, sistemas de refrigeração líquida em circuito fechado, chamados de _water coolers_, tornaram-se comuns em computadores de alto desempenho. O problema estudado é: como garantir uma vazão de líquido suficiente para retirar o calor da CPU e da GPU sem desperdiçar energia na bomba e sem gerar ruído excessivo? A resposta depende do escoamento do fluido, isto é, da relação entre vazão, viscosidade, perdas de carga e a pressão fornecida pela bomba."),
  P("O **objetivo** deste estudo é analisar o escoamento do líquido em um _water cooler_ customizado, calcular a vazão, o regime de escoamento, as perdas de carga e a potência hidráulica exigida da bomba, e mostrar como sensores e controle por modulação por largura de pulso (PWM) permitem ajustar dinamicamente a bomba e as ventoinhas para otimizar a eficiência térmica do hardware."),

  H1("2 Fundamentação teórica"),
  H2("2.1 Massa específica e viscosidade"),
  P("A **massa específica** (ρ) é a massa de fluido por unidade de volume, em kg/m³. Para a água a 35 °C, temperatura típica do líquido em um _water cooler_, ρ ≈ 994 kg/m³. A **viscosidade dinâmica** (μ), em Pa·s, mede a resistência do fluido ao escoamento, ou seja, o atrito interno entre camadas de fluido que se movem com velocidades diferentes (ÇENGEL; CIMBALA, 2015). A viscosidade da água diminui com a temperatura: vale cerca de 1,0 × 10⁻³ Pa·s a 20 °C e 0,72 × 10⁻³ Pa·s a 35 °C. A adição de etilenoglicol ou propilenoglicol, usada como anticongelante e anticorrosivo, aumenta a viscosidade e, consequentemente, as perdas de carga."),
  H2("2.2 Vazão e equação da continuidade"),
  P("A **vazão volumétrica** (Q), em m³/s, é o volume de fluido que atravessa uma seção por unidade de tempo. Para um escoamento com velocidade média V em um tubo de área A, tem-se a equação (1). Em um circuito fechado sem vazamentos e com fluido incompressível, a vazão mássica ṁ = ρ·Q é a mesma em todos os pontos do circuito, o que expressa o **princípio da continuidade**, equação (2). Assim, onde a área diminui, como nos microcanais do bloco da CPU, a velocidade aumenta."),
  EQ("Q = V · A", 1),
  EQ("ρ · V₁ · A₁ = ρ · V₂ · A₂", 2),
  H2("2.3 Número de Reynolds"),
  P("O **número de Reynolds** (Re) é a razão entre as forças de inércia e as forças viscosas e indica o regime do escoamento (FOX; McDONALD; PRITCHARD, 2014). Em tubos circulares, considera-se usualmente escoamento laminar para Re < 2.300, de transição entre 2.300 e 4.000 e turbulento acima de 4.000."),
  EQ("Re = ρ · V · D / μ", 3),
  H2("2.4 Perdas de carga distribuídas e localizadas"),
  P("Ao percorrer o circuito, o fluido perde energia mecânica por atrito. A **perda de carga distribuída** ocorre ao longo dos trechos retos de tubo e é calculada pela equação de Darcy-Weisbach (4), em que f é o fator de atrito, L o comprimento e D o diâmetro interno. Para escoamento laminar, f = 64/Re; para escoamento turbulento em tubo liso com Re até 10⁵, pode-se usar a correlação de Blasius (5). As **perdas de carga localizadas** ocorrem em conexões, curvas, entradas e saídas de componentes e são calculadas pela equação (6), com o coeficiente K tabelado para cada acessório (WHITE, 2011)."),
  EQ("Δp_d = f · (L / D) · (ρ · V² / 2)", 4),
  EQ("f = 0,316 / Re^0,25", 5),
  EQ("Δp_L = ΣK · (ρ · V² / 2)", 6),
  H2("2.5 Bomba, curva do sistema e leis de semelhança"),
  P("A bomba centrífuga fornece ao fluido a energia necessária para vencer todas as perdas do circuito. Como as perdas variam aproximadamente com o quadrado da velocidade, a **curva do sistema** pode ser escrita como Δp ≈ k·Q². A potência hidráulica entregue ao fluido é dada pela equação (7), e a altura manométrica correspondente pela equação (8). Quando a rotação n da bomba é alterada, as **leis de semelhança (afinidade)** estimam o novo ponto de operação (9)."),
  EQ("P_h = Δp · Q     (7)          H = Δp / (ρ · g)", 8),
  EQ("Q₂/Q₁ = n₂/n₁ ;   Δp₂/Δp₁ = (n₂/n₁)² ;   P₂/P₁ = (n₂/n₁)³", 9),
  H2("2.6 Balanço de energia térmica"),
  P("Em regime permanente, o calor gerado pelos chips é transportado pelo líquido até o radiador. O aumento de temperatura do líquido entre a entrada e a saída dos blocos é obtido pela equação (10), em que c_p é o calor específico, cerca de 4.178 J/(kg·K) para a água (INCROPERA et al., 2008). Essa equação liga diretamente a vazão, uma grandeza fluidomecânica, ao desempenho térmico do sistema."),
  EQ("Q̇ = ṁ · c_p · ΔT", 10),

  H1("3 Descrição do sistema"),
  P("O sistema estudado é um _water cooler_ customizado que resfria simultaneamente a CPU e a GPU. O **fluido de trabalho** é água destilada com aditivo anticorrosivo e biocida em pequena concentração. Neste trabalho, adota-se a hipótese de que suas propriedades são iguais às da água pura a 35 °C. Os componentes principais são:"),
  BUL("**Reservatório:** armazena o líquido, permite o enchimento e a retirada de bolhas de ar e garante que a sucção da bomba esteja sempre inundada."),
  BUL("**Bomba centrífuga de 12 V com controle PWM:** fornece a diferença de pressão que mantém o escoamento. A rotação é ajustada pelo sinal PWM e informada por um sinal de tacômetro."),
  BUL("**Blocos de água (water blocks) da CPU e da GPU:** placas de cobre com microcanais em contato com os chips por meio de pasta térmica. A grande área de troca e a velocidade elevada nos microcanais aumentam a transferência de calor, mas também concentram a maior parte da perda de carga."),
  BUL("**Radiador de 360 mm com três ventoinhas PWM:** trocador de calor de tubos e aletas em que o calor do líquido é transferido para o ar ambiente."),
  BUL("**Mangueiras de 10 mm de diâmetro interno e conexões:** ligam os componentes e formam o circuito fechado."),
  P("A Figura 1 mostra o esquema do circuito, com o sentido do escoamento e a posição dos sensores. O líquido frio sai do reservatório, é impulsionado pela bomba, absorve calor na CPU e na GPU, perde calor no radiador e retorna ao reservatório."),
  FIG("fig1_circuito.png", 1600, 920, 13.5),
  CAP("**Figura 1** – Esquema do circuito de refrigeração líquida, com sentido do escoamento e sensores S1 a S4."),
  SRC("Fonte: elaborado pelos autores (2026)."),

  H1("4 Integração com a Computação"),
  P("O _water cooler_ só atinge boa eficiência quando a bomba e as ventoinhas são controladas de acordo com a carga de trabalho. Para isso, o sistema utiliza os seguintes sensores e recursos computacionais:"),
  BUL("**Sensores internos de temperatura da CPU e da GPU:** sensores digitais integrados ao silício, lidos pela BIOS/placa-mãe e pelo sistema operacional."),
  BUL("**S2 e S3 – termistores NTC de 10 kΩ:** medem a temperatura do líquido na saída dos blocos (quente) e na saída do radiador (fria). O microcontrolador lê a tensão de um divisor resistivo pelo conversor analógico-digital e converte em temperatura pela equação de Steinhart-Hart."),
  BUL("**S1 – sensor de fluxo do tipo turbina com efeito Hall:** gera pulsos com frequência proporcional à vazão, contados pelo microcontrolador por interrupção."),
  BUL("**S4 – tacômetro da bomba:** o fio de tacômetro do conector de 4 pinos gera dois pulsos por volta, permitindo calcular a rotação em RPM."),
  P("Os atuadores são a bomba e as ventoinhas, controladas por sinais **PWM de 25 kHz**, conforme a especificação de ventoinhas de 4 fios da Intel (INTEL, 2005). O _duty cycle_ (percentual de tempo em nível alto) define a rotação: um _duty_ de 70% resulta em aproximadamente 70% da rotação máxima. O controle pode ser feito pela própria placa-mãe ou por um microcontrolador dedicado, como um Arduino ou ESP32."),
  P("A estratégia proposta usa como referência a **temperatura do líquido** e não a temperatura instantânea do chip. Como o líquido tem grande inércia térmica, essa escolha evita variações bruscas de rotação a cada pico de carga e reduz o ruído. A Figura 2 apresenta o fluxograma de medição, processamento e ação, incluindo a geração de alerta em caso de falha na circulação."),
  FIG("fig2_fluxograma.png", 1280, 1480, 7.0),
  CAP("**Figura 2** – Fluxograma de medição, processamento e ação do controle da bomba e das ventoinhas."),
  SRC("Fonte: elaborado pelos autores (2026)."),

  H1("5 Estudo aplicado e discussão"),
  H2("5.1 Dados e hipóteses"),
  P("Os dados a seguir foram **adotados para um exemplo hipotético**, com valores típicos de equipamentos comerciais. As perdas nos blocos e no radiador são valores representativos de catálogos e não foram medidas pelo grupo. Hipóteses: regime permanente; fluido incompressível com propriedades constantes; tubos lisos; perdas dos componentes proporcionais a Q²."),
  TABLE([
    ["Grandeza", "Símbolo", "Valor (SI)"],
    ["Calor a dissipar (CPU)", "Q̇", "250 W"],
    ["Vazão com bomba a 100%", "Q", "1,5 L/min = 2,5 × 10⁻⁵ m³/s"],
    ["Diâmetro interno da mangueira", "D", "0,010 m"],
    ["Comprimento total de mangueira", "L", "1,2 m"],
    ["Soma dos coeficientes de conexões e curvas", "ΣK", "5,0"],
    ["Perda no bloco + radiador a 1,5 L/min", "Δp_comp", "1.200 + 400 = 1.600 Pa"],
    ["Água a 35 °C", "ρ; μ; c_p", "994 kg/m³; 0,72 × 10⁻³ Pa·s; 4.178 J/(kg·K)"],
  ], [3900, 1500, 3500]),
  CAP("**Tabela 1** – Dados adotados para o exemplo numérico."),
  SRC("Fonte: elaborado pelos autores (2026), com valores típicos de catálogos."),
  H2("5.2 Cálculos"),
  P("**a) Velocidade e regime de escoamento.**"),
  CALC("A = π·D²/4 = π·(0,010)²/4 = 7,854 × 10⁻⁵ m²"),
  CALC("V = Q/A = 2,5 × 10⁻⁵ / 7,854 × 10⁻⁵ = 0,318 m/s"),
  CALC("Re = 994 × 0,318 × 0,010 / 0,72 × 10⁻³ ≈ 4.394 (turbulento)"),
  P("**b) Perdas de carga.** Pressão dinâmica: ρ·V²/2 = 994 × 0,318²/2 = 50,4 Pa."),
  CALC("f = 0,316 / 4.394^0,25 = 0,0388  →  Δp_d = 0,0388 × (1,2/0,010) × 50,4 ≈ 235 Pa"),
  CALC("Δp_L = 5,0 × 50,4 ≈ 252 Pa  →  Δp_total = 235 + 252 + 1.600 ≈ 2.086 Pa"),
  P("**c) Altura manométrica e potência hidráulica.**"),
  CALC("H = 2.086 / (994 × 9,81) ≈ 0,214 m ;   P_h = 2.086 × 2,5 × 10⁻⁵ ≈ 0,052 W"),
  P("**d) Aquecimento do líquido.**"),
  CALC("ṁ = 994 × 2,5 × 10⁻⁵ = 0,0249 kg/s  →  ΔT = 250 / (0,0249 × 4.178) ≈ 2,4 K"),
  P("**e) Redução do PWM da bomba para 70%.** Pelas leis de semelhança (9), com n₂/n₁ = 0,7: Q₂ = 1,05 L/min; Δp₂ = 0,49 × 2.086 ≈ 1.022 Pa; P_h₂ = 0,343 × 0,052 ≈ 0,018 W. O novo número de Reynolds é 0,7 × 4.394 ≈ 3.076 (transição) e o aquecimento do líquido passa a ΔT = 250/(0,0174 × 4.178) ≈ 3,4 K. A Figura 3 mostra os dois pontos de operação sobre a curva do sistema, e a Tabela 2 resume os resultados."),
  FIG("fig3_curva.png", 1280, 720, 11.5),
  CAP("**Figura 3** – Curva do sistema e pontos de operação com a bomba a 100% e a 70% do PWM."),
  SRC("Fonte: elaborado pelos autores (2026)."),
  TABLE([
    ["Resultado", "PWM 100%", "PWM 70%"],
    ["Vazão (L/min)", "1,50", "1,05"],
    ["Número de Reynolds", "4.394 (turbulento)", "3.076 (transição)"],
    ["Perda de carga total (Pa)", "2.086", "≈ 1.022"],
    ["Potência hidráulica (W)", "0,052", "0,018"],
    ["Aquecimento do líquido ΔT (K)", "2,4", "3,4"],
  ], [3900, 2500, 2500]),
  CAP("**Tabela 2** – Resumo dos resultados do exemplo numérico."),
  SRC("Fonte: elaborado pelos autores (2026)."),
  H2("5.3 Interpretação dos resultados"),
  P("O escoamento nas mangueiras é turbulento, mas próximo da transição, e cerca de 77% da perda de carga total está nos componentes, principalmente nos microcanais do bloco da CPU. Isso mostra que a escolha do bloco e do radiador pesa mais na seleção da bomba do que o comprimento das mangueiras."),
  P("A potência hidráulica de apenas 0,05 W é muito menor que a potência elétrica das bombas comerciais, que fica entre 5 e 20 W. A maior parte da energia elétrica da bomba vira calor dentro do próprio circuito, o que justifica reduzir a rotação quando a carga é baixa. Ao reduzir o PWM para 70%, a vazão cai 30%, mas o aquecimento do líquido aumenta só 1 K, uma diferença pequena diante da temperatura de operação do chip. A potência hidráulica cai cerca de 65%, e o ruído da bomba diminui."),
  P("O cálculo direto a 70%, com f = 0,0424, resulta em 1.033 Pa, próximo dos 1.022 Pa das leis de semelhança: a pequena diferença vem do aumento do fator de atrito quando Re diminui."),
  H2("5.4 Limitação, falha e proposta de melhoria"),
  P("A principal falha de um _water cooler_ é a **interrupção ou redução da circulação**, causada por parada da bomba, ar preso no circuito ou entupimento dos microcanais por depósitos e crescimento biológico. Sem escoamento, o líquido parado no bloco aquece rapidamente, e a CPU atinge o limite térmico em poucos segundos. Muitos sistemas monitoram apenas a temperatura do chip, e a falha só é percebida quando o hardware já está em _throttling_. Além disso, o tacômetro da bomba informa a rotação, mas não a vazão real. Uma bomba girando com ar no rotor ou contra um bloco entupido pode indicar RPM normal e vazão quase nula."),
  P("Como **proposta de melhoria**, recomenda-se instalar o sensor de fluxo S1 e implementar a lógica de diagnóstico da Figura 2, que combina três verificações: (i) vazão abaixo do mínimo definido, por exemplo 0,5 L/min; (ii) RPM da bomba igual a zero; (iii) ΔT entre S2 e S3 crescente com a mesma carga, o que indica perda gradual de vazão. Ao detectar a falha, o sistema eleva o _duty_ para 100%, emite um alerta e solicita a redução da frequência do processador antes do desligamento por temperatura. O registro da tendência da vazão também permite programar a manutenção preventiva antes que o entupimento se torne crítico."),

  H1("6 Conclusão"),
  P("O estudo mostrou que o desempenho de um _water cooler_ depende diretamente da mecânica dos fluidos: a vazão define quanto calor o líquido transporta, e a viscosidade e o regime de escoamento determinam as perdas de carga que a bomba precisa vencer, concentradas nos blocos e no radiador. O exemplo numérico indicou que uma vazão de 1,5 L/min, em regime turbulento, exige apenas cerca de 2,1 kPa e 0,05 W de potência hidráulica para manter o aquecimento do líquido em 2,4 K com 250 W de carga. Também mostrou que reduzir a rotação da bomba por PWM diminui fortemente a potência e o ruído, com pequeno impacto térmico. Por fim, a integração de sensores de temperatura, fluxo e rotação com um controle baseado na temperatura do líquido permite otimizar a eficiência do sistema e detectar falhas de circulação antes que elas prejudiquem o hardware. Dessa forma, o objetivo do trabalho foi atendido."),

  H1("Contribuição dos integrantes"),
  BUL("Alexandre Pinho do Rosario Filho – [descrever a contribuição]"),
  BUL("Carlos Henrique Pereira da Silva – [descrever a contribuição]"),
  BUL("Daniela Brito da Silva – [descrever a contribuição]"),
  BUL("Raffael Morais Dutra – [descrever a contribuição]"),
  BUL("Victor Hugo Paiva dos Santos – [descrever a contribuição]"),

  H1("Referências"),
  ...[
    "ÇENGEL, Y. A.; CIMBALA, J. M. **Mecânica dos fluidos: fundamentos e aplicações**. 3. ed. Porto Alegre: AMGH, 2015.",
    "FOX, R. W.; McDONALD, A. T.; PRITCHARD, P. J. **Introdução à mecânica dos fluidos**. 8. ed. Rio de Janeiro: LTC, 2014.",
    "INCROPERA, F. P. et al. **Fundamentos de transferência de calor e de massa**. 6. ed. Rio de Janeiro: LTC, 2008.",
    "INTEL CORPORATION. **4-Wire Pulse Width Modulation (PWM) Controlled Fans**: specification. Revision 1.3. [S. l.]: Intel, 2005.",
    "WHITE, F. M. **Mecânica dos fluidos**. 6. ed. Porto Alegre: AMGH, 2011.",
  ].map((t) => new Paragraph({ children: runs(t), spacing: { after: 200 }, alignment: AlignmentType.LEFT })),
];

const doc = new Document({
  creator: "Grupo 3",
  title: "A3 – Grupo 3 – Water cooler para processadores e placas de vídeo",
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 24, bold: true },
        paragraph: { spacing: { before: 360, after: 120, line: LINE }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 24, bold: false },
        paragraph: { spacing: { before: 200, after: 80, line: LINE }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [{ reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•",
      alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }],
  },
  sections: [
    {
      properties: {
        page: { margin: { top: 1417, bottom: 1417, left: 1417, right: 1417 } },
        titlePage: true,
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
          children: [new TextRun({ children: [PageNumber.CURRENT], size: 20 })] })] }),
        first: new Footer({ children: [] }),
      },
      children: [...capa, ...corpo],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(path.join(DIR, "A3_Grupo3_WaterCooler_Relatorio.docx"), buf);
  console.log("ok");
});
