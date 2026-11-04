import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Carrega os módulos puros sem gerar artefatos no checkout.
const modules = new Map();
async function load(name) {
  if (modules.has(name)) return modules.get(name);
  const source = await readFile(new URL(`../src/${name}.ts`, import.meta.url), "utf8");
  let js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
  for (const match of [...js.matchAll(/from "\.\/([^"/]+)"/g)]) {
    const url = await load(match[1]);
    js = js.replace(match[0], `from "${url}"`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
  modules.set(name, url);
  return url;
}
const { solve, FLUIDS, pumpPressure } = await import(await load("model"));
const { diagnose } = await import(await load("diagnostics"));
const { referenceInputs, createSimulation, advanceSimulation } = await import(await load("simulation"));
let passed = 0;
function check(name, fn) { fn(); passed++; console.log(`OK ${name}`); }
const near = (a, b, tolerance) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≉ ${b}`);

check("referência reproduz Q, Re, perdas e potência", () => {
  const h = solve(1, FLUIDS[0], "none");
  near(h.q, 1.5, 0.002); near(h.re, 4394, 5); near(h.dpTotal, 2086, 3); near(h.pHyd, 0.052, 0.001);
});
check("ponto de operação satisfaz balanço para fluidos, rotações e falhas", () => {
  for (const fluid of FLUIDS) for (const fault of ["none", "air", "clog", "stopped"]) for (const n of [0, 0.1, 0.4, 0.7, 1]) {
    const h = solve(n, fluid, fault);
    for (const v of Object.values(h).filter(v => typeof v === "number")) assert.ok(Number.isFinite(v));
    near(h.dpTotal, h.dpDist + h.dpLocal + h.dpComp, 1e-7);
    near(h.dpTotal, pumpPressure(h.q, n, fault), 1e-7);
    near(h.pHyd, h.dpTotal * h.qSI, 1e-10);
  }
});
check("vazão zero é sem escoamento", () => {
  for (const h of [solve(0, FLUIDS[0], "none"), solve(1, FLUIDS[0], "stopped")]) {
    assert.equal(h.regime, "sem escoamento"); assert.equal(h.q, 0); assert.equal(h.pHyd, 0);
  }
});
check("diagnóstico distingue recuperação, carga alta e desvio térmico", () => {
  const i = { enabled: true, q: 1.5, rpm: 4800, delta: 8, expectedDelta: 7, recovering: false, throttling: false };
  assert.equal(diagnose(i).state, "ok");
  assert.equal(diagnose({ ...i, expectedDelta: 2, recovering: true }).state, "recovery");
  assert.equal(diagnose({ ...i, expectedDelta: 2 }).state, "thermal");
  assert.equal(diagnose({ ...i, q: 0, rpm: 0 }).state, "rpm");
  assert.equal(diagnose({ ...i, q: 0.3 }).state, "flow");
});
check("proteção atua imediatamente inclusive com PWM solicitado zero", () => {
  const i = { ...referenceInputs(), pump: 0 };
  const s = createSimulation(i);
  assert.equal(s.pumpEff, 100); assert.equal(s.diagnosis.protect, true);
  for (let n = 0; n < 20; n++) advanceSimulation(i, s, 0.1);
  assert.ok(s.power < 0.36);
});
check("proteção térmica permanece disponível com diagnóstico ligado ou desligado", () => {
  for (const enabled of [true, false]) {
    const i = { ...referenceInputs(), fault: "stopped", diag: enabled };
    const s = createSimulation(i);
    s.tCpu = 105;
    advanceSimulation(i, s, 0.1);
    assert.equal(s.throttling, true);
    assert.ok(s.power < 1);
  }
});
check("retirada da falha admite recuperação sem diagnóstico contraditório", () => {
  const i = { ...referenceInputs(), fault: "stopped" };
  const s = createSimulation(i);
  for (let n = 0; n < 100; n++) advanceSimulation(i, s, 0.1);
  i.fault = "none"; s.alarm = ""; s.recoveryUntil = s.time + 40;
  advanceSimulation(i, s, 0);
  assert.ok(["recovery", "throttling"].includes(s.diagnosis.state)); assert.equal(s.diagnosis.protect, false);
  for (let n = 0; n < 600; n++) advanceSimulation(i, s, 0.1);
  assert.equal(s.diagnosis.state, "ok");
});
check("reiniciar elimina aquecimento e tempo do ensaio anterior", () => {
  const i = referenceInputs(), s = createSimulation(i);
  const initial = { ...s };
  i.fault = "stopped";
  for (let n = 0; n < 100; n++) advanceSimulation(i, s, 0.1);
  i.fault = "none";
  const reset = createSimulation(i);
  assert.equal(reset.time, 0); near(reset.tCpu, initial.tCpu, 1e-9); assert.equal(reset.alarm, "");
});
check("comparações partem das mesmas temperaturas e evoluem de modo determinístico", () => {
  const a = { ...referenceInputs(), pump: 100 }, b = { ...referenceInputs(), pump: 70 };
  const sa = createSimulation(a), sb = createSimulation(b), repeated = createSimulation(b);
  near(sa.tCpu, sb.tCpu, 1e-9);
  for (let n = 0; n < 600; n++) { advanceSimulation(a, sa, 0.1); advanceSimulation(b, sb, 0.1); advanceSimulation(b, repeated, 0.1); }
  assert.ok(sb.hyd.q < sa.hyd.q); near(sb.tCpu, repeated.tCpu, 1e-9);
  console.log(`  Bomba 70 %: Q=${sb.hyd.q.toFixed(4)} L/min; Re=${sb.hyd.re.toFixed(0)}; P=${sb.hyd.pHyd.toFixed(5)} W`);
});
console.log(`${passed} verificações passaram.`);
