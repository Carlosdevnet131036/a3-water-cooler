export interface QA {
  q: string;
  a: string;
  topic: string;
}

export const QUIZ: QA[] = [
  {
    q: "Por que usar água e não ar para resfriar o processador?",
    a: "Porque a água transporta muito mais calor por volume. O produto ρ·cp da água é cerca de 4,16 MJ/(m³·K), contra 1,2 kJ/(m³·K) do ar: uma razão de aproximadamente 3.500 vezes. Com uma vazão pequena, a água já leva o calor embora com pouco aumento de temperatura.",
    topic: "Problema e sistema",
  },
  {
    q: "Por que a vazão é a mesma em todos os pontos do circuito?",
    a: "Pela equação da continuidade. Em regime permanente, com fluido incompressível e sem vazamento, a vazão mássica que entra em qualquer trecho é a mesma que sai. O que muda é a velocidade: nos microcanais a área é menor e a água acelera.",
    topic: "Vazão e continuidade",
  },
  {
    q: "O escoamento no exemplo é laminar ou turbulento? Como vocês sabem?",
    a: "Turbulento, mas perto da transição. Re = ρVD/μ = 994 × 0,318 × 0,010 / 0,72×10⁻³ ≈ 4.394, acima de 4.000. Com a bomba a 70 % o Re cai para cerca de 3.076, que já é transição.",
    topic: "Reynolds",
  },
  {
    q: "Onde está a maior parte da perda de carga?",
    a: "Nos componentes. Dos 2.086 Pa totais, 1.600 Pa (cerca de 77 %) estão no bloco da CPU e no radiador. As mangueiras somam 235 Pa de perda distribuída e as conexões 252 Pa de perda localizada.",
    topic: "Perdas de carga",
  },
  {
    q: "O que muda se trocarmos a água por água com glicol?",
    a: "A viscosidade mais que dobra. O Reynolds cai, o fator de atrito e as perdas sobem, e a vazão fornecida pela mesma bomba diminui. Como o cp também é menor, a água esquenta mais ao passar pelos blocos. Teste na bancada.",
    topic: "Viscosidade",
  },
  {
    q: "Como o PWM controla a velocidade da bomba?",
    a: "O controlador liga e desliga o sinal 25 mil vezes por segundo. O duty cycle, a fração do tempo em nível alto, define a rotação: 70 % de duty dá cerca de 70 % da rotação máxima. A rotação é confirmada pelo tacômetro, que gera 2 pulsos por volta.",
    topic: "Integração com a Computação",
  },
  {
    q: "Se a bomba for de 100 % para 70 %, o que acontece com a vazão, a perda e a potência?",
    a: "Pelas leis de semelhança: a vazão cai na mesma proporção (×0,7 → 1,05 L/min), a pressão com o quadrado (×0,49 → ≈1.022 Pa) e a potência com o cubo (×0,343 → 0,018 W). O ΔT da água sobe só de 2,4 para 3,4 K.",
    topic: "Exemplo numérico",
  },
  {
    q: "Por que o RPM da bomba não é suficiente para detectar uma falha?",
    a: "Porque a bomba pode girar normalmente sem mover água: com ar no rotor ou com os microcanais entupidos, o tacômetro mostra rotação normal e a vazão é quase nula. Por isso o grupo propõe um sensor de vazão e o acompanhamento do ΔT da água.",
    topic: "Falha e melhoria",
  },
];
