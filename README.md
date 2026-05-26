# MMM Learning Lab

An interactive browser-based simulator for learning Marketing Mix Modelling (MMM) concepts, inspired by the Meridian MMM framework.

## What it does

The app lets you explore how media spend, price, seasonality, and competitor pressure combine to drive sales. You can adjust budget and channel allocations in real time and immediately see:

- **Sales decomposition** — how much of expected sales comes from baseline demand, price effects, seasonality, competitor drag, and each media channel
- **Response curves** — diminishing returns per channel, with your current spend marked so you can see where you sit on the curve
- **Budget optimizer** — a brute-force allocation that finds the spend split across Search, Social, TV, and Promotions that maximises incremental sales for a given budget
- **Uncertainty ranges** — a Monte Carlo-style test across 41 parameter samples showing the likely range of media sales and how confident the recommendation is vs. the current mix
- **Trade-off table** — side-by-side comparison of the current mix vs. recommended mix across budget, expected sales, incremental revenue, ROI, and uncertainty

Four preset scenarios load a realistic starting state:

| Scenario | What it tests |
|---|---|
| Balanced | Base case; steady split across all channels |
| Digital Push | Heavy Search + Social; tests digital saturation |
| Brand Build | TV-heavy; demonstrates lagged carryover effects |
| Promo Week | High Promotions + low price; isolates baseline vs. media lift |

## Concepts modelled

| Concept | Implementation |
|---|---|
| Adstock / carryover | `spend * (1 + carryover)` before applying the response curve |
| Saturation (diminishing returns) | Hill-style exponential: `maxEffect * (1 - exp(-adstockedSpend / saturation))` |
| Marginal ROI | Incremental sales from the next $5k spend unit |
| Base demand | Fixed at 7 200 units, adjusted by price, seasonality, and competitor signals |
| Uncertainty | 41 deterministic samples varying effect size and saturation per channel |

## Usage

Open `index.html` directly in a browser — no build step, no dependencies, no server required.

```
open index.html
```

Use the left panel to change the total budget, average price, seasonality lift/drag, competitor pressure, and per-channel spend. Click **Apply recommended mix** to apply the optimizer's suggestion, or **Reset** to restore the active scenario's defaults.

## File structure

```
index.html   — layout and all UI markup
app.js       — model, optimizer, uncertainty, and Canvas charts
styles.css   — design tokens and responsive grid layout
```

## Key parameters (app.js)

Each channel is defined with:

- `maxEffect` — ceiling sales lift at infinite spend
- `saturation` — spend level at which ~63 % of max effect is reached
- `carryover` — fraction of spend that "lingers" into the next period
