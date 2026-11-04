// Converte o build do Vite no formato de página do Artifact (sem doctype/html/head/body).
import { readFileSync, writeFileSync } from "node:fs";

let html = readFileSync("dist/index.html", "utf8");
html = html
  .replace(/<!doctype html>/i, "")
  .replace(/<\/?html[^>]*>/gi, "")
  .replace(/<\/?head[^>]*>/gi, "")
  .replace(/<\/?body[^>]*>/gi, "")
  .replace(/<meta charset="utf-8">\s*/i, "")
  .replace(/<meta name="viewport"[^>]*>\s*/i, "");
// o <title> precisa estar no início do arquivo
const title = html.match(/<title>[\s\S]*?<\/title>/i)[0];
html = title + "\n" + html.replace(title, "").trim() + "\n";
writeFileSync("dist/water-cooler.html", html);
console.log("ok", html.length);
