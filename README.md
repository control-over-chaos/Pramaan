# pramaan

Institutional Verification & Regulatory Intelligence System

Pramaan is an API-first, human-controlled workspace for institutional application verification, evidence review, regulatory compliance, rectification, and audit. Automated results are decision support. Authorized regulatory authorities retain all statutory decisions.

The workspace starts empty. Authorized administrators can add institution records or import a supplied Pramaan synthetic dataset. Importing requires validation and a preview; records are never generated automatically.

## Run locally

Requires Node.js 24 or later. No external Node.js packages are needed.

1. Optionally copy `.env.example` to `.env` and set deployment values.
2. Run `node src/server.mjs` (or `npm start` where npm is installed).
3. Open `http://127.0.0.1:4173`.
4. On the first visit, create the initial administrator account. First-account setup automatically closes once an account exists.

Local document parsing and previews also require Python with `pypdf`, `pdfplumber`, and `Pillow` installed. Set `PRAMAAN_PYTHON` in `.env` to that Python executable, or make it available as `python` on Windows or `python3` on other platforms. Local image OCR requires Windows OCR with the appropriate language support; an external OCR provider can be configured separately.

The initial local database is created at `data/pramaan.sqlite`; private document files are stored under `storage/`. Both directories are ignored by Git. Back up and protect them according to the deployment retention policy.

## Dataset import

Administrators can open **Dataset Import**, extract an import ZIP, and choose its `pramaan_dataset.json` file (up to 1 MB). Validate the preview, review its counts and limitations, then select **Import validated dataset**. The JSON is the authoritative import representation; CSV and Excel copies in the same package must not be imported again.

The importer validates identifiers, field types, dates, and relationships before writing all records in one SQLite transaction. It preserves every original row in `dataset_records`, records a checksum and a live audit event, and detects duplicate imports without overwriting records. Sample users remain inert source identities and cannot sign in. The original synthetic audit history is shown separately from the workspace audit trail.

The ten-institution package contains public institution identities and synthetic operational scenarios. It supplies no official AICTE institution identifiers, so imported references use `IMPORT:`. Programme intake is a declared illustrative value, approvals remain unknown, checks are `TEST_ONLY`, and illustrative rules remain drafts. Document entries contain metadata only; downloads and processing require a real replacement file. Institution profiles show programme and faculty records. Application and report views retain the dataset notice.

This importer supports this package's explicit public-identity/synthetic-test JSON schema. It does not treat attached instructions as executable commands, create accounts, activate providers, or publish regulatory rules.

The additional-institutes package is also supported. The importer repairs its recognizable shifted institution columns and numeric/boolean text values, and keeps both original source cells and normalized records. Preview warnings disclose each correction. It reuses an existing imported public institution profile only when name, city, state and website host agree. Reused rule keys receive separate identities for each import batch, preserving the meaning of historical results. Empty replacement-document references remain missing evidence. Test failures and review outcomes retain their explicit test labels.

## Internal eligibility and Trust Hub

Pramaan seeds ten weighted internal eligibility categories (total weight 100). They are guidance weights, not active legal requirements. A category enters an application's denominator only after an authorized administrator explicitly links a published rule to that category. Unconfigured categories remain visible as not configured and do not produce a fabricated percentage. Criteria satisfied and verification coverage are stored as immutable, evidence-digested assessment snapshots. An explicitly configured mandatory rule failure blocks the internal "eligible for approval review" status. All assessment screens and reports label these results as decision support, not official approval.

Administrators can associate a published rule with an eligibility category when creating it. The Trust Hub also includes ten synthetic registry fixtures and downloadable PDF samples in `public/demo-registry/`. Their results are labelled DEMO and cannot satisfy official source-verification rules. DigiLocker is deliberately reported as NOT_CONNECTED until authorized endpoint and credential configuration is supplied; no live government-source connection is implied.

The controlled evaluation contains three draft Fire NOC rules only: current file present, expiry date valid for the assessment date, and authorized source status. Drafts do not contribute to eligibility percentages until an authorized administrator tests, links, and publishes them. Fire NOC extraction currently maps certificate number, institution name, address, issue date and expiry date; a real file, checksum validation, current evidence and cross-document consistency remain separate checks. The Fire NOC demo fixture in the Integration Center is synthetic and never an issued or verified certificate. In environments without Windows OCR, use its searchable PDF companion for repeatable extraction testing; the PNG remains useful for image upload and manual-review flows.

Sahayak can answer eligibility questions from the selected or named application, with details filtered by the signed-in user's permissions. For example, open an application and ask "What is my eligibility percentage and why?" If no published linked rules are configured or evaluated, it explains that no score is available rather than reporting 0%.

The evidence-review indicator is also internal and advisory. It adds 40/25/15/5 points for conclusive published-rule failures with CRITICAL/HIGH/MEDIUM/LOW severity, and 15 points for a clear cross-document contradiction, capped at 100. The displayed bands are LOW (0–24), MODERATE (25–49), HIGH (50–74), and CRITICAL (75–100). It reports an incomplete assessment without a numeric score while applicable checks are inconclusive. Unavailable sources and OCR uncertainty are shown separately and never add risk points; a duplicate or uncertain extraction alone is not treated as fraud. This model is a review aid, not a legal or fraud determination.

Document and source-verification registers provide pagination so every imported record remains accessible as datasets grow.

## Architecture

- `public/`: responsive operator UI, served as same-origin static assets.
- `src/server.mjs`: versioned HTTP API, request validation, authorization, private file handling, and static serving.
- `src/db.mjs`: relational schema, indexes, foreign keys, append-only audit constraints, and role/permission catalog.
- `src/auth.mjs`: password hashing, one-time bootstrap, lockout, short-lived opaque sessions, and cookie handling.
- `src/server.mjs` and `src/providers.mjs`: persistent processing queue, provider contracts, and HTTP API. If OCR is not configured, the application routes the document for manual review and records that no provider is available.
- `src/domain.mjs`: application state transitions, role-scoped data access, priorities, and audit helpers.

SQLite is used as a dependency-free local relational database. For a multi-instance government deployment, run behind an approved reverse proxy and replace the local adapter with an approved PostgreSQL service, private object storage, managed secret store, centralized logging, and a separately scaled job worker. The app does not claim that those external services are configured.

## Security and integration notes

- API access requires an authenticated session except for health and first-run/authentication endpoints.
- Server-side permissions and institution scope are enforced for each data route.
- Sessions are stored as token hashes, expire, and can be revoked. Cookies are HttpOnly and SameSite Strict; `Secure` is enabled in production.
- Mutation requests require a same-origin `Origin` header. A production proxy must preserve the external host and HTTPS configuration.
- Uploaded PDF/JPEG/PNG files are size-limited, extension/MIME/magic-byte checked, hashed, versioned, and kept outside the public directory. File downloads use an authenticated route.
- Audit history is append-only at the database layer.
- OCR and verification connectors remain `NOT_CONFIGURED` until a provider URL and secret are supplied. Connector contracts must be reviewed and authorized before use.
- Pramaan Sahayak can use Gemini's `generateContent` API when `AI_ASSISTANT_BASE_URL`, `AI_ASSISTANT_API_KEY`, and `AI_ASSISTANT_MODEL` are configured server-side. The endpoint is restricted to Google's HTTPS Generative Language API. It sends the user's question, recent chat turns, and only the permission-filtered structured Pramaan records needed for the selected query; raw uploaded files are not sent. Before use, the chat UI discloses this transfer. Sahayak validates response citations against retrieved stored facts, logs the external transfer without storing chat text, and falls back to a local record summary if Gemini is unavailable or returns unsupported claims. Never place the key in frontend code or return it through an API.
- Sahayak provides workflow guidance and summaries only. It does not make statutory decisions or determine whether an institution is compliant. Verify current regulatory requirements against official notices and competent authorities.
- The first administrator is created during a one-time bootstrap flow. Restrict network access during initial setup.
- Do not deploy this local SQLite setup for production workloads. Complete security review, operational hardening, provider authorization, and PostgreSQL/object-storage integration first.

## API

All application APIs are versioned under `/api/v1`. Core resources include applications, institutions, documents, findings, source verifications, notifications, integrations, audit events, and reports. The AICTE service integration contract uses a separate service token and is disabled when `AICTE_SERVICE_TOKEN` is not configured.

Every automated output is advisory and evidence-oriented. Pramaan cannot independently approve or reject an institution, declare fraud or forgery, or take adverse regulatory action.

## Sahayak evaluation

Run `npm run test:sahayak` to check structured request understanding, language/status parsing, authorization scope, filtered retrieval, latest stored rule results, multi-topic responses, and deterministic fallback output. Retrieval tests use a temporary SQLite database and remove it afterward; they do not write to the workspace database or call Gemini.
