// Modo apresentação: telas 16:9 no roteiro dos cinco integrantes.
// As telas não copiam os componentes da página de estudo: elas os "emprestam"
// (movem o elemento vivo para a tela e devolvem ao sair), então o 3D, o circuito,
// os medidores e os gráficos continuam ligados ao mesmo simulador.

import type { Scene3dApi, View3d } from "./scene3d";

export type Scenario = "ref" | "pwm70" | "stoppedNoDiag" | "stoppedDiag";

interface Api {
  applyScenario(name: Scenario): void;
  scene3d: Scene3dApi;
}

type Speaker = "Alexandre" | "Carlos" | "Daniela" | "Raffael" | "Victor" | "Todos";

interface Slide {
  speaker: Speaker;
  title: string;
  html: string;
  notes: string;
  scenario?: Scenario; // aplicado ao entrar na tela
  view3d?: { view: View3d; cut?: boolean; pressure?: boolean; heat?: boolean; showcase?: boolean };
}

// Componentes da página que podem ser emprestados pelas telas.
const MOUNTS: Record<string, string[]> = {
  model3d: [".stage3d"],
  loop: [".loop-panel"],
  gauges: ["#gauges"],
  reynolds: [".re-panel"],
  chart: [".chart-wrap"],
  losses: ["#stack", ".stack-legend"],
  cycle: ["#cycle"],
  pwm: [".pwm-row"],
  alert: ["#alert"],
};

const mount = (name: string) => `<div class="mount mount-${name}" data-mount="${name}"></div>`;
const scenarioButtons = (items: [Scenario, string][]) =>
  `<div class="deck-actions">${items.map(([s, l]) => `<button type="button" data-scenario="${s}">${l}</button>`).join("")}</div>`;

function viscosityChart() {
  const pts: [number, number][] = [[20, 1.002], [30, 0.798], [40, 0.653], [50, 0.547], [60, 0.467]];
  const x = (t: number) => 60 + ((t - 20) / 40) * 420;
  const y = (m: number) => 250 - (m / 1.2) * 220;
  const grid = [0, 0.3, 0.6, 0.9, 1.2].map((m) =>
    `<line x1="60" x2="480" y1="${y(m)}" y2="${y(m)}" class="v-grid"/><text x="50" y="${y(m) + 4}" text-anchor="end">${m.toFixed(1).replace(".", ",")}</text>`).join("");
  const path = pts.map(([t, m], i) => `${i ? "L" : "M"}${x(t)} ${y(m)}`).join(" ");
  const dots = pts.map(([t, m]) =>
    `<circle cx="${x(t)}" cy="${y(m)}" r="6" class="v-dot"/><text x="${x(t)}" y="${y(m) - 14}" text-anchor="middle" class="v-val">${m.toFixed(2).replace(".", ",")}</text><text x="${x(t)}" y="274" text-anchor="middle">${t} °C</text>`).join("");
  return `<svg class="visc" viewBox="0 0 500 290" role="img" aria-label="Viscosidade da água em função da temperatura">${grid}<path d="${path}" class="v-line"/>${dots}</svg>`;
}

const SLIDES: Slide[] = [
  {
    speaker: "Alexandre",
    title: "Capa",
    view3d: { view: "home", showcase: true },
    html: `<div class="slide slide-cover">
      <div class="cover-3d">${mount("model3d")}</div>
      <p class="s-eyebrow">A3 · Sistemas Fluidomecânicos · Grupo 3</p>
      <h1 class="s-hero">Water cooler para processadores e placas de vídeo</h1>
      <p class="s-lede">Escoamento em circuito fechado, perdas de carga e controle por PWM</p>
      <ul class="s-team">
        <li>Alexandre Pinho do Rosario Filho</li><li>Carlos Henrique Pereira da Silva</li>
        <li>Daniela Brito da Silva</li><li>Raffael Morais Dutra</li><li>Victor Hugo Paiva dos Santos</li>
      </ul>
      <p class="s-foot">Prof. Dr. Ronyclei Raimundo da Silva · Universidade Potiguar · 2026</p>
    </div>`,
    notes: "Atalhos: → e ← trocam de tela; segure Z para ampliar onde está o mouse; N mostra estas notas; F põe em tela cheia; 0 a 5 levam a câmera do 3D às peças. Apresentar o grupo, o tema 01 e o roteiro: problema, conceitos de fluidos, sistema, integração com a Computação, exemplo numérico, falha e melhoria, conclusão.",
  },
  {
    speaker: "Alexandre",
    title: "O problema",
    html: `<div class="slide">
      <h2 class="s-title">O problema: calor demais em pouco espaço</h2>
      <div class="s-body">
        <div class="s-stats">
          <div><b class="hot">250 W</b><span>calor de uma CPU de alto desempenho</span></div>
          <div><b>&gt; 300 W</b><span>calor de uma placa de vídeo topo de linha</span></div>
          <div><b>≈ 3.500×</b><span>mais energia por volume na água do que no ar</span></div>
        </div>
        <p class="s-callout"><b>Pergunta do trabalho:</b> como garantir vazão suficiente para retirar o calor da CPU e da GPU sem desperdiçar energia na bomba nem gerar ruído excessivo?</p>
      </div>
    </div>`,
    notes: "Acima de cerca de 95 °C o chip reduz a frequência (thermal throttling). Água: ρ·cp ≈ 4,16 MJ/(m³·K); ar: ≈ 1,2 kJ/(m³·K). Daí a razão de ~3.500 vezes.",
  },
  {
    speaker: "Alexandre",
    title: "O circuito",
    scenario: "ref",
    html: `<div class="slide">
      <h2 class="s-title">Como funciona o circuito fechado</h2>
      <div class="s-body s-media">${mount("model3d")}
        <ol class="s-steps s-steps-3d">
          <li><button type="button" data-view="pump"><b>Bomba</b> empurra a água</button></li>
          <li><button type="button" data-view="cpu"><b>Bloco da CPU</b> com microcanais recebe o calor</button></li>
          <li><button type="button" data-view="gpu"><b>Bloco da GPU</b> recebe mais calor</button></li>
          <li><button type="button" data-view="rad"><b>Radiador</b> e ventoinhas jogam o calor no ar</button></li>
          <li><button type="button" data-view="res"><b>Reservatório</b> devolve a água à bomba</button></li>
          <li class="s-step-all"><button type="button" data-view="home">Ver o circuito inteiro</button></li>
        </ol>
      </div>
    </div>`,
    view3d: { view: "home" },
    notes: "Clicar em cada passo (ou teclas 1 a 5) para a câmera ir até a peça; 0 volta ao circuito inteiro. Ligar 'Calor' para mostrar as setas de watts. Girar o modelo, clicar nas peças e usar a Vista explodida para mostrar cada componente. A água muda de cor conforme esquenta. Pergunta possível: quais grandezas S1, S2, S3 e S4 medem?",
  },
  {
    speaker: "Carlos",
    title: "Propriedades do fluido",
    html: `<div class="slide">
      <h2 class="s-title">Massa específica e viscosidade</h2>
      <div class="s-body s-split">
        <div class="s-cards">
          <div class="s-card"><h3>Massa específica ρ</h3><p>Massa por unidade de volume.</p><b>ρ ≈ 994 kg/m³ (água a 35 °C)</b></div>
          <div class="s-card"><h3>Viscosidade dinâmica μ</h3><p>Atrito interno entre camadas do fluido. Cai quando a temperatura sobe.</p><b>μ ≈ 0,72 × 10⁻³ Pa·s (35 °C)</b></div>
        </div>
        <figure class="s-figure">${viscosityChart()}<figcaption>Viscosidade da água (mPa·s) × temperatura. Fonte: Çengel e Cimbala (2015).</figcaption></figure>
      </div>
    </div>`,
    notes: "Viscosidade maior significa mais perda de carga. Com glicol a viscosidade mais que dobra, a vazão cai e a água esquenta mais. Dá para mostrar isso trocando o fluido na bancada (modo Estudo).",
  },
  {
    speaker: "Carlos",
    title: "Vazão e Reynolds",
    html: `<div class="slide">
      <h2 class="s-title">Vazão, continuidade e Reynolds</h2>
      <div class="s-body s-media-top">
        <div class="s-eqs">
          <div><span>Vazão</span><b>Q = V · A</b></div>
          <div><span>Continuidade</span><b>ρV₁A₁ = ρV₂A₂</b></div>
          <div><span>Reynolds</span><b>Re = ρVD / μ</b></div>
        </div>
        ${mount("reynolds")}
      </div>
    </div>`,
    notes: "Em circuito fechado a vazão mássica é a mesma em todos os pontos; nos microcanais a área é menor e a água acelera. No exemplo, Re ≈ 4.394: turbulento, mas perto da transição. As partículas mostram o escoamento na velocidade real.",
  },
  {
    speaker: "Carlos",
    title: "Por dentro",
    scenario: "ref",
    view3d: { view: "cut", cut: true },
    html: `<div class="slide">
      <h2 class="s-title">Por dentro do bloco e da mangueira</h2>
      <div class="s-body s-media">${mount("model3d")}
        <div class="s-side">
          <div class="s-eqs s-eqs-col">
            <div><span>Laminar · Re &lt; 2.300</span><b>perfil parabólico</b></div>
            <div><span>Turbulento · Re &gt; 4.000</span><b>perfil achatado</b></div>
            <div><span>Microcanais</span><b>A menor → V maior</b></div>
          </div>
          <p class="s-text">As setas mostram a velocidade em cada ponto do diâmetro. Na parede a água fica parada (condição de não escorregamento).</p>
        </div>
      </div>
    </div>`,
    notes: "No corte, a tampa do bloco some e aparece a água entre as aletas, mais rápida que na mangueira (continuidade). O perfil acima da mangueira muda ao vivo: com bomba a 100 % (Re ≈ 4.394) é achatado; reduzindo a bomba no modo Estudo, Re cai e o perfil vira parábola. O botão Pressão colore as mangueiras pela pressão: a maior queda é no bloco.",
  },
  {
    speaker: "Daniela",
    title: "Perdas e bomba",
    html: `<div class="slide">
      <h2 class="s-title">Perdas de carga e a bomba</h2>
      <div class="s-body s-media">
        ${mount("chart")}
        <div class="s-side">
          <div class="s-eqs s-eqs-col">
            <div><span>Distribuída</span><b>Δp = f (L/D) ρV²/2</b></div>
            <div><span>Localizada</span><b>Δp = ΣK ρV²/2</b></div>
            <div><span>Bomba</span><b>Pₕ = Δp · Q</b></div>
          </div>
          ${mount("losses")}
        </div>
      </div>
    </div>`,
    notes: "O ponto vermelho é o ponto de operação: onde a pressão da bomba iguala a perda do circuito. Quase 80 % da perda está no bloco e no radiador. Leis de semelhança: Q ∝ n, Δp ∝ n², P ∝ n³.",
  },
  {
    speaker: "Daniela",
    title: "Sensores e PWM",
    html: `<div class="slide">
      <h2 class="s-title">Sensores e controle por PWM</h2>
      <div class="s-body s-split">
        <div class="s-sensors">
          <div><b>S1 · Fluxo</b><span>turbina com efeito Hall: pulsos ∝ vazão</span></div>
          <div><b>S2 e S3 · Temperatura</b><span>NTC 10 kΩ na água quente e na fria</span></div>
          <div><b>S4 · Rotação</b><span>tacômetro da bomba: 2 pulsos por volta</span></div>
          <div><b>CPU e GPU</b><span>sensores internos lidos pela BIOS</span></div>
        </div>
        <div class="s-side">
          <h3 class="s-sub">PWM de 25 kHz</h3>
          ${mount("pwm")}
          <p class="s-text">O duty cycle é a fração do tempo em nível alto. 70 % de duty ≈ 70 % da rotação (hipótese didática).</p>
        </div>
      </div>
    </div>`,
    notes: "NTC lido pelo ADC do microcontrolador (divisor resistivo + Steinhart-Hart). Sensor de fluxo contado por interrupção. PWM conforme a especificação de ventoinhas de 4 fios da Intel (2005).",
  },
  {
    speaker: "Daniela",
    title: "Ciclo de controle",
    html: `<div class="slide">
      <h2 class="s-title">Medir, decidir, agir</h2>
      <div class="s-body s-media">${mount("loop")}${mount("cycle")}</div>
    </div>`,
    notes: "O ciclo roda a cada segundo com as leituras do circuito ao lado. A referência do controle é a temperatura da água, que muda devagar, para a bomba e as ventoinhas não oscilarem a cada pico de carga.",
  },
  {
    speaker: "Raffael",
    title: "Dados do exemplo",
    html: `<div class="slide">
      <h2 class="s-title">Exemplo numérico: dados e hipóteses</h2>
      <div class="s-body s-split">
        <table class="s-table">
          <tr><th>Grandeza</th><th>Valor (SI)</th></tr>
          <tr><td>Calor a dissipar (CPU)</td><td>250 W</td></tr>
          <tr><td>Vazão com bomba a 100 %</td><td>1,5 L/min = 2,5 × 10⁻⁵ m³/s</td></tr>
          <tr><td>Mangueira</td><td>D = 0,010 m · L = 1,2 m</td></tr>
          <tr><td>Conexões e curvas</td><td>ΣK = 5,0</td></tr>
          <tr><td>Bloco + radiador</td><td>1.200 + 400 = 1.600 Pa</td></tr>
          <tr><td>Água a 35 °C</td><td>ρ = 994 kg/m³ · μ = 0,72 mPa·s · cp = 4.178 J/(kg·K)</td></tr>
        </table>
        <div class="s-card"><h3>Hipóteses</h3><ul><li>Regime permanente</li><li>Fluido incompressível</li><li>Tubos lisos</li><li>Perdas dos componentes ∝ Q²</li></ul><p class="hot">Dados adotados (hipotéticos), com valores típicos de catálogos.</p></div>
      </div>
    </div>`,
    notes: "Deixar claro que os dados são hipotéticos, como o relatório identifica. O bloco da CPU é o componente com maior perda.",
  },
  {
    speaker: "Raffael",
    title: "Resolução",
    html: `<div class="slide">
      <h2 class="s-title">Resolução passo a passo</h2>
      <div class="s-body">
        <div class="s-calc">
          <div><span>a) Regime</span><b>Re ≈ 4.394</b><p>V = Q/A = 0,318 m/s<br>Re = ρVD/μ → turbulento</p></div>
          <div><span>b) Perdas</span><b class="hot">2.086 Pa</b><p>distribuída 234,5 Pa<br>localizada 251,8 Pa<br>componentes 1.600 Pa</p></div>
          <div><span>c) Bomba</span><b>0,052 W</b><p>H = Δp/(ρg) = 0,214 m<br>Pₕ = Δp · Q</p></div>
          <div><span>d) Aquecimento</span><b>ΔT ≈ 2,4 K</b><p>ṁ = ρQ = 0,0249 kg/s<br>ΔT = Q̇ / (ṁ cp)</p></div>
        </div>
      </div>
    </div>`,
    notes: "a) A = πD²/4 = 7,854×10⁻⁵ m²; V = 0,318 m/s; Re = 994×0,318×0,010/0,72×10⁻³ ≈ 4.394. b) ρV²/2 = 50,4 Pa; f = 0,0388; Δp_d ≈ 234,5 Pa; Δp_L ≈ 251,8 Pa; total ≈ 2.086 Pa. c) H ≈ 0,214 m; Pₕ = 2.086×2,5×10⁻⁵ ≈ 0,052 W. d) ΔT = 250/(0,0249×4.178) ≈ 2,4 K.",
  },
  {
    speaker: "Victor",
    title: "Bomba a 70 %",
    scenario: "ref",
    html: `<div class="slide">
      <h2 class="s-title">O que muda com a bomba a 70 %?</h2>
      <div class="s-body s-media">
        ${mount("chart")}
        <div class="s-side">
          ${scenarioButtons([["ref", "Bomba a 100 %"], ["pwm70", "Bomba a 70 %"]])}
          ${mount("gauges")}
          <p class="s-callout"><b>−30 % de vazão custa só cerca de +1 K</b> e a potência hidráulica cai ≈ 65 % (∝ n³).</p>
        </div>
      </div>
    </div>`,
    notes: "Clicar em 'Bomba a 70 %' e mostrar o ponto descendo pela curva do sistema. Leis de semelhança com n₂/n₁ = 0,7: Q × 0,7; Δp × 0,49; P × 0,343. Pergunta possível: como vazão, Reynolds e perda de carga se relacionam?",
  },
  {
    speaker: "Victor",
    title: "Falha e melhoria",
    scenario: "ref",
    html: `<div class="slide slide-fault">
      <h2 class="s-title">Quando a bomba para</h2>
      <div class="s-body s-media">
        ${mount("model3d")}
        <div class="s-side">
          ${scenarioButtons([["stoppedNoDiag", "Parar · sem diagnóstico"], ["stoppedDiag", "Parar · com diagnóstico"], ["ref", "Voltar ao normal"]])}
          ${mount("alert")}
          ${mount("gauges")}
          <p class="s-text"><b>Proposta:</b> sensor de vazão + tacômetro + temperaturas. Vazão &lt; 0,5 L/min ou RPM = 0 → alerta, PWM 100 % e redução de carga.</p>
        </div>
      </div>
    </div>`,
    view3d: { view: "fault" },
    notes: "No 3D: as partículas param, a bomba deixa de girar, o bloco da CPU começa a brilhar em vermelho e aparece o aviso sobre a bomba. Primeiro 'sem diagnóstico': a vazão e o RPM vão a zero e só a proteção térmica do chip atua. Depois 'com diagnóstico': mesmas temperaturas iniciais, o alerta aparece antes. Pergunta possível: por que aumentar o PWM não resolve uma bomba parada? A proteção reduz a carga, mas não elimina a falha.",
  },
  {
    speaker: "Victor",
    title: "Conclusão",
    html: `<div class="slide slide-dark">
      <h2 class="s-title">Conclusão</h2>
      <div class="s-body">
        <div class="s-concl">
          <div><b>A vazão define quanto calor a água transporta</b><span>1,5 L/min mantém ΔT ≈ 2,4 K com 250 W</span></div>
          <div><b>As perdas se concentram nos componentes</b><span>≈ 77 % da perda total no bloco e no radiador</span></div>
          <div><b>PWM economiza com pouco impacto térmico</b><span>70 % de rotação: −65 % de potência, +1 K</span></div>
          <div><b>Sensor de vazão evita falhas silenciosas</b><span>diagnóstico antes do throttling</span></div>
        </div>
      </div>
    </div>`,
    notes: "Retomar a pergunta da tela 2 e responder com os números. Encerrar convidando para as perguntas.",
  },
  {
    speaker: "Todos",
    title: "Perguntas",
    html: `<div class="slide">
      <h2 class="s-title">Obrigado! Perguntas?</h2>
      <div class="s-body">
        <ol class="s-refs">
          <li>ÇENGEL, Y. A.; CIMBALA, J. M. <i>Mecânica dos fluidos: fundamentos e aplicações</i>. 3. ed. AMGH, 2015.</li>
          <li>FOX, R. W.; McDONALD, A. T.; PRITCHARD, P. J. <i>Introdução à mecânica dos fluidos</i>. 8. ed. LTC, 2014.</li>
          <li>INCROPERA, F. P. et al. <i>Fundamentos de transferência de calor e de massa</i>. 6. ed. LTC, 2008.</li>
          <li>INTEL. <i>4-Wire Pulse Width Modulation (PWM) Controlled Fans</i>. Rev. 1.3, 2005.</li>
          <li>WHITE, F. M. <i>Mecânica dos fluidos</i>. 6. ed. AMGH, 2011.</li>
        </ol>
        <p class="s-text">Simulador, 3D, memória de cálculo e quiz: modo <b>Estudo</b> deste site.</p>
      </div>
    </div>`,
    notes: "Todos devem estar prontos para responder sobre qualquer parte, principalmente os cálculos. O quiz do modo Estudo tem as perguntas mais prováveis.",
  },
];

const SPEAKER_CLASS: Record<Speaker, string> = {
  Alexandre: "sp-1", Carlos: "sp-2", Daniela: "sp-3", Raffael: "sp-4", Victor: "sp-5", Todos: "sp-0",
};

export function initPresentation(api: Api) {
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
  const deck = $("#deck");
  const stage = $("#deckStage");
  const notesPanel = $("#deckNotesPanel");
  const dots = $("#deckDots");
  let index = 0;
  let open = false;

  // marca o lugar original de cada componente emprestável
  const homes = new Map<Element, Comment>();
  for (const sels of Object.values(MOUNTS)) {
    for (const sel of sels) {
      document.querySelectorAll(sel).forEach((el) => {
        if (homes.has(el)) return;
        const mark = document.createComment(`lugar de ${sel}`);
        el.parentNode!.insertBefore(mark, el);
        homes.set(el, mark);
      });
    }
  }
  function returnAll() {
    for (const [el, mark] of homes) if (el.previousSibling !== mark) mark.parentNode!.insertBefore(el, mark.nextSibling);
  }

  SLIDES.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `deck-dot ${SPEAKER_CLASS[s.speaker]}`;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-label", `${i + 1}. ${s.title} (${s.speaker})`);
    b.addEventListener("click", () => go(i));
    dots.appendChild(b);
  });

  function render() {
    returnAll();
    const s = SLIDES[index];
    stage.innerHTML = `<div class="slide-frame">${s.html}</div>`;
    stage.querySelectorAll<HTMLElement>("[data-mount]").forEach((slot) => {
      for (const sel of MOUNTS[slot.dataset.mount!]) document.querySelectorAll(sel).forEach((el) => slot.appendChild(el));
    });
    stage.querySelectorAll<HTMLButtonElement>("[data-scenario]").forEach((b) =>
      b.addEventListener("click", () => {
        api.applyScenario(b.dataset.scenario as Scenario);
        stage.querySelectorAll("[data-scenario]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      }),
    );
    if (s.scenario) api.applyScenario(s.scenario);
    if (stage.querySelector('[data-mount="model3d"]')) {
      const v = s.view3d ?? { view: "home" as View3d };
      api.scene3d.showcase(!!v.showcase);
      api.scene3d.setCut(!!v.cut);
      api.scene3d.setPressure(!!v.pressure);
      api.scene3d.setHeat(!!v.heat);
      if (!v.showcase) api.scene3d.focus(v.view);
    } else api.scene3d.showcase(false);
    stage.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) =>
      b.addEventListener("click", () => {
        api.scene3d.focus(b.dataset.view as View3d);
        stage.querySelectorAll("[data-view]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      }),
    );
    const first = stage.querySelector(`[data-scenario="${s.scenario ?? ""}"]`);
    first?.setAttribute("aria-pressed", "true");
    notesPanel.textContent = s.notes;
    $("#deckCount").textContent = `${index + 1} / ${SLIDES.length}`;
    dots.querySelectorAll("button").forEach((d, i) => d.setAttribute("aria-selected", String(i === index)));
    ($("#deckPrev") as HTMLButtonElement).disabled = index === 0;
    ($("#deckNext") as HTMLButtonElement).disabled = index === SLIDES.length - 1;
  }
  function go(i: number) {
    index = Math.max(0, Math.min(SLIDES.length - 1, i));
    if (index > 0 && !started) started = Date.now(); // o cronômetro começa ao sair da capa
    // guarda a tela no endereço: se a página recarregar, volta para a mesma tela
    history.replaceState(null, "", `#apresentacao/${index + 1}`);
    render();
  }

  // cronômetro da fala (meta do edital: 12 a 15 min)
  let started = 0;
  const timer = $("#deckTimer");
  setInterval(() => {
    if (!open) return;
    const s = started ? Math.floor((Date.now() - started) / 1000) : 0;
    const mmss = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    timer.textContent = `${mmss(s)} / 15:00`;
    timer.classList.toggle("late", s >= 13 * 60);
  }, 500);
  timer.addEventListener("click", () => (started = index > 0 ? Date.now() : 0));
  timer.title = "Começa ao sair da capa. Clique para zerar.";

  // tema de projeção: ligado por padrão no modo apresentação; T alterna (a escolha fica salva no navegador)
  const root = document.documentElement;
  let themeBefore: string | null = null;
  const readPref = () => { try { return localStorage.getItem("a3-projetor") !== "0"; } catch { return true; } };
  function setProjector(on: boolean, save = false) {
    if (on) root.dataset.theme = "projector";
    else if (themeBefore) root.dataset.theme = themeBefore;
    else delete root.dataset.theme;
    $("#deckTheme").setAttribute("aria-pressed", String(on));
    if (save) try { localStorage.setItem("a3-projetor", on ? "1" : "0"); } catch { /* navegador sem armazenamento */ }
  }
  $("#deckTheme").addEventListener("click", () => setProjector(root.dataset.theme !== "projector", true));

  function setNotes(show: boolean) {
    notesPanel.hidden = !show;
    $("#deckNotes").setAttribute("aria-pressed", String(show));
  }
  $("#deckNotes").addEventListener("click", () => setNotes(notesPanel.hidden));
  async function toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await deck.requestFullscreen();
    } catch { /* tela cheia indisponível nesta janela */ }
  }
  $("#deckFull").addEventListener("click", toggleFull);
  $("#deckPrev").addEventListener("click", () => go(index - 1));
  $("#deckNext").addEventListener("click", () => go(index + 1));

  document.addEventListener("keydown", (e) => {
    if (!open || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = (e.target instanceof Element ? e.target : document.body) as HTMLElement;
    if (t.closest("input, select, textarea")) return;
    const k = e.key;
    if (k === "ArrowRight" || k === "PageDown" || (k === " " && !t.closest("button"))) { e.preventDefault(); go(index + 1); }
    else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); go(index - 1); }
    else if (k === "Home") go(0);
    else if (k === "End") go(SLIDES.length - 1);
    else if (k === "n" || k === "N") setNotes(notesPanel.hidden);
    else if (k === "f" || k === "F") toggleFull();
    else if (k === "t" || k === "T") setProjector(root.dataset.theme !== "projector", true);
  });

  // ---------- lupa: segurar Z amplia a tela em torno do mouse ----------
  const ZOOM = 1.8;
  let zTarget = 1, zScale = 1, zRun = false;
  let fx = 0.5, fy = 0.5, ox = 0.5, oy = 0.5, zLast = 0;
  const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  stage.addEventListener("pointermove", (e) => {
    const f = stage.querySelector<HTMLElement>(".slide-frame");
    if (!f) return;
    // posição relativa ao quadro sem a ampliação (offset* ignora o transform)
    const r = stage.getBoundingClientRect();
    const left = r.left + f.offsetLeft, top = r.top + f.offsetTop;
    fx = Math.min(1, Math.max(0, (e.clientX - left) / f.offsetWidth));
    fy = Math.min(1, Math.max(0, (e.clientY - top) / f.offsetHeight));
  });
  function zoomTick(now: number) {
    const f = stage.querySelector<HTMLElement>(".slide-frame");
    const dt = Math.min(0.05, (now - zLast) / 1000);
    zLast = now;
    zScale += (zTarget - zScale) * (smooth ? Math.min(1, dt * 9) : 1);
    ox += (fx - ox) * (smooth ? Math.min(1, dt * 7) : 1);
    oy += (fy - oy) * (smooth ? Math.min(1, dt * 7) : 1);
    if (f) {
      f.style.transformOrigin = `${(ox * 100).toFixed(2)}% ${(oy * 100).toFixed(2)}%`;
      f.style.transform = `scale(${zScale.toFixed(4)})`;
    }
    if (zTarget === 1 && Math.abs(zScale - 1) < 0.002) {
      zScale = 1; zRun = false;
      if (f) { f.style.transform = ""; f.style.transformOrigin = ""; }
      deck.classList.remove("zooming");
      return;
    }
    requestAnimationFrame(zoomTick);
  }
  function setZoom(on: boolean) {
    if (!on && zTarget === 1 && !zRun) return;
    zTarget = on ? ZOOM : 1;
    if (on) { ox = fx; oy = fy; deck.classList.add("zooming"); }
    if (!zRun) { zRun = true; zLast = performance.now(); requestAnimationFrame(zoomTick); }
  }
  document.addEventListener("keydown", (e) => {
    if (!open || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.target as Element | null)?.closest?.("input, select, textarea")) return;
    if (e.key === "z" || e.key === "Z") setZoom(true);
  });
  document.addEventListener("keyup", (e) => { if (e.key === "z" || e.key === "Z") setZoom(false); });
  window.addEventListener("blur", () => setZoom(false));

  // ---------- troca de modo pelo endereço (#apresentacao / #estudo) ----------
  function route() {
    const m = /^#apresentacao(?:\/(\d+))?$/.exec(location.hash);
    const present = !!m;
    if (m?.[1] && present === open) { go(Number(m[1]) - 1); return; } // endereço com outra tela
    document.querySelectorAll(".mode-tab").forEach((a) =>
      a.toggleAttribute("aria-current", (a as HTMLElement).dataset.mode === (present ? "present" : "study")));
    if (present === open) return;
    open = present;
    deck.hidden = !present;
    document.body.classList.toggle("mode-present", present);
    if (present) {
      themeBefore = root.dataset.theme ?? null;
      setProjector(readPref());
      index = m?.[1] ? Math.max(0, Math.min(SLIDES.length - 1, Number(m[1]) - 1)) : index;
      if (index > 0 && !started) started = Date.now();
      render();
      ($("#deckNext") as HTMLButtonElement).focus({ preventScroll: true });
    } else {
      api.scene3d.showcase(false);
      setZoom(false);
      setProjector(false);
      returnAll();
      stage.innerHTML = "";
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      if (location.hash === "#estudo") window.scrollTo({ top: 0 });
    }
  }
  window.addEventListener("hashchange", route);
  route();
}
