# Borza AI Trading Bot Packaging

This directory contains packaging wrappers and public distribution policy only.
The AI Trading Strategy Bot is **proprietary**: it is not open source,
source-available, or MIT licensed. Its source repository and every source ZIP
must remain outside the public Borza repository.

## Artifact policy

`artifacts/README.md` is intentionally the only public artifact file. Paid
artifacts are generated from an authorized private source workspace and must
never be committed here, published as a public release asset, or placed under
`frontend/public`. The ZIP ignore rule is a safeguard, not a distribution
mechanism.

For production, upload a vetted package directly to private object storage and
deliver it only after entitlement verification through a short-lived signed
URL. See `docs/premium-downloads.md` for the required checkout and delivery
flow.

## Rebuild

The source path must point to an authorized external working copy:

```powershell
.\package-bot.ps1 -SourcePath C:\private\ai-bot-source
```

```bash
./package-bot.sh /private/ai-bot-source
```

Both wrappers call `package_bot.py`, which rejects links, path escapes,
sensitive or binary-risk filenames, non-allowlisted file types, non-UTF-8
content, oversized inputs, known provider credentials, generic secret
assignments, credentialed connection URLs, JWT-like values, and assigned wallet
mnemonics. The scan covers Python syntax, JavaScript/TypeScript expressions,
YAML block scalars, TOML multiline strings, and literal Authorization or
session-Cookie headers, including common curl and Python auth-constructor
forms. Explicit placeholders such as `replace-with-api-secret`,
`${DATABASE_PASSWORD}`, and `<session-token>` remain valid in `.env.example`.
Placeholder defaults are scanned recursively, so `${TOKEN:-actual-token}` is
rejected. The PowerShell wrapper also exits unsuccessfully when Python cannot
be resolved or the builder returns a nonzero status.
The ZIP is written from the exact bytes that passed those checks. That generated
output is private and must be moved to private object storage; public source
packages must never be committed.
