# Deduplicate AI - Excel Data Deduplication App

Production-ready SaaS-style web application for detecting, reviewing, merging, and exporting duplicate records from Excel and CSV files.

## Stack

- Next.js 15 App Router with strict TypeScript
- TailwindCSS v4 and shadcn/ui
- Zustand in-memory state management
- SheetJS (`xlsx`) and PapaParse
- Fuse.js, Levenshtein, Jaro-Winkler, token similarity, and nickname matching
- Web Workers for heavy duplicate detection
- Recharts analytics
- Vitest unit tests
- Vercel deployment config

## Features

- Drag-and-drop multi-file upload for `.xlsx`, `.xls`, and `.csv`
- MIME, extension, size, and empty-file validation
- Worksheet selector, header auto-detection, malformed row detection, and row previews
- Smart normalization for strings, names, phones, dates, and addresses
- Weighted duplicate scoring:
  - Last Name: 35%
  - First Name: 25%
  - Birthdate: 25%
  - Middle Name: 10%
  - Address: 5%
- Thresholds:
  - 95-100: Exact duplicate
  - 85-94: Highly probable
  - 70-84: Possible duplicate
- Blocking indexes, chunked comparisons, and worker execution for large datasets
- Duplicate review queue with side-by-side comparison, difference highlighting, merge preview, bulk approval, ignore, and mark unique
- Smart merge rules: prefer valid phone, non-empty fields, longest addresses, and latest dated values
- Export cleaned XLSX, clean CSV, duplicate report CSV, and audit trail CSV
- Analytics dashboard with duplicate percentages and confidence distributions
- AI-ready service boundaries for future semantic matching, OCR, OpenAI scoring, and entity resolution APIs

## Architecture

```text
app/                    App Router pages and API health check
components/             Upload, review, dashboard, analytics, shared UI
services/
  parser/               Excel/CSV parsing and worksheet/header handling
  normalization/        Canonical string/name/phone/date/address normalization
  matching/             Similarity algorithms and Fuse index helpers
  dedupe-engine/        Weighted scoring, blocking, clustering, merge logic
  export/               XLSX/CSV/report/audit exports
workers/                Web Worker entry point for duplicate detection
store/                  Zustand in-memory app state
types/                  Shared domain contracts
utils/                  Upload security and CSV safety helpers
tests/                  Unit tests for engines
```

## Algorithms

1. **Normalize** each candidate field using field-specific rules.
2. **Block** rows by high-signal keys such as normalized last name and birthdate to avoid full `O(n^2)` comparisons.
3. **Compare** records inside capped blocks using weighted field scoring.
4. **Classify** candidate pairs by configured thresholds.
5. **Cluster** duplicate pairs with union-find to create reviewable groups.
6. **Merge** approved groups with deterministic value selection and audit logging.

This design prioritizes low false positives while preserving recall through fuzzy name/address scoring and alias-aware header resolution.

## Getting Started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Quality Checks

```bash
npm run lint
npm run test
npm run build
```

## Deployment

The app is Vercel-ready:

```bash
vercel
```

Configuration lives in `vercel.json`. Files are processed in-browser by default and are not permanently stored unless future persistence is explicitly enabled.

## Performance Notes

- Duplicate detection runs in `workers/dedupe.worker.ts`.
- Matching uses blocking indexes and `maxBlockSize` guards for large buckets.
- Comparison loops yield per chunk to keep workers responsive.
- UI previews use virtualization to avoid rendering thousands of DOM nodes.
- Zustand state is intentionally not persisted to local storage to reduce sensitive data exposure.

## Security Notes

- Validates extension, MIME type, size, and non-empty uploads.
- Avoids permanent storage by default.
- Uses React escaping for rendered values.
- Escapes CSV formula prefixes during export.
- Adds Vercel security headers.

## Future AI-Ready Extensions

- Add OpenAI semantic matchers behind `services/matching`.
- Add OCR ingestion before `services/parser`.
- Add server-side entity resolution APIs under `app/api`.
- Add human-in-the-loop feedback to retrain field weights and thresholds.
