# Architecture Deep-Dive

This document explains the internal architecture of the AI Travel Planning Agent in detail.

---

## System Overview

```
Browser (Vanilla JS)
       │
       │  user fills form & clicks Plan
       │
       ▼
  app.js — runAgent()
       │
       │  12-step sequential pipeline
       │  each step renders live to DOM
       │
       ├──[pure logic]──► Date math, budget calc, constraint checks
       │
       └──[LLM tools]───► tools.js — callLLM()
                               │
                               │  POST /v1/chat
                               │  + JSON Schema
                               │
                               ▼
                     llm_gatewayV2/main.py
                               │
                               │  router.py selects provider
                               │  validates response against schema
                               │  retries with next provider on failure
                               │
                               ├── Groq (llama-3.3-70b)
                               ├── Gemini (flash-lite)
                               ├── Nvidia NIM
                               ├── Cerebras
                               ├── OpenRouter
                               ├── GitHub Models
                               └── Ollama (local)
```

---

## Frontend Architecture

### `index.html`
The single-page shell. Contains:
- Input form (left panel)
- Reasoning panel container (right panel, populated dynamically)
- Itinerary section (hidden until results arrive)
- Budget breakdown section

### `style.css`
Full design system with:
- CSS custom properties for all tokens
- Glassmorphism card styles
- Slider input with gradient fill
- Step card collapse/expand animations
- Responsive layout
- Donut chart SVG styles

### `app.js`
The agent orchestrator. Key responsibilities:
1. `runAgent(userInput)` — main async pipeline function, runs all 12 steps
2. `renderStep(step)` — appends a step card to the reasoning panel with live animation
3. `renderItinerary(finalItinerary)` — renders the full output (summary cards, day cards, budget donut chart)
4. `renderDonutChart()` — draws an SVG donut chart from budget category data
5. UI helpers: `addThinkingIndicator`, `clearPanel`, `nextStep`, `setText`

### `tools.js`
The tool library. Key responsibilities:
1. `callLLM(systemPrompt, userPrompt, schema)` — core fetch wrapper to the gateway
2. One async function per agent tool, each with its own JSON Schema definition
3. All tools return a standardized `_result` object with `{tool, input, output, success, error, timestamp}`

### `data.js`
Static reference data retained as a last-resort fallback when LLM tools fail (destination info, activity costs, hotel data). Not used when the gateway is healthy.

---

## Backend Architecture

### `main.py`
FastAPI application entry point.
- Loads `.env` from parent directory (`../`.env`)  
- Initializes providers, router, and Gemini cache on startup (`lifespan`)
- `/v1/chat` handler: normalizes messages, calls router, handles structured output validation loop
- **Failover on schema validation failure**: if the chosen LLM returns JSON that doesn't match the schema, the error is re-raised as a generic `Exception` (not `HTTPException`) so the router can catch it and try the next provider

### `router.py`
The smart failover router.
- Maintains per-provider state: `tokens_today`, `last_error`, `error_count`  
- `select()` picks the next healthy provider respecting `LLM_ORDER`
- Skips providers that are rate-limited or have hit error thresholds
- The `Router.chat()` loop retries until a provider succeeds or all are exhausted

### `providers.py`
Individual provider HTTP integrations. Each provider class implements `chat(messages, **kwargs)` using `httpx` for async requests.
- Normalizes different API formats (OpenAI-compatible, Gemini native, etc.)
- Raises `ProviderError` with `retryable=True/False` based on HTTP status:
  - `400, 401` → not retryable (developer error)  
  - `429, 500, 503` → retryable (rate limit or transient)

### `cache.py`
Gemini implicit caching. Hashes the system prompt and caches the create-cache API response for a configurable TTL (default: 5 minutes). Reduces cost on repeated calls with the same system context.

### `db.py`
SQLite call logging. Every provider attempt is logged with:
- `ts` (unix timestamp)
- `provider`, `model`
- `input_tokens`, `output_tokens`
- `latency_ms`
- `status` (`ok` | `error`)
- `error` (message string)
- `attempted` (comma-separated list of providers tried before this one)
- `prompt_chars`, `response_chars`

---

## Data Flow: India → Bangkok, 13 nights

```
User Input
  destination: "Bangkok"
  origin: "India"
  budget: $4700
  duration: 13
  travelClass: "economy"
  hotelCategory: "midrange"
  preferences: ["culture", "food", "adventure"]
         │
         ▼
Step 1   Plan subtasks (no LLM)
Step 2   validateDateRange() → 13 nights confirmed
Step 3   getDestinationInfo("Bangkok")
           LLM → { country: "Thailand", currency: "THB", cuisine: [...], ... }
Step 4   flightSearch("India" → "Bangkok", economy, June)
           LLM → { priceUSD: 380, airline: "Thai Airways", ... }
Step 5   hotelSearch("Bangkok", midrange, 13 nights)
           LLM → { hotelName: "Siam Heritage Boutique", pricePerNight: 65, total: 845 }
Step 6   calculateBudgetAllocation($4700, ["culture","food","adventure"], 13 nights)
           LLM → { food: 780, activities: 900, transport: 390, misc: 180 }
Step 7   Constraint check: $380 + $845 = $1225 fixed, $3475 remaining ✅
Step 8   selectActivities("Bangkok", ["culture","food","adventure"], budget: $900, 13 days)
           LLM → [Grand Palace ($25), Floating Market ($40), Muay Thai Boxing ($80), ...]
Step 9   buildDayItinerary("Bangkok", activities, 13 nights, "2026-06-07")
           LLM → 13 day objects each with theme, neighborhood, activities, meals, transport
           ⚠ This is the largest payload (~8000 tokens output)
Step 10  calculateTotalCost([flights, hotel, food, activities, transport, misc])
           → total: $3,200 | verification PASSED
Step 11  analyzeRisks("Bangkok", $4700, 13 nights, economy, June)
           LLM → { risks: [], warnings: ["Monsoon season"], emergencyFund: 300 }
Step 12  Final: $1,500 surplus | Confidence: 90% | 1 warning
         → Render full itinerary UI
```

---

## Why Steps Can Be Slow

| Cause | Typical Delay | Mitigation |
|-------|--------------|------------|
| Groq TPM rate limit | +10-20s failover | Gemini takes over automatically |
| `buildDayItinerary` large payload | 7-15s | `max_tokens: 8192` set explicitly |
| Ollama local model missing | +500ms per call | Moved to end of `LLM_ORDER` |
| JSON schema validation fail → failover | +full LLM call time | All prompts include `"json"` keyword |
| All providers exhausted | tool returns `{success: false}` | App continues gracefully with fallback |

---

## Confidence Score Calculation

The confidence score starts at `95%` and is decremented when:

| Event | Deduction |
|-------|-----------|
| Destination not found | -15% |
| Flight route not found | -5% |
| Budget exceeded by fixed costs | -30% |
| Budget very tight (< $200 remaining) | -10% |
| Total cost over budget | -20% |
| High-risk items in risk analysis | -10% |

Final score is clamped to `[0%, 100%]` and displayed in the results.
