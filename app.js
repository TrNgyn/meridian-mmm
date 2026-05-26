const channels = [
  {
    id: "search",
    name: "Search",
    color: "#2f6fed",
    baseSpend: 42,
    maxEffect: 1850,
    saturation: 56,
    carryover: 0.12,
    note: "Fast capture, lower carryover"
  },
  {
    id: "social",
    name: "Social",
    color: "#138a8a",
    baseSpend: 34,
    maxEffect: 1450,
    saturation: 48,
    carryover: 0.2,
    note: "Mid-funnel demand shaping"
  },
  {
    id: "tv",
    name: "TV",
    color: "#7c5cc4",
    baseSpend: 24,
    maxEffect: 2300,
    saturation: 72,
    carryover: 0.45,
    note: "Brand reach with memory"
  },
  {
    id: "promo",
    name: "Promotions",
    color: "#c96b22",
    baseSpend: 18,
    maxEffect: 1200,
    saturation: 32,
    carryover: 0.08,
    note: "Short lift, margin risk"
  }
];

const scenarios = {
  balanced: {
    title: "Balanced mix",
    example: "Example: keep Search, Social, TV, and Promotions at a steady split instead of making a big bet on one channel.",
    explanation: "Use this as the base case. In a Meridian-style MMM, you compare other what-if plans against this to see how media impact, ROI, and saturation change.",
    price: 45,
    seasonality: 5,
    competitor: 8,
    budget: 120,
    spend: { search: 42, social: 34, tv: 24, promo: 18 }
  },
  digital: {
    title: "Digital push",
    example: "Example: move more budget into Search and Social because you want faster response from high-intent and retargetable audiences.",
    explanation: "This tests whether extra digital spend still creates extra sales or starts flattening on the response curve. Meridian uses concepts like media impact, ROI, and marginal ROI for this kind of budget decision.",
    price: 45,
    seasonality: 6,
    competitor: 12,
    budget: 149,
    spend: { search: 65, social: 54, tv: 14, promo: 16 }
  },
  brand: {
    title: "Brand build",
    example: "Example: increase TV while reducing Promotions because you want broader reach and longer memory, not just immediate conversion.",
    explanation: "This tests lagged media effect: some channels keep working after the spend happens. Meridian models media lag and saturation, so brand channels can look different from short-term channels.",
    price: 48,
    seasonality: 4,
    competitor: 7,
    budget: 130,
    spend: { search: 34, social: 28, tv: 58, promo: 10 }
  },
  promo: {
    title: "Promo week",
    example: "Example: discount the product and raise Promotions during a seasonal sales moment, while keeping brand spend lower.",
    explanation: "This separates baseline demand from marketing lift. In MMM, seasonality and price are controls, so the model does not give media full credit for sales that would have happened anyway.",
    price: 39,
    seasonality: 18,
    competitor: 15,
    budget: 130,
    spend: { search: 38, social: 32, tv: 14, promo: 46 }
  }
};

const state = structuredClone(scenarios.balanced);
let activeScenario = "balanced";

const uncertaintySamples = Array.from({ length: 41 }, (_, index) => {
  const wave = Math.sin(index * 1.7);
  const wobble = Math.cos(index * 2.3);
  return {
    baseline: 1 + wave * 0.035,
    search: { effect: 1 + wave * 0.08, saturation: 1 + wobble * 0.08 },
    social: { effect: 1 + Math.sin(index * 1.1 + 0.4) * 0.1, saturation: 1 + Math.cos(index * 1.9) * 0.1 },
    tv: { effect: 1 + Math.cos(index * 0.9 + 0.8) * 0.12, saturation: 1 + Math.sin(index * 1.3) * 0.12 },
    promo: { effect: 1 + Math.sin(index * 2.1 + 1.2) * 0.14, saturation: 1 + Math.cos(index * 1.5 + 0.3) * 0.1 }
  };
});

const $ = (selector) => document.querySelector(selector);
const formatter = new Intl.NumberFormat("en-US");
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

function response(spend, channel, sample) {
  const channelSample = sample?.[channel.id] || { effect: 1, saturation: 1 };
  const adstockedSpend = spend * (1 + channel.carryover);
  const maxEffect = channel.maxEffect * channelSample.effect;
  const saturation = channel.saturation * channelSample.saturation;
  return maxEffect * (1 - Math.exp(-adstockedSpend / saturation));
}

function marginalLift(spend, channel) {
  const current = response(spend, channel);
  const next = response(spend + 5, channel);
  return Math.max(0, next - current);
}

function model() {
  const baseSales = 7200;
  const priceEffect = (45 - state.price) * 42;
  const seasonalityEffect = baseSales * (state.seasonality / 100);
  const competitorEffect = -baseSales * (state.competitor / 100);
  const channelRows = channels.map((channel) => {
    const spend = state.spend[channel.id];
    const contribution = response(spend, channel);
    return {
      ...channel,
      spend,
      contribution,
      roi: contribution * state.price / Math.max(spend * 1000, 1),
      marginal: marginalLift(spend, channel)
    };
  });
  const marketingContribution = channelRows.reduce((sum, row) => sum + row.contribution, 0);
  const expectedSales = baseSales + priceEffect + seasonalityEffect + competitorEffect + marketingContribution;
  const baselineSales = baseSales + priceEffect + seasonalityEffect + competitorEffect;
  const totalSpend = channelRows.reduce((sum, row) => sum + row.spend * 1000, 0);
  const incrementalRevenue = marketingContribution * state.price;
  const roi = incrementalRevenue / Math.max(totalSpend, 1);

  return {
    baseSales,
    priceEffect,
    seasonalityEffect,
    competitorEffect,
    channelRows,
    marketingContribution,
    expectedSales,
    baselineSales,
    totalSpend,
    incrementalRevenue,
    roi
  };
}

function setScenario(name) {
  activeScenario = name;
  const selected = structuredClone(scenarios[name]);
  state.price = selected.price;
  state.seasonality = selected.seasonality;
  state.competitor = selected.competitor;
  state.budget = selected.budget;
  state.spend = selected.spend;
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.scenario === name);
  });
  syncControls();
  render();
}

function createControls() {
  const holder = $("#channelControls");
  holder.innerHTML = channels
    .map(
      (channel) => `
        <div class="channel-card">
          <div class="channel-head">
            <div>
              <div class="channel-name"><span class="swatch" style="background:${channel.color}"></span>${channel.name}</div>
              <small>${channel.note}</small>
            </div>
            <output id="${channel.id}Value"></output>
          </div>
          <input id="${channel.id}" type="range" min="0" max="100" value="${state.spend[channel.id]}" />
        </div>
      `
    )
    .join("");

  channels.forEach((channel) => {
    $(`#${channel.id}`).addEventListener("input", (event) => {
      state.spend[channel.id] = Number(event.target.value);
      render();
    });
  });
}

function syncControls() {
  $("#budget").value = state.budget;
  $("#price").value = state.price;
  $("#seasonality").value = state.seasonality;
  $("#competitor").value = state.competitor;
  channels.forEach((channel) => {
    $(`#${channel.id}`).value = state.spend[channel.id];
  });
}

function wireEvents() {
  $("#budget").addEventListener("input", (event) => {
    state.budget = Number(event.target.value);
    render();
  });
  $("#price").addEventListener("input", (event) => {
    state.price = Number(event.target.value);
    render();
  });
  $("#seasonality").addEventListener("input", (event) => {
    state.seasonality = Number(event.target.value);
    render();
  });
  $("#competitor").addEventListener("input", (event) => {
    state.competitor = Number(event.target.value);
    render();
  });
  $("#applyOptimizedButton").addEventListener("click", () => {
    const recommendation = optimizeBudget(state.budget);
    state.spend = { ...recommendation.spend };
    syncControls();
    render();
  });
  $("#resetButton").addEventListener("click", () => setScenario(activeScenario));
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => setScenario(tab.dataset.scenario));
  });
}

function render() {
  const result = model();
  const optimization = optimizeBudget(state.budget);
  const currentRange = uncertaintySummary(state.spend);
  const optimisedRange = uncertaintySummary(optimization.spend);
  $("#priceValue").textContent = money.format(state.price);
  $("#budgetValue").textContent = money.format(state.budget * 1000);
  $("#seasonalityValue").textContent = `${state.seasonality}%`;
  $("#competitorValue").textContent = `${state.competitor}%`;

  channels.forEach((channel) => {
    $(`#${channel.id}Value`).textContent = money.format(state.spend[channel.id] * 1000);
  });

  $("#salesMetric").textContent = formatter.format(Math.round(result.expectedSales));
  $("#salesDelta").textContent = `${formatter.format(Math.round(result.expectedSales - result.baselineSales))} from marketing`;
  $("#revenueMetric").textContent = money.format(result.incrementalRevenue);
  $("#roiMetric").textContent = `${result.roi.toFixed(2)}x`;
  $("#totalSpend").textContent = `${money.format(result.totalSpend)} total spend`;
  $("#scenarioTitle").textContent = scenarios[activeScenario].title;
  $("#scenarioExample").textContent = scenarios[activeScenario].example;
  $("#scenarioExplanation").textContent = scenarios[activeScenario].explanation;

  const decision = decisionSignal(result);
  const decisionCard = $(".decision");
  decisionCard.classList.remove("good", "watch", "risk");
  decisionCard.classList.add(decision.className);
  $("#decisionMetric").textContent = decision.title;
  $("#decisionHint").textContent = decision.hint;

  drawDecomposition(result);
  drawResponse(result);
  renderInsights(result);
  renderCurveGuide(result);
  renderCurrentExplanation(result);
  renderOptimizer(optimization, result, currentRange, optimisedRange);
}

function decisionSignal(result) {
  if (result.roi >= 0.8 && result.competitorEffect > -1200) {
    return {
      className: "good",
      title: "Scale",
      hint: "The current mix clears the ROI hurdle"
    };
  }
  if (result.roi >= 0.45) {
    return {
      className: "watch",
      title: "Rebalance",
      hint: "Shift budget towards stronger next-dollar returns"
    };
  }
  return {
    className: "risk",
    title: "Reduce",
    hint: "The model sees weak incremental payback"
  };
}

function renderInsights(result) {
  const bestMarginal = [...result.channelRows].sort((a, b) => b.marginal - a.marginal)[0];
  const mostSaturated = [...result.channelRows].sort((a, b) => a.marginal - b.marginal)[0];
  const externalDrag = Math.abs(result.competitorEffect) > Math.abs(result.seasonalityEffect);
  const decision = decisionSignal(result);
  const decisionCopy = {
    good: {
      title: "Decision: scale carefully",
      body: `The model estimates ${result.roi.toFixed(2)}x ROI, so this mix is clearing the current hurdle. Add budget first to ${bestMarginal.name}, then watch whether its dot moves into a flatter part of the curve.`
    },
    watch: {
      title: "Decision: rebalance",
      body: `${mostSaturated.name} is getting less efficient at the current spend level. Move some budget towards ${bestMarginal.name}, where the next dollar is estimated to create more extra sales.`
    },
    risk: {
      title: "Decision: reduce or rethink",
      body: `The model sees weak payback from the current spend. Lower the most saturated channel, reduce total spend, or change the offer before scaling.`
    }
  };
  const externalMessage = externalDrag
    ? "Competitor pressure is dragging baseline demand more than seasonality is helping. That means media has to work harder just to maintain sales."
    : "Seasonality is helping baseline demand. The model separates that natural lift from true media impact.";

  $("#insights").innerHTML = `
    <div class="insight">
      <strong>${decisionCopy[decision.className].title}</strong>
      <p>${decisionCopy[decision.className].body}</p>
    </div>
    <div class="insight">
      <strong>Curve reading</strong>
      <p>${bestMarginal.name} has the steepest curve around today&apos;s spend. ${mostSaturated.name} is flatter, so extra budget there is less productive.</p>
    </div>
    <div class="insight">
      <strong>Baseline context</strong>
      <p>${externalMessage}</p>
    </div>
  `;
}

function renderCurveGuide(result) {
  const bestMarginal = [...result.channelRows].sort((a, b) => b.marginal - a.marginal)[0];
  const mostSaturated = [...result.channelRows].sort((a, b) => a.marginal - b.marginal)[0];
  $("#curveGuide").innerHTML = `
    <div>
      <strong>How to read it</strong>
      <p>Each line shows estimated sales lift as spend increases. A steep line means the next dollar is useful. A flat line means the channel is saturating.</p>
    </div>
    <div>
      <strong>The dot matters</strong>
      <p>The dot is your current spend. If the dot sits on a steep part, scaling can still work. If it sits on a flat part, shift budget elsewhere.</p>
    </div>
    <div>
      <strong>Current read</strong>
      <p>Add next budget to ${bestMarginal.name}; be cautious adding more to ${mostSaturated.name}.</p>
    </div>
  `;
}

function renderCurrentExplanation(result) {
  const bestMarginal = [...result.channelRows].sort((a, b) => b.marginal - a.marginal)[0];
  $("#baselineText").textContent = `${formatter.format(Math.round(result.baselineSales))} baseline sales`;
  $("#mediaText").textContent = `${formatter.format(Math.round(result.marketingContribution))} extra media sales`;
  $("#nextDollarText").textContent = `${bestMarginal.name} has the best next dollar`;
}

function mediaContributionFor(spendMap, sample) {
  return channels.reduce((sum, channel) => sum + response(spendMap[channel.id], channel, sample), 0);
}

function uncertaintySummary(spendMap) {
  const values = uncertaintySamples
    .map((sample) => mediaContributionFor(spendMap, sample))
    .sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    low: percentile(values, 0.1),
    mean,
    high: percentile(values, 0.9),
    samples: values
  };
}

function percentile(sortedValues, probability) {
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.round((sortedValues.length - 1) * probability)));
  return sortedValues[index];
}

function optimizeBudget(budget) {
  const step = 5;
  const roundedBudget = Math.round(budget / step) * step;
  let best = {
    spend: { search: 0, social: 0, tv: 0, promo: roundedBudget },
    contribution: 0
  };

  for (let search = 0; search <= Math.min(100, roundedBudget); search += step) {
    for (let social = 0; social <= Math.min(100, roundedBudget - search); social += step) {
      for (let tv = 0; tv <= Math.min(100, roundedBudget - search - social); tv += step) {
        const promo = roundedBudget - search - social - tv;
        if (promo > 100) continue;
        const spend = { search, social, tv, promo };
        const contribution = mediaContributionFor(spend);
        if (contribution > best.contribution) {
          best = { spend, contribution };
        }
      }
    }
  }

  const totalSpend = roundedBudget * 1000;
  const incrementalRevenue = best.contribution * state.price;
  return {
    ...best,
    budget: roundedBudget,
    totalSpend,
    incrementalRevenue,
    roi: incrementalRevenue / Math.max(totalSpend, 1)
  };
}

function renderOptimizer(optimization, result, currentRange, optimisedRange) {
  $("#optimizerBudget").textContent = `${money.format(optimization.budget * 1000)} budget`;
  $("#optimizerMix").innerHTML = channels
    .map((channel) => {
      const recommended = optimization.spend[channel.id];
      const current = state.spend[channel.id];
      const delta = recommended - current;
      const deltaLabel = delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${money.format(delta * 1000)}`;
      const barWidth = recommended / Math.max(optimization.budget, 1) * 100;
      return `
        <div class="mix-card">
          <div class="mix-head">
            <span class="swatch" style="background:${channel.color}"></span>
            <strong>${channel.name}</strong>
          </div>
          <div class="mix-bar" aria-hidden="true">
            <span style="width:${Math.max(3, barWidth)}%; background:${channel.color}"></span>
          </div>
          <p>${money.format(recommended * 1000)} recommended</p>
          <small>${deltaLabel} vs current</small>
        </div>
      `;
    })
    .join("");

  const confidence = confidenceToImprove(state.spend, optimization.spend);
  $("#currentInterval").textContent = intervalText(currentRange);
  $("#optimizedInterval").textContent = intervalText(optimisedRange);
  $("#confidenceMetric").textContent = confidence === null ? "Matched" : `${Math.round(confidence * 100)}%`;
  renderTradeoffs(optimization, result, currentRange, optimisedRange, confidence);
}

function confidenceToImprove(currentSpend, optimizedSpend) {
  const sameMix = channels.every((channel) => currentSpend[channel.id] === optimizedSpend[channel.id]);
  if (sameMix) return null;
  const wins = uncertaintySamples.filter((sample) => {
    return mediaContributionFor(optimizedSpend, sample) > mediaContributionFor(currentSpend, sample);
  }).length;
  return wins / uncertaintySamples.length;
}

function intervalText(summary) {
  return `${formatter.format(Math.round(summary.low))}-${formatter.format(Math.round(summary.high))}`;
}

function renderTradeoffs(optimization, result, currentRange, optimisedRange, confidence) {
  const optimisedSales = result.baselineSales + optimisedRange.mean;
  const optimisedRevenue = optimisedRange.mean * state.price;
  const optimisedRoi = optimisedRevenue / Math.max(optimization.totalSpend, 1);
  const currentBudget = result.totalSpend;
  const budgetDelta = optimization.totalSpend - currentBudget;
  const salesDelta = optimisedSales - result.expectedSales;
  const revenueDelta = optimisedRevenue - result.incrementalRevenue;
  const confidenceLabel = confidence === null ? "Current mix is recommended" : confidence >= 0.75 ? "High confidence to improve" : confidence >= 0.55 ? "Medium confidence to improve" : "Low confidence to improve";

  $("#tradeoffTable").innerHTML = `
    <div class="trade-row trade-head">
      <span>Metric</span>
      <span>Current mix</span>
      <span>Recommended mix</span>
      <span>Trade-off</span>
    </div>
    <div class="trade-row">
      <span>Total budget</span>
      <strong>${money.format(currentBudget)}</strong>
      <strong>${money.format(optimization.totalSpend)}</strong>
      <span>${budgetDelta === 0 ? "Same spend" : `${budgetDelta > 0 ? "+" : ""}${money.format(budgetDelta)}`}</span>
    </div>
    <div class="trade-row">
      <span>Expected sales</span>
      <strong>${formatter.format(Math.round(result.expectedSales))}</strong>
      <strong>${formatter.format(Math.round(optimisedSales))}</strong>
      <span>${salesDelta >= 0 ? "+" : ""}${formatter.format(Math.round(salesDelta))}</span>
    </div>
    <div class="trade-row">
      <span>Incremental revenue</span>
      <strong>${money.format(result.incrementalRevenue)}</strong>
      <strong>${money.format(optimisedRevenue)}</strong>
      <span>${revenueDelta >= 0 ? "+" : ""}${money.format(revenueDelta)}</span>
    </div>
    <div class="trade-row">
      <span>Marketing ROI</span>
      <strong>${result.roi.toFixed(2)}x</strong>
      <strong>${optimisedRoi.toFixed(2)}x</strong>
      <span>${optimisedRoi >= result.roi ? "Higher efficiency" : "More volume, lower efficiency"}</span>
    </div>
    <div class="trade-row">
      <span>Uncertainty</span>
      <strong>${intervalText(currentRange)}</strong>
      <strong>${intervalText(optimisedRange)}</strong>
      <span>${confidenceLabel}</span>
    </div>
  `;
}

function drawDecomposition(result) {
  const canvas = $("#decompositionChart");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const rows = [
    { label: "Base demand", value: result.baseSales, color: "#526070" },
    { label: "Price effect", value: result.priceEffect, color: result.priceEffect >= 0 ? "#287d3c" : "#c5485b" },
    { label: "Seasonality", value: result.seasonalityEffect, color: result.seasonalityEffect >= 0 ? "#138a8a" : "#c5485b" },
    { label: "Competitor", value: result.competitorEffect, color: "#c5485b" },
    ...result.channelRows.map((row) => ({ label: row.name, value: row.contribution, color: row.color }))
  ];
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);
  const left = 150;
  const zero = 300;
  const barMax = width - zero - 58;
  const rowHeight = 34;

  ctx.font = "700 14px Inter, sans-serif";
  ctx.textBaseline = "middle";
  rows.forEach((row, index) => {
    const y = 32 + index * rowHeight;
    const barWidth = Math.abs(row.value) / max * barMax;
    const x = row.value >= 0 ? zero : zero - barWidth;
    ctx.fillStyle = "#657080";
    ctx.textAlign = "right";
    ctx.fillText(row.label, left - 16, y + 10);
    ctx.fillStyle = row.color;
    roundRect(ctx, x, y, barWidth, 20, 4);
    ctx.fill();
    ctx.fillStyle = "#18202b";
    ctx.textAlign = row.value >= 0 ? "left" : "right";
    ctx.fillText(formatter.format(Math.round(row.value)), row.value >= 0 ? x + barWidth + 10 : x - 10, y + 10);
  });

  ctx.strokeStyle = "#aeb8c5";
  ctx.beginPath();
  ctx.moveTo(zero, 18);
  ctx.lineTo(zero, height - 24);
  ctx.stroke();
}

function drawResponse(result) {
  const canvas = $("#responseChart");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const pad = { left: 48, right: 20, top: 20, bottom: 42 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = "#d9e0e8";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (plotHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }

  const maxY = Math.max(...channels.map((channel) => response(100, channel)));
  channels.forEach((channel) => {
    ctx.strokeStyle = channel.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let spend = 0; spend <= 100; spend += 2) {
      const x = pad.left + (spend / 100) * plotWidth;
      const y = pad.top + plotHeight - (response(spend, channel) / maxY) * plotHeight;
      if (spend === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const currentSpend = result.channelRows.find((row) => row.id === channel.id).spend;
    const x = pad.left + (currentSpend / 100) * plotWidth;
    const y = pad.top + plotHeight - (response(currentSpend, channel) / maxY) * plotHeight;
    ctx.fillStyle = channel.color;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#657080";
  ctx.font = "700 13px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Spend", pad.left + plotWidth / 2, height - 12);
  ctx.save();
  ctx.translate(14, pad.top + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Incremental sales", 0, 0);
  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius) {
  const safeWidth = Math.max(width, 1);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + safeWidth, y, x + safeWidth, y + height, radius);
  ctx.arcTo(x + safeWidth, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + safeWidth, y, radius);
  ctx.closePath();
}

createControls();
wireEvents();
syncControls();
render();
