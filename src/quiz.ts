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
    a: "Na mangueira, turbulento e perto da transição. Re = ρVD/μ = 994 × 0,318 × 0,010 / (0,72×10⁻³) ≈ 4.394. Nos microcanais, é necessário calcular outro Reynolds com o diâmetro hidráulico de cada canal. Experimente a bomba a 70 % e consulte a memória de cálculo para o valor atualizado.",
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
    a: "Neste exemplo, o controlador envia um sinal PWM de 25 kHz. O duty cycle é a fração do período em nível alto. O modelo aproxima rotação relativa por PWM/100, mas a relação real e o número de pulsos do tacômetro dependem da ficha técnica do equipamento. A leitura de RPM verifica a rotação efetiva; o comando sozinho não a garante.",
    topic: "Integração com a Computação",
  },
  {
    q: "Se a bomba for de 100 % para 70 %, o que acontece com a vazão, a perda e a potência?",
    a: "Para 70 % da rotação, as leis de semelhança estimam Q × 0,7, pressão × 0,49 e potência hidráulica × 0,343 em condições semelhantes: cerca de 1,05 L/min e 0,018 W. Na bancada, o ponto exato é recalculado pela interseção das curvas e o fator de atrito muda com Reynolds; por isso o resultado pode diferir dessas proporções. Consulte os valores atuais e compare os ensaios na seção Controle.",
    topic: "Exemplo numérico",
  },
  {
    q: "Por que o RPM da bomba não é suficiente para detectar uma falha?",
    a: "Porque a bomba pode girar sem produzir circulação adequada. Ar e obstruções podem reduzir a vazão mesmo com RPM normal; isso não significa que toda obstrução zere o fluxo. O sensor de vazão complementa o tacômetro, e o ΔT deve ser interpretado junto à carga e ao estado térmico.",
    topic: "Falha e melhoria",
  },
];
