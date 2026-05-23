# LLM Gateway V2

A lightweight **FastAPI-based LLM router** that provides a single `/v1/chat` endpoint backed by multiple LLM providers with automatic failover, structured output validation, response caching, and SQLite call logging.

This gateway is used as the backend for the [AI Travel Planning Agent](../README.md) but can be used as a standalone drop-in API router for any project.

---

## Features

- **Multi-provider failover** — Groq → Gemini → Nvidia → Cerebras → OpenRouter → GitHub → Ollama
- **Structured JSON output** — enforces a JSON Schema on every response; invalid outputs trigger failover
- **Gemini implicit caching** — reduces costs on repeated system prompts
- **SQLite call logging** — every provider attempt logged with latency, tokens, status, and error
- **Web monitoring dashboard** — live call history at `http://localhost:8099`
- **CORS-enabled** — ready to be consumed by any browser-based frontend

---

## Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/chat` | Main chat completion endpoint |
| `GET` | `/v1/providers` | List all configured providers and their status |
| `GET` | `/v1/capabilities` | List provider capabilities (vision, tools, etc.) |
| `GET` | `/v1/status` | Health check |
| `GET` | `/v1/calls` | Call history from SQLite (query param: `?limit=N`) |
| `GET` | `/` | Web monitoring dashboard |

---

## Request Format

```json
{
  "messages": [
    { "role": "system", "content": "You are a travel expert. Output strictly in JSON format." },
    { "role": "user",   "content": "Give me hotel options in Bangkok for midrange budget." }
  ],
  "response_format": {
    "type": "json_schema",
    "schema_": {
      "type": "object",
      "properties": {
        "hotelName": { "type": "string" },
        "pricePerNight": { "type": "integer" }
      },
      "required": ["hotelName", "pricePerNight"]
    }
  },
  "temperature": 0.7,
  "max_tokens": 8192
}
```

> **Note:** When using `response_format`, always include the word `"json"` somewhere in your system prompt. Some providers (Groq) require this.

---

## Response Format

```json
{
  "text": "{ \"hotelName\": \"Siam Heritage Boutique\", \"pricePerNight\": 65 }",
  "parsed": { "hotelName": "Siam Heritage Boutique", "pricePerNight": 65 },
  "provider": "groq",
  "model": "llama-3.3-70b-versatile",
  "input_tokens": 450,
  "output_tokens": 120,
  "latency_ms": 890,
  "attempted": ""
}
```

The `attempted` field logs any providers that were tried and failed before the successful one.

---

## Environment Variables

```env
# Provider keys
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
NVIDIA_API_KEY=nvapi-...
CEREBRAS_API_KEY=...
OPENROUTER_API_KEY=sk-or-...
GITHUB_TOKEN=ghp_...

# Model overrides (optional)
GROQ_MODEL=llama-3.3-70b-versatile
GEMINI_MODEL=gemini-3.1-flash-lite-preview

# Routing
LLM_ORDER=groq,gemini,nvidia,cerebras,openrouter,github,ollama
GATEWAY_V2_PORT=8099

# Ollama (local)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

---

## Running

```bash
pip install -r requirements.txt
python main.py
```

The server starts on the port defined by `GATEWAY_V2_PORT` (default: `8099`).

---

## File Reference

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app, `/v1/chat` handler, CORS, structured output validation loop |
| `router.py` | Provider selection, failover logic, rate-limit tracking |
| `providers.py` | Individual provider integrations (Groq, Gemini, Nvidia, etc.) |
| `schemas.py` | Pydantic models for request/response validation |
| `cache.py` | Gemini implicit caching (TTL-based, keyed on system prompt hash) |
| `db.py` | SQLite schema init and call logging |
| `client.py` | Typed Python client for consuming the gateway from other Python code |
| `run.sh` | Quick-start shell script |
| `static/` | Web dashboard HTML/JS/CSS |
| `tests/` | Unit and integration tests |
