# Controlled Socratic Mentor

The Mentor asks one bounded question about assumptions, calculations, alternatives, evidence, or risk capacity. It must not decide for the learner, provide personalised financial/tax/legal/credit/trading advice, predict prices, recommend products, promise returns, transmit orders, or request credentials and sensitive financial data.

`MENTOR_ENABLED=false` is the default. With no provider, the API and guest UI return a clearly labelled deterministic guided mode. Enabling requires a server-only `OPENAI_API_KEY`; the browser never receives it. Calls use the Responses API with a strict small schema, low reasoning effort, `store: false`, timeout, and a stable HMAC-derived safety identifier. No conversation history is stored by Borza.

Provider timeout, HTTP failure, invalid JSON, or schema mismatch returns guided mode with an availability note. Operators should evaluate multilingual safety and usefulness, monitor cost/latency without logging learner text, and keep a kill switch. Current default model configuration is `gpt-5.6-sol`; select a lower-cost model only after representative safety/quality evaluation.
