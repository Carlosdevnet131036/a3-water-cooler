# Water cooler para processadores e placas de vídeo

Trabalho A3 de **Sistemas Fluidomecânicos** (Universidade Potiguar, Prof. Dr. Ronyclei Raimundo da Silva), **Grupo 3**, Tema 01.

O site é um simulador interativo do circuito de refrigeração líquida, feito em TypeScript:

- **Bancada:** circuito animado com bomba, blocos da CPU e da GPU, radiador e sensores. Dá para controlar o PWM da bomba e das ventoinhas, a carga e o fluido.
- **Escoamento:** número de Reynolds com visualização laminar/turbulento, continuidade e perdas de carga, com os valores da bancada.
- **Curvas:** curva da bomba × curva do sistema, ponto de operação e leis de semelhança.
- **Controle:** ciclo de medição, processamento e ação com PWM de 25 kHz.
- **Falhas:** bomba parada, ar no circuito e entupimento, com e sem diagnóstico de vazão.
- **Quiz:** perguntas para treinar a apresentação.
- **Memória de cálculo:** cada indicador abre dados, conversões para SI, fórmulas, resultados e interpretação, atualizados com a bancada.
- **Experimentos:** pausa, reinício das condições térmicas, limpeza do histórico, gráficos de temperatura/vazão com eventos e exportação CSV.
- **Comparações:** ensaios de 60 s com condições iniciais iguais (bomba a 100 % × 70 %; diagnóstico ligado × desligado), usando o mesmo integrador da bancada.
- **Apresentação guiada:** quatro etapas com circuito ampliado, leituras e perguntas para conduzir a explicação. Escape fecha a apresentação.

O diagnóstico é compartilhado entre alerta e fluxograma, com estados distintos para falha, recuperação térmica, atenção e operação normal. Vazão zero é identificada como **sem escoamento**. O painel de hipóteses descreve a origem dos dados e os limites do modelo; o comando PWM não é confundido com a rotação efetiva.

A parte hidráulica reproduz o exemplo numérico do relatório (1,5 L/min, Re ≈ 4.394, Δp ≈ 2.086 Pa, P ≈ 0,052 W). O modelo térmico é simplificado e serve só para ilustrar.

## Rodar localmente

```bash
npm install
npm run dev
```

`npm run build` gera `dist/index.html`, um arquivo único com CSS e JS embutidos. O GitHub Pages é publicado automaticamente pelo workflow em `.github/workflows/pages.yml` a cada push na `main`.

O arquivo gerado pode ser aberto diretamente no navegador, sem servidor. A simulação e os controles funcionam sem internet; as fontes externas são opcionais e têm alternativas locais. Não depende de serviços de telemetria ou sensores reais.

`npm test` verifica o ponto de operação, balanço hidráulico, ausência de circulação, estados de diagnóstico, proteções, recuperação e reinício. `npm run build` também valida os tipos TypeScript.

Os cenários prontos reiniciam o relógio, o histórico e as temperaturas em uma referência comum: circuito saudável com a carga selecionada e bomba/ventoinhas a 100 %. Em seguida, aplicam a configuração do cenário. Alterar um controle manualmente preserva a evolução térmica; o botão de reinício é explícito. Limpar o histórico preserva o estado e o relógio.

O CSV usa separador `;`, codificação UTF-8 e ponto decimal. Inclui tempo, vazão, temperaturas, comandos PWM, RPM, fator de carga, falha, diagnóstico e eventos. Mantém as últimas 1.800 amostras, com gráficos dos últimos 120 s.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `src/model.ts` | Modelo físico: perdas de carga, curva da bomba, ponto de operação, modelo térmico |
| `src/main.ts` | Simulação, animação, gráfico, controle e quiz |
| `src/simulation.ts` | Integrador compartilhado e condições iniciais dos ensaios |
| `src/diagnostics.ts` | Regras únicas de diagnóstico e mensagens |
| `src/calculations.ts` | Memória de cálculo dos seis indicadores |
| `src/history.ts` | Gráficos, eventos e comparação de cenários |
| `src/quiz.ts` | Perguntas e respostas |
| `src/style.css` | Estilos (tema claro e escuro) |
| `docs/` | Relatório (DOCX/PDF) e slides (PPTX/PDF) |
| `docs/fonte/` | Scripts que geram o relatório, os slides e as figuras |

Os documentos em `docs/` são os materiais originais do grupo e não foram regenerados nesta revisão do simulador. As explicações de aproximações e resultados atuais ficam na interface e na memória de cálculo.

## Equipe

- Alexandre Pinho do Rosario Filho
- Carlos Henrique Pereira da Silva
- Daniela Brito da Silva
- Raffael Morais Dutra
- Victor Hugo Paiva dos Santos
