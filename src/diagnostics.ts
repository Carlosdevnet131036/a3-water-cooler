/** Regras didáticas, compartilhadas pelo alerta, fluxograma e registro. */
export interface DiagnosticInput {
  enabled: boolean;
  q: number;
  rpm: number;
  delta: number;
  expectedDelta: number;
  recovering: boolean;
  throttling: boolean;
}

export interface Diagnosis {
  state: "off" | "ok" | "rpm" | "flow" | "recovery" | "thermal" | "throttling";
  label: string;
  message: string;
  protect: boolean;
  warning: boolean;
}

export function diagnose(i: DiagnosticInput): Diagnosis {
  if (i.enabled && i.rpm < 1) return {
    state: "rpm", label: "Falha: bomba sem rotação", protect: true, warning: false,
    message: "Bomba sem rotação (S4 = 0 rpm). Comando PWM em 100 %, mas o rotor continua parado. Proteção simulada: carga reduzida para 35 %; aumentar o comando não repara a bomba.",
  };
  if (i.enabled && i.q < 0.5) return {
    state: "flow", label: "Falha: vazão abaixo de 0,5 L/min", protect: true, warning: false,
    message: "Vazão abaixo de 0,5 L/min. Verifique ar, obstrução e bomba; esta leitura isolada não identifica a causa. Proteção simulada: PWM em 100 % e carga reduzida para 35 %.",
  };
  if (i.throttling) return {
    state: "throttling", label: "Proteção térmica do chip ativa", protect: false, warning: false,
    message: "O chip atingiu o limite didático de 99 °C e a proteção térmica reduziu a carga. O modelo não simula o desligamento do computador.",
  };
  if (!i.enabled) return {
    state: "off", label: "Diagnóstico desligado", protect: false, warning: true,
    message: "Diagnóstico de vazão desligado. A proteção térmica do chip continua ativa na simulação.",
  };
  if (i.recovering) return {
    state: "recovery", label: "Recuperação: aguardando estabilização térmica", protect: false, warning: true,
    message: "Vazão e rotação recuperadas. As temperaturas ainda estão se estabilizando; um ΔT elevado neste intervalo não confirma entupimento.",
  };
  if (i.delta > Math.max(4, i.expectedDelta * 1.5 + 1)) return {
    state: "thermal", label: "Atenção: ΔT acima do esperado para a carga", protect: false, warning: true,
    message: "ΔT acima do esperado para a carga e a vazão atuais. Observe a evolução antes de atribuir a causa a uma obstrução; o sistema pode estar em transição térmica.",
  };
  return { state: "ok", label: "Normal: vazão, rotação e ΔT coerentes", message: "", protect: false, warning: false };
}
