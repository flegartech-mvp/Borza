# Premium Bot Download Architecture

The AI Trading Strategy Bot is a separate **proprietary** paid product. It is
not open source, source-available, or MIT licensed. Its source code and source
packages are not part of the Borza frontend, backend, or public repository, and
must never be stored under `frontend/public`.

## Production flow

1. The customer opens the premium bot product page.
2. The customer completes checkout with the configured payment provider.
3. The payment provider sends a server-side webhook.
4. The backend validates the webhook signature before trusting the event.
5. A successful purchase entitlement is stored in the database.
6. The authenticated customer requests a download.
7. The backend verifies the customer's active entitlement.
8. The backend requests a short-lived signed URL from private object storage.
9. The signed URL expires after a short period, recommended at five minutes.

No client-supplied payment status may grant an entitlement. Webhook processing
must be idempotent, purchase records must preserve provider event IDs, and the
download endpoint must require authenticated customer identity.

## Service boundary

`backend/app/services/premium_downloads.py` defines provider-neutral interfaces
for webhook verification, entitlement storage, and signed private-object URLs.
A future Stripe or alternative provider adapter should implement those
interfaces without adding provider logic to React components.

## Local development placeholder

No ZIP is committed to this repository. An authorized developer may temporarily
place a privately generated, ignored ZIP under
`premium/ai-trading-bot/artifacts/` for local route testing only. Direct
downloads are disabled by default. For that local-only scenario, set:

```env
ENVIRONMENT=development
PREMIUM_LOCAL_DOWNLOAD_ENABLED=true
PREMIUM_LOCAL_ARTIFACT_PATH=premium/ai-trading-bot/artifacts/borza-ai-trading-bot.zip
```

Then request `GET /api/premium/download-placeholder`. The route returns `404`
unless the environment is development, the explicit flag is enabled, and the
resolved private ZIP remains inside `premium/ai-trading-bot/artifacts`.
Production mode always keeps this placeholder disabled. Local packages must be
removed after testing and must never be committed or distributed from a public
repository.

## Production requirements

- Payment provider account and server-side SDK
- Webhook signing secret stored only in backend environment variables
- Authenticated customer accounts
- Database migration for purchases and entitlements
- Private object storage with short-lived signed URLs
- Idempotent webhook event storage and audit logging
- Refund and entitlement-revocation handling
