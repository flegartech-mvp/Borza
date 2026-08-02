# Performance report

All measurements ran only against the isolated local production image; they are not guaranteed production capacity.

## Browser budgets and results

`npm run test:performance` launches Chromium, performs three navigations per route, and fails on HTTP errors, load over 3,000 ms, LCP over 2,500 ms, CLS over 0.10 or JS transfer over 1.5 MB.

| Route | Cold TTFB | Cold load | Cold LCP | CLS | Cold JS transfer |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` | 88.1 ms | 572.1 ms | 616 ms | 0.000 | 416,850 B |
| `/learn` | 32.3 ms | 409.6 ms | 288 ms | 0.0845 | 603,946 B |
| `/lesson/lesson-ff-finance-map` | 100.3 ms | 498.8 ms | 360 ms | 0.0048 | 677,169 B |

All nine navigations passed. An initial catalogue run failed at CLS 0.1079. The cause was `content-visibility` reserving inaccurate heights for a fixed eight-card grid; removing it lowered final CLS to 0.0845. Measurements are headless local lab values without network shaping; hosted RUM is still required. INP was not independently measured, but real interactions in the browser suites completed without console/page errors.

## API bounded load

Two hundred catalogue requests at concurrency 20 completed with zero errors in 3.07 seconds: 65.05 requests/second, p50 9.19 ms, p95 457.70 ms, maximum 829.06 ms, 242-byte payload. The p95 includes PowerShell client scheduling and local Docker contention.

Classroom scenarios used real PostgreSQL, unique pseudonyms, one join and completed response per learner, and aggregate dashboard reads:

| Students | Join errors | Response errors | Join p50/p95 | Response p50/p95 | Dashboard |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 0 | 0 | 19.77 / 372.66 ms | 21.99 / 63.29 ms | 38.15 ms |
| 30 | 0 | 0 | 28.35 / 90.51 ms | 32.10 / 79.75 ms | 60.91 ms |
| 100 | 0 | 0 | 19.94 / 29.74 ms | 20.95 / 34.91 ms | 32.83 ms |

The original shared 30/minute bucket failed the legitimate 100-student requirement. A separate 120/minute join bucket now passes while contact/mentor/practical-attempt endpoints stay at 30/minute. This is not a promise above one local class or across multiple replicas.

## Resource snapshot

After the classroom run: API 185.4 MiB, PostgreSQL 43.41 MiB, frontend 134.8 MiB; sampled CPU was 0.37%, 0.01%, and 0.00% respectively. No monotonic growth was observed during the bounded run, but a long-duration soak/leak profile was not performed.

## Query and capacity limitations

- The dashboard aggregation remained constant/fast at 100 learners; code review found bounded session-scoped reads and supporting 0014/0015 indexes. Per-request SQL query count and `pg_stat_statements` slow-query evidence were not instrumented in this local image.
- Connection pool is bounded by configuration (default size 3, overflow 2, timeout 10 seconds). Pool saturation/failover was not load-tested.
- No third-party scripts ran. Heavy chart code remains client-only. Detailed bundle composition/duplicate-package visualization was not produced.
- Do not extrapolate 65 rps or 100 learners into a production SLO. Repeat on a confirmed staging deployment with realistic latency, platform rate limits, database monitoring and hosted Core Web Vitals.
