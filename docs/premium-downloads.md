# Premium Bot Separation

The proprietary AI Trading Strategy Bot is a separate product and packaging concern. It is not part of Borza Academy’s frontend, backend, database model, simulator, or deployment.

## Current state

- No proprietary source or distributable ZIP is committed.
- Borza Academy exposes no premium product page, checkout control, entitlement endpoint, or download route.
- The Academy simulator cannot place real orders and contains none of the premium bot’s strategy, execution, ML, backtesting, exchange, or risk-management source.
- `premium/ai-trading-bot/` contains packaging documentation/wrappers and safety tests only.

## Future commercial delivery

If the separate product is sold later, it needs its own reviewed implementation with:

1. A server-side payment provider and verified, idempotent webhooks.
2. Authenticated purchase entitlements and immutable audit history.
3. Private object storage with short-lived signed URLs.
4. Refund/revocation handling and access logs.
5. A security and licensing review separate from Borza Academy.

No client-supplied payment state may grant access. Never place a paid ZIP under `frontend/public`, expose it through Academy static assets, or add a fake purchase-protection placeholder.
