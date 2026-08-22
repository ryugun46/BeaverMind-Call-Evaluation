# Call Evaluation System — Frontend QA Core

A high-credibility, evidence-grounded AI Call Quality Assurance evaluation platform designed for reviewing and scoring Kick-off and Coaching conversation transcripts.

## Technology Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS (Calm, light-first analytical theme)
- **Icons**: Lucide React
- **Architecture**: Domain-driven types with isolated fixtures

---

## Supported Call Types & Rubric Architecture

1. **Kick-off Call**
   - 12 comprehensive onboarding & technical alignment dimensions.
   - Fixed 100-point rubric total.

2. **Coaching Call**
   - 12 coaching & objection handling dimensions.
   - **Adaptive Normalization**: When movement/physical coaching is not present, **Dimension 4 is marked N/A** (15 points excluded). The raw score out of 85 is displayed alongside the dynamically normalized score on a standard 100-point scale.

> **Source clarification required:** the authored Coaching dimension maxima add
> to 105 even though the rubric declares 100 (and 85 when D4 is inactive).
> Diagnostics D2 redistribution is also underspecified. Both conflicts are
> preserved in `lib/rubrics/coaching.ts`; no scoring algorithm is guessed.

---

## Project Structure

```text
app/
  layout.tsx                     # Root application shell & navigation
  page.tsx                       # Clean transcript submission
  evaluation/
    [id]/
      page.tsx                   # Dynamic evaluation run status & report
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
    evaluation-fixtures.ts     # Zod-parsed, rubric-derived lifecycle fixtures
  utils/
    formatters.ts                # Score, date, and band formatting helpers
    cn.ts                        # Tailwind class merge helper
```

Database migration and RLS documentation live in `supabase/` and
`docs/database.md`.

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run production build
npm run build
```
