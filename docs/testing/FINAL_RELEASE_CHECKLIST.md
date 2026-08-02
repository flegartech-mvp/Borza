# Final release checklist

Code-under-test: `d320eee` on `test/full-platform-hardening`. This checklist records local/isolated evidence, not hosted-production approval.

## Passed

- [x] Clean baseline inspected; no unrelated source changes overwritten.
- [x] Content validator and seven validator tests pass.
- [x] Backend format, lint, mypy and coverage suite pass (38 passed, 2 PostgreSQL skips, 87%).
- [x] Premium safety suite passes (59 passed, 3 expected platform/integration skips).
- [x] Frontend format, lint, typecheck, 37 unit tests and strict 37-route build pass.
- [x] Strict production frontend Docker image builds; isolated frontend/API/PostgreSQL stack is healthy.
- [x] Desktop and mobile production browser journeys pass, including console/page-error and overflow checks.
- [x] Axe WCAG/best-practice scans pass with color contrast enabled.
- [x] Keyboard focus/activation and frontend API-failure fallback pass on desktop/mobile.
- [x] Performance budgets pass; 10/30/100 learner classroom runs have zero errors.
- [x] Host, CORS, method, malformed JSON, extra field, oversized body, rate-limit spoof, ownership, classroom token/replay, prompt injection/PII and public answer-key cases exercised.
- [x] Clean SQLite head/check/downgrade/upgrade and real PostgreSQL 16/RLS integration pass.
- [x] Database outage readiness and recovery behavior pass.
- [x] npm production/full audits report zero vulnerabilities; no direct Git dependency.
- [x] Worktree secret token patterns report zero matching files.
- [x] Pinned Gitleaks scan reports no leaks across the complete Git history.
- [x] Retention CLI is dry-run first and deletion/cascade is regression-tested.
- [x] CI builds the real production frontend image.

## Preview evidence

- GitHub Actions security, backend and frontend checks completed successfully on the draft PR.
- The first automatic Vercel Preview stopped because Preview lacked `NEXT_PUBLIC_API_URL`.
- A Preview-only `https://api.example.invalid` value was added to avoid production traffic; the isolated demo/fallback redeploy completed Ready at `https://borza-om71blia8-flegar-tech.vercel.app`.
- The preview is intentionally not evidence of hosted API, authentication or persistence behavior.

## Required before controlled pilot

- [ ] Apply migration 0015 to the pilot database and verify grants/security advisors.
- [ ] Configure real Supabase Auth and assign teacher roles only through protected app metadata.
- [ ] Schedule/monitor the retention command; approve school privacy/safeguarding notices and lawful basis.
- [ ] Configure distributed/edge rate limits and verify the 100-student NAT scenario.
- [ ] Run hosted smoke/ownership/accessibility/performance checks on the exact preview commit.
- [ ] Confirm backup restore, error monitoring, alerting, log redaction/retention and incident ownership.
- [ ] Decide whether the optional AI provider stays disabled; if enabled, run live provider privacy, timeout, cost and prompt-safety tests.

## Required before broad production

- [ ] Remove CSP `unsafe-inline` through a reviewed nonce/hash design.
- [ ] Separate browser demo scoring metadata if demo evidence could be mistaken for authoritative assessment.
- [ ] Complete NVDA/VoiceOver/TalkBack, zoom/reflow and forced-colors testing.
- [ ] Add canonical URL, robots, sitemap and approved social-preview metadata.
- [ ] Obtain a successful Python advisory scan; current `pip-audit` attempts timed out externally.
- [ ] Complete a staging soak/load test with query/pool/CPU/memory telemetry and hosted Core Web Vitals.
- [ ] Perform production-like restore and rollback rehearsal.

## Decision

**READY FOR PREVIEW.** No critical or high finding remains open. Do not call this production-ready: live authentication, hosted migration/grants, backups, monitoring, distributed limits, retention operations, CSP and assistive-technology evidence are still required. A controlled pilot is conditional on completing the pilot checklist above.
