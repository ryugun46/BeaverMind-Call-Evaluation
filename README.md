# Call Evaluation System — Persistent AI Evaluation MVP

A high-credibility, evidence-grounded AI Call Quality Assurance evaluation platform designed for reviewing and scoring Kick-off and Coaching conversation transcripts.

## Technology Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS (Calm, light-first analytical theme)
- **Icons**: Lucide React
- **Persistence**: Supabase/Postgres with server-only repository access
- **Evaluation**: Separate OpenRouter worker with structured output validation

---

## Supported Call Types & Rubric Architecture

1. **Kick-off Call**
   - 12 comprehensive onboarding & technical alignment dimensions.
   - Fixed 100-point rubric total.

2. **Coaching Call**
   - 12 coaching & objection handling dimensions.
   - Fixed 100-point full maximum. Diagnostics Review (D2) is weighted at 5 points in `coaching-v2`.
   - **Adaptive Normalization**: An inapplicable dimension is marked N/A and its authored weight is excluded from the raw maximum. D2 N/A produces a 95-point raw maximum, D4 N/A produces 85, and both N/A produce 80; every case is normalized to a standard 100-point scale.
   - D2 weight is never redistributed to D3 or D4.

---

## Project Structure

```text
app/
  layout.tsx                     # Root application shell & navigation
  page.tsx                       # Clean transcript submission
  evaluation/
    [id]/
      page.tsx                   # Dynamic evaluation run status & report
  api/evaluations/              # Server submission and public-token reads
components/
  layout/
    Header.tsx                   # Minimal top brand navigation
    PageContainer.tsx            # Responsive layout wrapper
  submission/
    CallTypeSelector.tsx         # Kick-off vs Coaching selector
    TranscriptInput.tsx          # Monospace transcript editor with live metrics
    SubmissionForm.tsx           # Form validation & run dispatch
  evaluation/
    QueuedState.tsx              # Pipeline queue indicator
    ProcessingState.tsx          # Analytical 3-step progress breakdown
    FailedState.tsx              # Diagnostic error & retry guidance
    ReportHeader.tsx             # Call details, link sharing, & PDF export
  report/
    ScoreSummaryCard.tsx         # Score card (Raw 85 + Normalized 100 handling)
    OneThingCard.tsx             # Highest-leverage coaching recommendation
    RedFlagsCard.tsx             # Compliance & critical alert card
    AppliedCapsSection.tsx       # Applied guardrails & scoring caps
    DimensionAccordion.tsx       # 12-dimension collapsible viewer
    DimensionCard.tsx            # Individual dimension breakdown
    EvidenceList.tsx             # Verbatim speaker quote cards
    EvaluationReport.tsx         # Main completed report assembler
  ui/
    StatusBadge.tsx              # Queued, Processing, Completed, Failed badges
    ScoreBadge.tsx               # Raw & normalized score badges
    PerformanceBandBadge.tsx     # ELITE, STRONG, INCONSISTENT, AT_RISK, FAIL
    SectionCard.tsx              # Clean card surface primitive
    ActionButton.tsx             # Accessible button with states
lib/
  contracts/
    evaluation.ts              # Authoritative Zod schemas and inferred types
  rubrics/
    kickoff.ts                 # Versioned band-based Kick-off definition
    coaching.ts                # Versioned discrete Coaching definition
    performance-bands.ts       # Continuous shared overall bands
  types/
    evaluation.ts              # Compatibility type re-exports only
  fixtures/
    evaluation-fixtures.ts     # Development-only lifecycle fixtures
  server/
    repositories/              # Supabase persistence boundary
    evaluation/                # Provider, prompt, validation, and worker flow
  utils/
    formatters.ts                # Score, date, and band formatting helpers
    cn.ts                        # Tailwind class merge helper
```

Database/RLS documentation lives in `docs/database.md`; the evaluation worker
and HTTP flow are documented in `docs/processing.md`. Production problems and
their resolutions are tracked in `docs/project-issue-log.md`.

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# In a separate terminal, process queued evaluations
npm run worker:evaluations

# Run production build
npm run build
```

Production deployments on Vercel schedule evaluation processing from the
submission route with `waitUntil`. The standalone worker command is intended
for local development or a persistent worker host.
