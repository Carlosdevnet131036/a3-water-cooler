# Water cooler para processadores e placas de vídeo

Trabalho A3 de **Sistemas Fluidomecânicos** (Universidade Potiguar, Prof. Dr. Ronyclei Raimundo da Silva), **Grupo 3**, Tema 01.

O site é um simulador interativo do circuito de refrigeração líquida, feito em TypeScript:

- **Bancada:** circuito animado com bomba, blocos da CPU e da GPU, radiador e sensores. Dá para controlar o PWM da bomba e das ventoinhas, a carga e o fluido.
- **Escoamento:** número de Reynolds com visualização laminar/turbulento, continuidade e perdas de carga, com os valores da bancada.
- **Curvas:** curva da bomba × curva do sistema, ponto de operação e leis de semelhança.
- **Controle:** ciclo de medição, processamento e ação com PWM de 25 kHz.
- **Falhas:** bomba parada, ar no circuito e entupimento, com e sem diagnóstico de vazão.
- **Quiz:** perguntas para treinar a apresentação.

A parte hidráulica reproduz o exemplo numérico do relatório (1,5 L/min, Re ≈ 4.394, Δp ≈ 2.086 Pa, P ≈ 0,052 W). O modelo térmico é simplificado e serve só para ilustrar.

## Rodar localmente

```bash
npm install
npm run dev
```

`npm run build` gera `dist/index.html`, um arquivo único com CSS e JS embutidos. O GitHub Pages é publicado automaticamente pelo workflow em `.github/workflows/pages.yml` a cada push na `main`.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `src/model.ts` | Modelo físico: perdas de carga, curva da bomba, ponto de operação, modelo térmico |
| `src/main.ts` | Simulação, animação, gráfico, controle e quiz |
| `src/quiz.ts` | Perguntas e respostas |
| `src/style.css` | Estilos (tema claro e escuro) |
| `docs/` | Relatório (DOCX/PDF) e slides (PPTX/PDF) |
| `docs/fonte/` | Scripts que geram o relatório, os slides e as figuras |

## Equipe

- Alexandre Pinho do Rosario Filho
- Carlos Henrique Pereira da Silva
- Daniela Brito da Silva
- Raffael Morais Dutra
- Victor Hugo Paiva dos Santos
