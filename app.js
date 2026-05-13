const STORAGE_KEY = "peletizacao-simulacoes-v3";

const fields = [
  ["productivity", "Produtividade Ton/h", "number", 0.01],
  ["pdi", "PDI %", "number", 0.01],
  ["fines", "Finos %", "number", 0.01],
  ["amperage", "Corrente (A)", "number", 0.01],
  ["moisture", "Umidade %", "number", 0.01],
  ["density", "Densidade kg/m³", "number", 0.01],
  ["reportedCa", "CA informada", "number", 0.001],
];

const energyFields = [
  ["voltage", "Tensão de trabalho (V)", "number", 1],
  ["kwhCost", "Custo kWh (R$)", "number", 0.01],
  ["hoursPerDay", "Jornada de trabalho (h/dia)", "number", 0.5],
  ["daysPerMonth", "Jornada de trabalho (dias/mês)", "number", 1],
];

const curve = [
  { pdi: 100, ca: 1.87, source: "100% peletes" },
  { pdi: 80, ca: 1.88, source: "80% peletes" },
  { pdi: 60, ca: 1.92, source: "60% peletes" },
  { pdi: 40, ca: 1.93, source: "40% peletes" },
  { pdi: 20, ca: 1.95, source: "20% peletes" },
  { pdi: 0, ca: 2.02, source: "Mash/farelada" },
];

const defaultEnergy = {
  voltage: 380,
  kwhCost: 0.7576,
  hoursPerDay: 24,
  daysPerMonth: 30,
};

const example = {
  id: crypto.randomUUID(),
  client: "Cliente exemplo",
  consultant: "Comercial",
  createdAt: new Date().toISOString(),
  energy: { ...defaultEnergy },
  control: {
    productivity: 30,
    pdi: 85,
    fines: 10,
    amperage: 400,
    moisture: 11,
    density: 300,
    reportedCa: 1.77,
  },
  ha: {
    productivity: 33,
    pdi: 87,
    fines: 9,
    amperage: 390,
    moisture: 11.5,
    density: 600,
    reportedCa: 1.75,
  },
};

let simulations = loadSimulations();
let selectedId = simulations[0]?.id;

const el = {
  clientName: document.querySelector("#clientName"),
  consultantName: document.querySelector("#consultantName"),
  resetButton: document.querySelector("#resetButton"),
  newButton: document.querySelector("#newButton"),
  simulationList: document.querySelector("#simulationList"),
  summaryTitle: document.querySelector("#summaryTitle"),
  summaryText: document.querySelector("#summaryText"),
  kpiFeederPellets: document.querySelector("#kpiFeederPellets"),
  kpiMoisture: document.querySelector("#kpiMoisture"),
  kpiFines: document.querySelector("#kpiFines"),
  kpiEnergySavings: document.querySelector("#kpiEnergySavings"),
  kpiFeederPelletsHint: document.querySelector("#kpiFeederPelletsHint"),
  kpiMoistureHint: document.querySelector("#kpiMoistureHint"),
  comparisonRows: document.querySelector("#comparisonRows"),
  comparisonChart: document.querySelector("#comparisonChart"),
  energyChart: document.querySelector("#energyChart"),
  productionChart: document.querySelector("#productionChart"),
  energyFields: document.querySelector("#energyFields"),
  curveTable: document.querySelector("#curveTable"),
  chartTooltip: document.querySelector("#chartTooltip"),
};

function normalizeSimulation(sim) {
  return {
    ...example,
    ...sim,
    energy: { ...defaultEnergy, ...(sim.energy || {}) },
    control: { ...example.control, ...(sim.control || {}) },
    ha: { ...example.ha, ...(sim.ha || {}) },
  };
}

function loadSimulations() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [normalizeSimulation(example)];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed.map(normalizeSimulation) : [normalizeSimulation(example)];
  } catch {
    return [normalizeSimulation(example)];
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

function brl(value) {
  return number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function brlWhole(value) {
  return number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
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

function scenarioCalc(data, energy) {
  const pelletsPct = 100 - number(data.fines);
  const pelletTons = number(data.productivity) * pelletsPct / 100;
  const feederTons = pelletTons * number(data.pdi) / 100;
  const ampsPerTon = pelletTons ? number(data.amperage) / pelletTons : 0;
  const annualProduction = number(data.productivity) * number(energy.hoursPerDay) * number(energy.daysPerMonth) * 12;
  const consumedKw = Math.sqrt(3) * number(energy.voltage) * number(data.amperage) / 1000;
  const dailyEnergyCost = consumedKw * number(energy.kwhCost) * number(energy.hoursPerDay);
  const monthlyEnergyCost = dailyEnergyCost * number(energy.daysPerMonth);
  const annualEnergyCost = monthlyEnergyCost * 12;

  return {
    pelletsPct,
    pelletTons,
    feederTons,
    ampsPerTon,
    annualProduction,
    estimatedCa: estimateCa(data.pdi),
    consumedKw,
    dailyEnergyCost,
    monthlyEnergyCost,
    annualEnergyCost,
  };
}

function calculate(sim) {
  const energy = { ...defaultEnergy, ...(sim.energy || {}) };
  const control = scenarioCalc({
    ...sim.control,
  }, energy);
  const ha = scenarioCalc({
    ...sim.ha,
  }, energy);

  return {
    control,
    ha,
    energySavings: control.annualEnergyCost - ha.annualEnergyCost,
    feederPelletsGain: control.feederTons ? ha.feederTons / control.feederTons - 1 : 0,
    productionGain: control.pelletTons ? ha.pelletTons / control.pelletTons - 1 : 0,
    finesDelta: number(sim.ha.fines) - number(sim.control.fines),
    pdiDelta: number(sim.ha.pdi) - number(sim.control.pdi),
    ampsPerTonDelta: ha.ampsPerTon - control.ampsPerTon,
    annualProductionGain: ha.annualProduction - control.annualProduction,
    densityGain: number(sim.ha.density) - number(sim.control.density),
    caDelta: ha.estimatedCa - control.estimatedCa,
  };
}

function buildFields() {
  el.energyFields.innerHTML = "";
  energyFields.forEach(([key, label, type, step], index) => {
    const field = document.createElement("label");
    field.className = index < 2 ? "factory-line-one" : "factory-line-two";
    field.textContent = label;
    const input = document.createElement("input");
    input.type = type;
    input.step = step;
    input.dataset.energyField = key;
    field.append(input);
    el.energyFields.append(field);
  });

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
  const normalized = normalizeSimulation(sim);
  el.clientName.value = normalized.client || "";
  el.consultantName.value = normalized.consultant || "";
  document.querySelectorAll("[data-energy-field]").forEach((input) => {
    input.value = normalized.energy[input.dataset.energyField] ?? "";
  });
  document.querySelectorAll("[data-scenario][data-field]").forEach((input) => {
    input.value = normalized[input.dataset.scenario][input.dataset.field] ?? "";
  });
}

function readForm() {
  const sim = selectedSimulation();
  sim.energy = sim.energy || { ...defaultEnergy };
  sim.client = el.clientName.value.trim() || "Cliente sem nome";
  sim.consultant = el.consultantName.value.trim();
  document.querySelectorAll("[data-energy-field]").forEach((input) => {
    sim.energy[input.dataset.energyField] = number(input.value);
  });
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
    item.innerHTML = `<span class="simulation-text"><strong>${sim.client || "Cliente sem nome"}</strong><span>${sim.consultant || "Sem consultor"}</span></span><span class="delete-simulation" title="Excluir simulação" aria-label="Excluir simulação"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9h6v-9h2v11H7V9Z"></path></svg></span>`;
    item.addEventListener("click", () => {
      readForm();
      selectedId = sim.id;
      fillForm(sim);
      render();
    });
    item.querySelector(".delete-simulation").addEventListener("click", (event) => {
      event.stopPropagation();
      deleteSimulation(sim.id);
    });
    el.simulationList.append(item);
  });
}

function deleteSimulation(id) {
  if (simulations.length === 1) {
    alert("Você precisa manter pelo menos uma simulação.");
    return;
  }
  const sim = simulations.find((item) => item.id === id);
  const ok = confirm(`Você realmente tem certeza que deseja excluir "${sim?.client || "esta simulação"}"?`);
  if (!ok) return;
  simulations = simulations.filter((item) => item.id !== id);
  selectedId = simulations[0].id;
  fillForm(selectedSimulation());
  render();
}

function renderSummary(sim, calc) {
  el.summaryTitle.textContent = `${sim.client || "Cliente"} - Controle vs H+A`;
  el.summaryText.textContent = `Ganho de ${pct(calc.feederPelletsGain)} a mais em peletes no comedouro, ${fixed(calc.annualProductionGain, 0)} Ton a mais por ano, redução de ${fixed(-calc.finesDelta)}% em finos, ${fixed(-calc.ampsPerTonDelta)} kWh/Ton a menos, CA estimado ${fixed(-calc.caDelta, 3)} melhor e economia anual de energia de ${brl(calc.energySavings)}.`;
  el.kpiFeederPellets.textContent = pct(calc.feederPelletsGain);
  el.kpiFeederPelletsHint.textContent = "a mais de peletes no comedouro";
  el.kpiMoisture.textContent = `${fixed(calc.annualProductionGain, 0)} Ton`;
  el.kpiMoistureHint.textContent = "Ton a mais por ano";
  el.kpiFines.textContent = `${fixed(-calc.finesDelta)}%`;
  el.kpiEnergySavings.textContent = brlWhole(calc.energySavings);
}

function renderRows(calc) {
  const rows = [
    ["Peletes no comedouro", calc.control.feederTons, calc.ha.feederTons, calc.feederPelletsGain, "pct", "higher"],
    ["Produção de peletes", calc.control.pelletTons, calc.ha.pelletTons, calc.productionGain, "pct", "higher"],
    ["Amper por Ton", calc.control.ampsPerTon, calc.ha.ampsPerTon, calc.ampsPerTonDelta, "num", "lower"],
    ["Custo anual de energia", calc.control.annualEnergyCost, calc.ha.annualEnergyCost, -calc.energySavings, "brl", "lower"],
    ["Produção anual", calc.control.annualProduction, calc.ha.annualProduction, calc.annualProductionGain, "num0", "higher"],
    ["CA estimado", calc.control.estimatedCa, calc.ha.estimatedCa, calc.caDelta, "num3", "lower"],
  ];

  el.comparisonRows.innerHTML = "";
  rows.forEach(([label, control, ha, delta, format, direction]) => {
    const row = document.createElement("div");
    const value = format === "pct" ? pct(delta) : format === "num3" ? fixed(delta, 3) : format === "num0" ? fixed(delta, 0) : format === "brl" ? brlWhole(delta) : fixed(delta);
    const controlValue = format === "brl" ? brlWhole(control) : fixed(control, format === "num3" ? 3 : format === "num0" ? 0 : 2);
    const haValue = format === "brl" ? brlWhole(ha) : fixed(ha, format === "num3" ? 3 : format === "num0" ? 0 : 2);
    const isGood = direction === "lower" ? delta <= 0 : delta >= 0;
    const className = isGood ? "gain" : "loss";
    row.className = "comparison-row";
    row.innerHTML = `<strong>${label}</strong><span>Controle: ${controlValue}</span><span>H+A: ${haValue}</span><span class="${className}">${value}</span>`;
    el.comparisonRows.append(row);
  });
}

function renderCurve() {
  el.curveTable.innerHTML = curve
    .map((item) => `<tr><td>${fixed(item.pdi, 0)}%</td><td>${fixed(item.ca, 2)}</td><td>${item.source}</td></tr>`)
    .join("");
}

function svgEl(tag, attrs = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function drawBarGroup(container, options) {
  const { metrics, valueFormatter, colors, seriesLabels = [] } = options;
  const rect = container.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const max = Math.max(...metrics.flatMap((metric) => metric.values)) * 1.18 || 1;
  const chartTop = 42;
  const chartBottom = height - 48;
  const chartHeight = chartBottom - chartTop;
  const chartLeft = 42;
  const chartRight = width - 28;
  const groupWidth = (chartRight - chartLeft) / metrics.length;
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });

  container.innerHTML = "";
  container.append(svg);
  svg.append(svgEl("rect", { x: 0, y: 0, width, height, fill: "#ffffff" }));

  drawSubtleAxes(svg, chartLeft, chartTop, chartRight, chartBottom);

  metrics.forEach((metric, index) => {
    const groupCenter = chartLeft + index * groupWidth + groupWidth / 2;
    const barWidth = Math.min(46, groupWidth * 0.24);
    const gap = 8;
    const pairWidth = metric.values.length * barWidth + (metric.values.length - 1) * gap;
    const xStart = groupCenter - pairWidth / 2;

    metric.values.forEach((value, valueIndex) => {
      const barHeight = value / max * chartHeight;
      const x = xStart + valueIndex * (barWidth + gap);
      const y = chartBottom - barHeight;
      const formattedValue = valueFormatter(value, metric);
      const bar = svgEl("rect", {
        x,
        y,
        width: barWidth,
        height: barHeight,
        fill: colors[valueIndex] || "#23863b",
      });
      bar.addEventListener("mousemove", (event) => {
        showChartTooltip(event, {
          title: metric.label,
          series: seriesLabels[valueIndex] || metric.label,
          value: formattedValue,
        });
      });
      bar.addEventListener("mouseleave", hideChartTooltip);
      svg.append(bar);

      const valueNode = svgEl("text", { x: x + barWidth / 2, y: y - 8, fill: "#5d6b66", "font-size": 12, "text-anchor": "middle" });
      valueNode.textContent = formattedValue;
      svg.append(valueNode);
    });

    const labelNode = svgEl("text", { x: groupCenter, y: height - 20, fill: "#5d6b66", "font-size": 12, "text-anchor": "middle" });
    labelNode.textContent = metric.label;
    svg.append(labelNode);
  });
}

function drawSubtleAxes(svg, left, top, right, bottom) {
  svg.append(svgEl("line", { x1: left, y1: top, x2: left, y2: bottom, stroke: "#e7ebf2", "stroke-width": 1 }));
  svg.append(svgEl("line", { x1: left, y1: bottom, x2: right, y2: bottom, stroke: "#e7ebf2", "stroke-width": 1 }));
  for (let i = 1; i <= 3; i += 1) {
    const y = bottom - ((bottom - top) * i / 4);
    svg.append(svgEl("line", { x1: left, y1: y, x2: right, y2: y, stroke: "rgba(231, 235, 242, 0.65)", "stroke-width": 1 }));
  }
}

function drawChart(calc) {
  const metrics = [
    { label: "Peletes comedouro", values: [calc.control.feederTons, calc.ha.feederTons] },
    { label: "Peletes/Ton", values: [calc.control.pelletTons, calc.ha.pelletTons] },
    { label: "Amper/Ton", values: [calc.control.ampsPerTon, calc.ha.ampsPerTon] },
    { label: "CA estimado", values: [calc.control.estimatedCa, calc.ha.estimatedCa] },
  ];

  drawBarGroup(el.comparisonChart, {
    metrics,
    title: "",
    colors: ["#23863b", "#64d99b"],
    seriesLabels: ["Controle", "H+A"],
    valueFormatter: (value, metric) => fixed(value, metric.label === "CA estimado" ? 3 : 1),
  });

  drawLegend(el.comparisonChart, ["Controle", "H+A"], ["#23863b", "#64d99b"]);
}

function drawEnergyChart(calc) {
  const metrics = [
    { label: "Controle", values: [calc.control.annualEnergyCost] },
    { label: "H+A", values: [calc.ha.annualEnergyCost] },
    { label: "Economia", values: [Math.max(calc.energySavings, 0)] },
  ];

  drawBarGroup(el.energyChart, {
    metrics,
    title: "",
    colors: ["#23863b"],
    seriesLabels: ["Valor"],
    valueFormatter: (value) => brlWhole(value),
  });
}

function drawProductionChart(calc) {
  const metrics = [
    { label: "Controle", values: [calc.control.annualProduction] },
    { label: "H+A", values: [calc.ha.annualProduction] },
    { label: "Ganho produtividade", values: [Math.max(calc.annualProductionGain, 0)] },
  ];

  drawBarGroup(el.productionChart, {
    metrics,
    title: "",
    colors: ["#23863b"],
    seriesLabels: ["Valor"],
    valueFormatter: (value) => `${fixed(value, 0)} Ton`,
  });
}

function drawLegend(container, labels, colors) {
  const svg = container.querySelector("svg");
  if (!svg) return;
  const width = svg.viewBox.baseVal.width;
  let x = width - 150;
  labels.forEach((label, index) => {
    svg.append(svgEl("rect", { x, y: 18, width: 12, height: 12, fill: colors[index] }));
    const text = svgEl("text", { x: x + 18, y: 29, fill: "#050b22", "font-size": 12 });
    text.textContent = label;
    svg.append(text);
    x += 72;
  });
}

function showChartTooltip(event, area) {
  el.chartTooltip.innerHTML = `<strong>${area.title}</strong><span>${area.series}</span><span>${area.value}</span>`;
  el.chartTooltip.style.display = "block";
  const offset = 14;
  const tooltipWidth = el.chartTooltip.offsetWidth || 180;
  const left = Math.min(event.clientX + offset, window.innerWidth - tooltipWidth - 12);
  const top = Math.max(12, event.clientY + offset);
  el.chartTooltip.style.left = `${left}px`;
  el.chartTooltip.style.top = `${top}px`;
}

function hideChartTooltip() {
  el.chartTooltip.style.display = "none";
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
  drawEnergyChart(calc);
  drawProductionChart(calc);
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

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("is-active"));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("is-active"));
    button.classList.add("is-active");
    document.querySelector(`#tab-${button.dataset.tab}`).classList.add("is-active");
    const calc = calculate(selectedSimulation());
    drawChart(calc);
    drawEnergyChart(calc);
    drawProductionChart(calc);
  });
});

el.newButton.addEventListener("click", createNewSimulation);
el.resetButton.addEventListener("click", () => {
  const ok = confirm("Você realmente tem certeza que deseja restaurar o exemplo? As simulações salvas neste navegador serão apagadas.");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  simulations = [normalizeSimulation({ ...example, id: crypto.randomUUID() })];
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

[el.comparisonChart, el.energyChart, el.productionChart].forEach((chart) => {
  chart.addEventListener("mouseleave", hideChartTooltip);
});
