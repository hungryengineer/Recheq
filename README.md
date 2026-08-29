# 🔍 Recheq

> **Next-Generation, Deterministic Background Verification Platform**

Welcome to the **Recheq** repository! We are rebuilding the background verification industry from the ground up. Say goodbye to weeks of manual processing, easily forged documents, and opaque compliance trails.

Recheq is a B2B platform that allows employers to initiate secure, zero-trust background checks. Candidates upload their documents via secure, purpose-bound links, and our engine automatically extracts data, runs PDF forensics, and calculates a deterministic risk score—all while maintaining an immutable, cryptographically verifiable audit trail.

---

## ✨ Features That Wow

- ⚡ **Lightning Fast Case Management**: Employers can initiate and track hundreds of background checks in a beautiful, real-time dashboard.
- 🛡️ **Zero-Trust Candidate Portal**: Candidates receive single-use, purpose-bound tokens to securely upload their sensitive documents (Payslips, Form 16, etc.) and provide consent.
- 🧠 **Smart Extraction & Forensics**: Automatically extracts printed facts from documents and inspects PDF metadata/font-runs to detect forged or tampered documents.
- 🎯 **Deterministic Rules Engine**: Calculates findings, risk scores, and verdicts using pure, testable functions—guaranteeing no LLM hallucinations in the final decision.
- ⛓️ **Cryptographic Audit Trails**: Every state change is appended to an immutable, hash-chained ledger (`prev_hash | seq | kind | payload`), ensuring absolute compliance and traceability.

## 🏗️ Architecture & Tech Stack

Recheq is built as a high-performance **Turborepo** monorepo, strictly separating the frontend product from the backend domain logic.

- **Frontend (`apps/web`)**: Next.js 14 (App Router), React, TailwindCSS, Lucide Icons.
- **Backend (`services/api`)**: Node.js, Express, strict Zod validation.
- **Database**: Neon (Serverless Postgres), Drizzle ORM.
- **Storage**: Backblaze B2 (S3-compatible) for encrypted, private document storage.
- **Background Jobs**: `pg-boss` for durable, Postgres-backed job queues.

## 🚀 Getting Started Locally

Running Recheq locally is a breeze.

### 1. Environment Setup

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env.local
```

_(Make sure to copy `.env.local` into `apps/web/.env.local` as well!)_

### 2. Install Dependencies

We use `pnpm` for blazing-fast monorepo package management.

```bash
pnpm install
```

### 3. Database & Migrations

Ensure your Neon Postgres URL is set in `.env.local`, then push the schema:

```bash
pnpm run db:push
```

### 4. Start the Engines

Fire up the development server:

```bash
pnpm run dev
```

The web dashboard will be available at `http://localhost:3000` and the API at `http://localhost:4000`.

## 🤝 Contributing

We maintain strict engineering standards. Before opening a PR, ensure you:

1. Preserve the immutable audit chain.
2. Write deterministic rules (no network/DB calls inside the rules engine).
3. Pass all pre-commit checks:
   ```bash
   pnpm run typecheck
   pnpm run lint
   pnpm test
   ```

For detailed architectural guidelines and team workflows, please refer to the [Project Constitution](docs/CONSTITUTION.md).

## 👨‍💻 Core Engineering Team

Recheq.bvg was architected and built by a dedicated team of engineers, with development officially kicking off on **August 14th, 2026**.

| Name                  | Role                                 |
| :-------------------- | :----------------------------------- |
| **Guddu Kumar Yadav** | Developer (Frontend & Core Product)  |
| **Sachin**            | Developer (Backend & Architecture)   |
| **Anshuman**          | AI & ML Ops (Extraction & Forensics) |

---

_Built with ❤️ for a more trustworthy world._
