import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

plt.rcParams["font.family"] = "Arial"
OUT = r"C:\Users\carlo\a3wc"

HOT = "#c0392b"
COLD = "#2471a3"
SENS = "#1e8449"


def box(ax, x, y, w, h, text, fc="#f4f6f7", ec="#2c3e50", fs=10):
    ax.add_patch(FancyBboxPatch((x - w / 2, y - h / 2), w, h,
                                boxstyle="round,pad=0.02,rounding_size=0.08",
                                fc=fc, ec=ec, lw=1.5))
    ax.text(x, y, text, ha="center", va="center", fontsize=fs, wrap=True)


def arrow(ax, p, q, color, label=None, lpos=None):
    ax.add_patch(FancyArrowPatch(p, q, arrowstyle="-|>", mutation_scale=16,
                                 lw=2.4, color=color))
    if label:
        ax.text(*lpos, label, fontsize=8.5, color=color, ha="center")


# ---------- Figura 1: esquema do circuito ----------
fig, ax = plt.subplots(figsize=(8, 4.6))
ax.set_xlim(0, 10); ax.set_ylim(0, 6); ax.axis("off")

nodes = {
    "res": (1.4, 1.4, "Reservatório"),
    "pump": (1.4, 4.4, "Bomba\n(12 V, PWM)"),
    "cpu": (4.4, 4.4, "Bloco da CPU\n(microcanais)"),
    "gpu": (7.6, 4.4, "Bloco da GPU"),
    "rad": (7.6, 1.4, "Radiador 360 mm\n+ 3 ventoinhas PWM"),
}
for k, (x, y, t) in nodes.items():
    box(ax, x, y, 2.2, 1.0, t)

arrow(ax, (1.4, 1.95), (1.4, 3.85), COLD, "água fria", (0.55, 2.9))
arrow(ax, (2.55, 4.4), (3.25, 4.4), COLD)
arrow(ax, (5.55, 4.4), (6.45, 4.4), HOT, "aquecida", (6.0, 4.6))
arrow(ax, (7.6, 3.85), (7.6, 1.95), HOT, "água quente", (8.65, 2.9))
arrow(ax, (6.45, 1.4), (2.55, 1.4), COLD, "água resfriada", (4.5, 1.6))

# calor e ar
ax.annotate("calor da CPU", (4.4, 3.85), (4.4, 3.1), ha="center", fontsize=8.5,
            color=HOT, arrowprops=dict(arrowstyle="-|>", color=HOT, lw=1.4))
ax.annotate("ar ambiente", (8.75, 1.4), (9.7, 0.5), fontsize=8.5, ha="center",
            color="#555", arrowprops=dict(arrowstyle="-|>", color="#555", lw=1.4))

# sensores
for (x, y, t) in [(2.9, 4.7, "S1 fluxo"), (6.0, 4.15, "S2 temp. água quente"),
                  (4.5, 1.15, "S3 temp. água fria"), (1.4, 5.05, "S4 RPM bomba")]:
    ax.plot(x, y, "o", color=SENS, ms=7)
    if t.startswith("S2"):
        ax.text(x, 3.45, t, color=SENS, fontsize=8.5, ha="center", va="bottom")
    elif t.startswith("S3"):
        ax.text(x, 0.65, t, color=SENS, fontsize=8.5, ha="center", va="bottom")
    else:
        ax.text(x, y + 0.12, t, color=SENS, fontsize=8.5, ha="center", va="bottom")

ax.text(5, 5.8, "Sentido do escoamento: bomba → CPU → GPU → radiador → reservatório",
        ha="center", fontsize=9, style="italic")
fig.tight_layout()
fig.savefig(OUT + r"\fig1_circuito.png", dpi=200)
plt.close(fig)

# ---------- Figura 2: fluxograma de controle ----------
fig, ax = plt.subplots(figsize=(6.4, 7.4))
ax.set_xlim(0, 10); ax.set_ylim(0, 12); ax.axis("off")
steps = [
    (11.1, "Início do ciclo (a cada 1 s)", "#d6eaf8"),
    (9.7, "Leitura dos sensores:\nT CPU/GPU, T água (S2, S3),\nfluxo (S1) e RPM da bomba (S4)", "#f4f6f7"),
    (8.1, "Filtragem (média móvel)\ne cálculo de ΔT = S2 − S3", "#f4f6f7"),
    (6.6, "Fluxo < mínimo ou\nRPM da bomba = 0?", "#fdebd0"),
    (4.9, "Curva de controle:\nT água → duty PWM da bomba\nT água → duty PWM das ventoinhas", "#f4f6f7"),
    (3.4, "Envio do sinal PWM (25 kHz)\npara bomba e ventoinhas", "#f4f6f7"),
    (2.0, "Registro em log / painel\n(software de monitoramento)", "#d5f5e3"),
]
for y, t, c in steps:
    box(ax, 4.0, y, 5.6, 1.05 if "\n" in t else 0.7, t, fc=c, fs=9)
for y1, y2 in [(10.75, 10.3), (9.1, 8.6), (7.6, 7.1), (6.1, 5.5), (4.3, 3.8), (3.0, 2.45)]:
    arrow(ax, (4.0, y1), (4.0, y2), "#2c3e50")
ax.text(4.25, 5.75, "não", fontsize=9)
# ramo de alarme
box(ax, 8.6, 6.6, 2.4, 1.3, "ALERTA!\nduty 100 %,\naviso ao usuário\ne redução de clock", fc="#fadbd8", fs=8.5)
arrow(ax, (6.8, 6.6), (7.4, 6.6), HOT)
ax.text(7.1, 6.75, "sim", fontsize=9, color=HOT, ha="center")
# retorno
ax.plot([1.2, 0.5, 0.5], [2.0, 2.0, 11.1], color="#7f8c8d", lw=1.4)
ax.annotate("", (1.2, 11.1), (0.5, 11.1),
            arrowprops=dict(arrowstyle="-|>", color="#7f8c8d", lw=1.4))
ax.text(0.25, 6.5, "repete", rotation=90, fontsize=9, color="#7f8c8d", va="center")
fig.tight_layout()
fig.savefig(OUT + r"\fig2_fluxograma.png", dpi=200)
plt.close(fig)

# ---------- Figura 3: curva do sistema ----------
import numpy as np
q = np.linspace(0, 2.0, 100)
k = 2086 / 1.5 ** 2
fig, ax = plt.subplots(figsize=(6.4, 3.6))
ax.plot(q, k * q ** 2, color=COLD, lw=2, label="Curva do sistema (Δp ≈ k·Q²)")
for qq, lab in [(1.5, "PWM 100 %\n1,50 L/min; 2086 Pa"), (1.05, "PWM 70 %\n1,05 L/min; 1022 Pa")]:
    ax.plot(qq, k * qq ** 2, "o", color=HOT, ms=7)
    ax.annotate(lab, (qq, k * qq ** 2), (qq - 0.75, k * qq ** 2 + 300), fontsize=8.5,
                arrowprops=dict(arrowstyle="-", color="#555"))
ax.set_xlabel("Vazão Q (L/min)")
ax.set_ylabel("Perda de pressão Δp (Pa)")
ax.grid(alpha=0.3)
ax.xaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v:.2f}".replace(".", ",")))
ax.set_xlim(0, 2.0); ax.set_ylim(0, 3800)
ax.legend(loc="upper left", fontsize=8.5, frameon=False)
fig.tight_layout()
fig.savefig(OUT + r"\fig3_curva.png", dpi=200)
plt.close(fig)
print("ok")
