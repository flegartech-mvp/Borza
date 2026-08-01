# Third-Party Software Notices & Open-Source Licenses

This document summarizes third-party software components, open-source libraries, and data providers incorporated into the Borza application, along with their respective licensing and attribution requirements.

---

## Data Source & Provider Attributions

### 1. The GDELT Project
- **Data Source**: GDELT Project (DOC 2.0 ArticleList API)
- **Website**: [https://www.gdeltproject.org/](https://www.gdeltproject.org/)
- **Notice**: Borza incorporates event and news discovery metadata provided by the GDELT Project. GDELT does not endorse Borza or its derived financial analyses. All story records maintain canonical links back to original publishers.

### 2. Official Central Bank & Regulatory Feeds (RSS / Atom)
- **Feeds**: European Central Bank (ECB), Federal Reserve System, Banka Slovenije, U.S. Securities and Exchange Commission (SEC).
- **Notice**: Official press releases and public statistical disclosures are retrieved directly from first-party RSS/Atom XML feeds.

---

## Open-Source Software Components

### Frontend Libraries

#### Next.js
- **License**: MIT
- **Copyright**: (c) 2026 Vercel, Inc.
- **URL**: [https://nextjs.org/](https://nextjs.org/)

#### React & React DOM
- **License**: MIT
- **Copyright**: (c) Meta Platforms, Inc. and affiliates.
- **URL**: [https://react.dev/](https://react.dev/)

#### Lucide React Icons
- **License**: ISC
- **Copyright**: (c) Lucide Contributors
- **URL**: [https://lucide.dev/](https://lucide.dev/)

#### D3 Geo & TopoJSON Client
- **License**: ISC / BSD-3-Clause
- **Copyright**: (c) Mike Bostock
- **URL**: [https://d3js.org/](https://d3js.org/)

#### Tailwind CSS
- **License**: MIT
- **Copyright**: (c) Tailwind Labs Inc.
- **URL**: [https://tailwindcss.com/](https://tailwindcss.com/)

---

### Backend Libraries

#### FastAPI
- **License**: MIT
- **Copyright**: (c) Sebastián Ramírez
- **URL**: [https://fastapi.tiangolo.com/](https://fastapi.tiangolo.com/)

#### SQLAlchemy & Alembic
- **License**: MIT
- **Copyright**: (c) Michael Bayer
- **URL**: [https://www.sqlalchemy.org/](https://www.sqlalchemy.org/)

#### HTTPX & Pydantic
- **License**: BSD-3-Clause / MIT
- **Copyright**: (c) Encode OSS / Samuel Colvin
- **URL**: [https://www.python-httpx.org/](https://www.python-httpx.org/)

#### Redis / Valkey Python Client
- **License**: MIT
- **Copyright**: (c) Redis Contributors / Valkey Project
- **URL**: [https://valkey.io/](https://valkey.io/)

---

## Software License Decision Notice

No open-source software license file (e.g., `LICENSE`, `LICENSE.md`) is committed in the repository root. Selecting and committing a software license for Borza itself is flagged as an explicit project owner decision per workspace policy (`AGENTS.md`).
