const STORAGE_KEY = "peletizacao-simulacoes-v1";

const fields = [
  ["productivity", "Produtividade Ton/h", "number", 0.01],
  ["pdi", "PDI %", "number", 0.01],
  ["fines", "Finos %", "number", 0.01],
  ["amperage", "Amper", "number", 0.01],
  ["moisture", "Umidade %", "number", 0.01],
  ["soldTons", "Ton vendida base", "number", 0.01],
  ["density", "Densidade kg/m³", "number", 0.01],
  ["reportedCa", "CA informada", "number", 0.001],
];

const curve = [
  { pdi: 100, ca: 1.87, source: "100% peletes" },
  { pdi: 80, ca: 1.88, source: "80% peletes" },
  { pdi: 60, ca: 1.92, source: "60% peletes" },
  { pdi: 40, ca: 1.93, source: "40% peletes" },
  { pdi: 20, ca: 1.95, source: "20% peletes" },
  { pdi: 0, ca: 2.02, source: "Mash/farelada" },
];

const example = {
  id: crypto.randomUUID(),
  client: "Cliente exemplo",
  consultant: "Comercial",
  createdAt: new Date().toISOString(),
  control: {
    productivity: 30,
    pdi: 85,
    fines: 10,
    amperage: 400,
    moisture: 11,
    soldTons: 30000,
    density: 300,
    reportedCa: 1.77,
  },
  ha: {
    productivity: 33,
    pdi: 87,
    fines: 9,
    amperage: 390,
    moisture: 11.5,
    soldTons: 30000,
    density: 600,
    reportedCa: 1.75,
  },
};

let simulations = loadSimulations();
let selectedId = simulations[0]?.id;

const el = {
  clientName: document.querySelector("#clientName"),
  consultantName: document.querySelector("#consultantName"),
  saveButton: document.querySelector("#saveButton"),
  resetButton: document.querySelector("#resetButton"),
  newButton: document.querySelector("#newButton"),
  simulationList: document.querySelector("#simulationList"),
  summaryTitle: document.querySelector("#summaryTitle"),
  summaryText: document.querySelector("#summaryText"),
  kpiFeederPellets: document.querySelector("#kpiFeederPellets"),
  kpiMoisture: document.querySelector("#kpiMoisture"),
  kpiFines: document.querySelector("#kpiFines"),
  kpiFeedConversion: document.querySelector("#kpiFeedConversion"),
  kpiFeederPelletsHint: document.querySelector("#kpiFeederPelletsHint"),
  kpiMoistureHint: document.querySelector("#kpiMoistureHint"),
  comparisonRows: document.querySelector("#comparisonRows"),
  comparisonChart: document.querySelector("#comparisonChart"),
  curveTable: document.querySelector("#curveTable"),
};

function loadSimulations() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [{ ...example }];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : [{ ...example }];
  } catch {
    return [{ ...example }];
  }
}

function saveSimulations() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(simulations));
}

function selectedSimulation() {
  return simulations.find((item) => item.id === selectedId) || simulations[0];
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pct(value) {
  return `${(value * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function fixed(value, digits = 2) {
  return number(value).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function estimateCa(pdi) {
  const score = Math.max(0, Math.min(100, number(pdi)));
  for (let index = 0; index < curve.length - 1; index += 1) {
    const high = curve[index];
    const low = curve[index + 1];
    if (score <= high.pdi && score >= low.pdi) {
      const position = (score - low.pdi) / (high.pdi - low.pdi);
      return low.ca + position * (high.ca - low.ca);
    }
  }
  return curve.at(-1).ca;
}

function scenarioCalc(data) {
  const pelletsPct = 100 - number(data.fines);
  const pelletTons = number(data.productivity) * pelletsPct / 100;
  const feederTons = pelletTons * number(data.pdi) / 100;
  const ampsPerTon = pelletTons ? number(data.amperage) / pelletTons : 0;
  const adjustedSoldTons = data._baseMoisture
    ? number(data._baseSoldTons) * number(data.moisture) / number(data._baseMoisture)
    : number(data.soldTons);

  return {
    pelletsPct,
    pelletTons,
    feederTons,
    ampsPerTon,
    adjustedSoldTons,
    estimatedCa: estimateCa(data.pdi),
  };
}

function calculate(sim) {
  const control = scenarioCalc({
    ...sim.control,
    _baseMoisture: sim.control.moisture,
    _baseSoldTons: sim.control.soldTons,
  });
  const ha = scenarioCalc({
    ...sim.ha,
    _baseMoisture: sim.control.moisture,
    _baseSoldTons: sim.control.soldTons,
  });

  return {
    control,
    ha,
    feederPelletsGain: control.feederTons ? ha.feederTons / control.feederTons - 1 : 0,
    productionGain: control.pelletTons ? ha.pelletTons / control.pelletTons - 1 : 0,
    finesDelta: number(sim.ha.fines) - number(sim.control.fines),
    pdiDelta: number(sim.ha.pdi) - number(sim.control.pdi),
    ampsPerTonDelta: ha.ampsPerTon - control.ampsPerTon,
    moistureTonsGain: ha.adjustedSoldTons - control.adjustedSoldTons,
    densityGain: number(sim.ha.density) - number(sim.control.density),
    caDelta: ha.estimatedCa - control.estimatedCa,
  };
}

function buildFields() {
  for (const scenario of ["control", "ha"]) {
    const container = document.querySelector(`[data-scenario="${scenario}"]`);
    container.innerHTML = "";
    fields.forEach(([key, label, type, step]) => {
      const field = document.createElement("label");
      field.textContent = label;
      const input = document.createElement("input");
      input.type = type;
      input.step = step;
      input.dataset.scenario = scenario;
      input.dataset.field = key;
      field.append(input);
      container.append(field);
    });
  }
}

function fillForm(sim) {
  el.clientName.value = sim.client || "";
  el.consultantName.value = sim.consultant || "";
  document.querySelectorAll("[data-scenario][data-field]").forEach((input) => {
    input.value = sim[input.dataset.scenario][input.dataset.field] ?? "";
  });
}

function readForm() {
  const sim = selectedSimulation();
  sim.client = el.clientName.value.trim() || "Cliente sem nome";
  sim.consultant = el.consultantName.value.trim();
  document.querySelectorAll("[data-scenario][data-field]").forEach((input) => {
    sim[input.dataset.scenario][input.dataset.field] = number(input.value);
  });
  sim.updatedAt = new Date().toISOString();
}

function renderSimulationList() {
  el.simulationList.innerHTML = "";
  simulations.forEach((sim) => {
    const item = document.createElement("button");
    item.className = `simulation-item${sim.id === selectedId ? " is-active" : ""}`;
    item.innerHTML = `<strong>${sim.client || "Cliente sem nome"}</strong><span>${sim.consultant || "Sem consultor"}</span>`;
    item.addEventListener("click", () => {
      readForm();
      selectedId = sim.id;
      fillForm(sim);
      render();
    });
    el.simulationList.append(item);
  });
}

function renderCurve() {
  el.curveTable.innerHTML = curve
    .map((item) => `<tr><td>${fixed(item.pdi, 0)}%</td><td>${fixed(item.ca, 2)}</td><td>${item.source}</td></tr>`)
    .join("");
}

function render() {
  readForm();
  saveSimulations();
  const sim = selectedSimulation();
  const calc = calculate(sim);
  renderSimulationList();
  renderSummary(sim, calc);
  renderRows(calc);
  renderCurve();
  drawChart(calc);
}

function createNewSimulation() {
  readForm();
  const fresh = structuredClone(example);
  fresh.id = crypto.randomUUID();
  fresh.client = `Nova simulação ${simulations.length + 1}`;
  fresh.createdAt = new Date().toISOString();
  simulations.unshift(fresh);
  selectedId = fresh.id;
  fillForm(fresh);
  render();
}

function renderSummary(sim, calc) {
  el.summaryTitle.textContent = `${sim.client || "Cliente"} - Controle vs H+A`;
  el.summaryText.textContent = `Ganho de ${pct(calc.feederPelletsGain)} a mais em peletes no comedouro, ${fixed(calc.moistureTonsGain)} Ton a mais por umidade, redução de ${fixed(-calc.finesDelta)}% em finos, ${fixed(-calc.ampsPerTonDelta)} kWh/Ton a menos e CA estimado ${fixed(-calc.caDelta, 3)} melhor.`;
  el.kpiFeederPellets.textContent = pct(calc.feederPelletsGain);
  el.kpiFeederPelletsHint.textContent = "a mais de peletes no comedouro";
  el.kpiMoisture.textContent = `${fixed(calc.moistureTonsGain)} Ton`;
  el.kpiMoistureHint.textContent = "Ton a mais por umidade";
  el.kpiFines.textContent = `${fixed(-calc.finesDelta)}%`;
  el.kpiFeedConversion.textContent = `${fixed(calc.control.estimatedCa, 3)} -> ${fixed(calc.ha.estimatedCa, 3)}`;
}

function renderRows(calc) {
  const rows = [
    ["Peletes no comedouro", calc.control.feederTons, calc.ha.feederTons, calc.feederPelletsGain, "pct", "higher"],
    ["Produção de peletes", calc.control.pelletTons, calc.ha.pelletTons, calc.productionGain, "pct", "higher"],
    ["Amper por Ton", calc.control.ampsPerTon, calc.ha.ampsPerTon, calc.ampsPerTonDelta, "num", "lower"],
    ["Ton vendidas a mais", calc.control.adjustedSoldTons, calc.ha.adjustedSoldTons, calc.moistureTonsGain, "num", "higher"],
    ["Densidade", selectedSimulation().control.density, selectedSimulation().ha.density, calc.densityGain, "num", "higher"],
    ["CA estimado", calc.control.estimatedCa, calc.ha.estimatedCa, calc.caDelta, "num3", "lower"],
  ];

  el.comparisonRows.innerHTML = "";
  rows.forEach(([label, control, ha, delta, format, direction]) => {
    const row = document.createElement("div");
    const value = format === "pct" ? pct(delta) : format === "num3" ? fixed(delta, 3) : fixed(delta);
    const isGood = direction === "lower" ? delta <= 0 : delta >= 0;
    const className = isGood ? "gain" : "loss";
    row.className = "comparison-row";
    row.innerHTML = `<strong>${label}</strong><span>Controle: ${fixed(control, format === "num3" ? 3 : 2)}</span><span>H+A: ${fixed(ha, format === "num3" ? 3 : 2)}</span><span class="${className}">${value}</span>`;
    el.comparisonRows.append(row);
  });
}

function drawChart(calc) {
  const canvas = el.comparisonChart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const metrics = [
    ["Peletes comedouro", calc.control.feederTons, calc.ha.feederTons],
    ["Peletes/Ton", calc.control.pelletTons, calc.ha.pelletTons],
    ["Amper/Ton", calc.control.ampsPerTon, calc.ha.ampsPerTon],
    ["CA estimado", calc.control.estimatedCa, calc.ha.estimatedCa],
  ];

  const max = Math.max(...metrics.flatMap((metric) => [metric[1], metric[2]])) * 1.18;
  const chartTop = 44;
  const chartBottom = height - 62;
  const chartHeight = chartBottom - chartTop;
  const groupWidth = width / metrics.length;

  ctx.fillStyle = "#050b22";
  ctx.font = "700 18px Aptos, Arial";
  ctx.fillText("Controle vs H+A", 24, 28);

  metrics.forEach((metric, index) => {
    const groupCenter = index * groupWidth + groupWidth / 2;
    const barWidth = Math.min(42, groupWidth * 0.22);
    const pairWidth = barWidth * 2 + 8;
    const x = groupCenter - pairWidth / 2;
    const controlHeight = metric[1] / max * chartHeight;
    const haHeight = metric[2] / max * chartHeight;
    const base = chartBottom;
    const decimals = metric[0] === "CA estimado" ? 3 : 1;

    ctx.fillStyle = "#23863b";
    ctx.fillRect(x, base - controlHeight, barWidth, controlHeight);
    ctx.fillStyle = "#64d99b";
    ctx.fillRect(x + barWidth + 8, base - haHeight, barWidth, haHeight);

    ctx.fillStyle = "#5d6b66";
    ctx.font = "12px Aptos, Arial";
    ctx.textAlign = "center";
    ctx.fillText(fixed(metric[1], decimals), x + barWidth / 2, base - controlHeight - 8);
    ctx.fillText(fixed(metric[2], decimals), x + barWidth + 8 + barWidth / 2, base - haHeight - 8);
    ctx.fillText(metric[0], groupCenter, height - 28);
  });

  ctx.textAlign = "left";
  ctx.fillStyle = "#23863b";
  ctx.fillRect(width - 154, 18, 12, 12);
  ctx.fillStyle = "#050b22";
  ctx.fillText("Controle", width - 136, 29);
  ctx.fillStyle = "#64d99b";
  ctx.fillRect(width - 78, 18, 12, 12);
  ctx.fillStyle = "#050b22";
  ctx.fillText("H+A", width - 60, 29);
}

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("is-active"));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("is-active"));
    button.classList.add("is-active");
    document.querySelector(`#tab-${button.dataset.tab}`).classList.add("is-active");
    drawChart(calculate(selectedSimulation()));
  });
});

el.saveButton.addEventListener("click", render);
el.newButton.addEventListener("click", createNewSimulation);
el.resetButton.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  simulations = [{ ...example, id: crypto.randomUUID() }];
  selectedId = simulations[0].id;
  fillForm(simulations[0]);
  render();
});

document.addEventListener("input", (event) => {
  if (event.target.matches("input")) render();
});

buildFields();
fillForm(selectedSimulation());
render();
