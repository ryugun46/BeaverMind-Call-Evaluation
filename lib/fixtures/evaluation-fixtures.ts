/**
 * @file lib/fixtures/evaluation-fixtures.ts
 *
 * Development fixture data representing every lifecycle state of an evaluation run.
 * All fixtures are typed against the authoritative EvaluationRun contract and
 * must pass the EvaluationRunSchema at runtime (validated in contract tests).
 *
 * States covered:
 *   ✓ queued
 *   ✓ processing
 *   ✓ failed (structured EvaluationError)
 *   ✓ completed kickoff — ELITE
 *   ✓ completed kickoff — AT_RISK (with applied scoring rule cap)
 *   ✓ completed coaching — ELITE (all 12 dims active, D4 scored)
 *   ✓ completed coaching — D4 disabled / normalized (STRONG)
 */

import { EvaluationRun } from "@/lib/types/evaluation";

// ─────────────────────────────────────────────────────────────────────────────
// Sample Transcripts (used by submission form for quick testing)
// ─────────────────────────────────────────────────────────────────────────────

export const SAMPLE_KICKOFF_TRANSCRIPT = `Rep (Sarah): Thanks for taking the time to meet today, David. I've reviewed your pre-call intake assessment and technical goals for Acme Corp.
Client (David): Great to meet you, Sarah. We're eager to get this rollout moving before Q3 ends.
Rep (Sarah): Exactly. Today's goal is to align on three things: first, confirming your primary data pipeline requirements; second, locking in the 4-week milestone timeline; and third, confirming our technical points of contact. How does that sound?
Client (David): That covers our priorities. We especially need to ensure the Snowflake sync is tested by week 2.
Rep (Sarah): Understood. Before we dive into the tooling, what is the single biggest business impact your leadership team expects if we hit this launch date flawlessly?
Client (David): If we hit this date, our executive team can decommission our legacy warehouse and save $45k a month in infrastructure spend.
Rep (Sarah): That is a major financial milestone. Let's make sure our 3-phase roadmap directly secures that. In Phase 1 we configure ingest, Phase 2 is validation, and Phase 3 is full production cutover.
Client (David): Excellent. Who handles our emergency support during Phase 2?
Rep (Sarah): You'll have dedicated Slack Connect access directly to our tier-3 solutions engineering team with a guaranteed 15-minute SLA during business hours.
Client (David): Perfect. Let's schedule our Phase 1 kickoff review.
Rep (Sarah): I have Thursday at 10 AM EST open. Let's lock that into our calendars right now.
Client (David): Calendar invite accepted.
Rep (Sarah): Outstanding. To recap: I will email the integration playbook by 4 PM today, you will introduce Elena for SecOps permissions, and we reconvene Thursday at 10 AM.
Client (David): Sounds like a clear plan. Thanks Sarah.`;

export const SAMPLE_COACHING_TRANSCRIPT = `Coach (Marcus): Hi Jordan, welcome back. Today's 1-on-1 is focused on reviewing your pacing through the objection handling phase and setting your Q4 focus targets.
Client (Jordan): Hey Marcus. Yeah, last week felt a bit rocky on the enterprise calls when prospects brought up competitor pricing.
Coach (Marcus): Let's unpack that. In your call with TechFlow, you did a great job acknowledging their budget concern within the first 10 seconds. That established trust right away.
Client (Jordan): Thanks. But after that, I felt like I over-explained our tiered feature list instead of digging into their current ROI losses.
Coach (Marcus): That is a sharp self-observation. When you switched into feature explanation, your talk-to-listen ratio jumped to 78% for that four-minute block. What open question could you have asked instead?
Client (Jordan): I could have asked: "Aside from license cost, how much engineering time are you currently losing per sprint to data reconciliation?"
Coach (Marcus): Exactly. That redirects the conversation from price to business consequence. Let's make that your default framework for tomorrow's call with Apex Partners.
Client (Jordan): I'll write that down right now and keep it on my cheat sheet.
Coach (Marcus): For next week, let's track two metrics: keeping your talk ratio under 45% during objection responses, and using the business consequence redirect on at least three calls.
Client (Jordan): Agreed. I'll send over the recordings on Friday for review.
Coach (Marcus): Let's lock in our next session for next Tuesday at 2 PM.
Client (Jordan): Booked on my calendar. Talk soon Marcus.`;

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

export const FIXTURE_EVALUATIONS: Record<string, EvaluationRun> = {
  "kickoff-elite": {
    id: "eval-ko-9842",
    callType: "kickoff",
    status: "completed",
    createdAt: "2026-08-22T11:15:00Z",
    completedAt: "2026-08-22T11:15:42Z",
    totalScore: 94,
    maxPossible: 100,
    normalizedScore: 94,
    performanceBand: "ELITE",
    brief:
      "Exemplary kick-off call demonstrating structured agenda control, deep business-impact alignment ($45k/mo cost savings), thorough 3-phase program explanation, proactive support SLA clarification, and direct next-call booking.",
    oneThing: {
      title: "Pre-send Phase 2 Diagnostic Intake Form",
      explanation:
        "While stakeholder ownership and calendar booking were executed cleanly, pre-sending the Phase 2 schema mapping template prior to the Thursday review will allow the client's engineering team to pre-fill endpoint credentials.",
      currentScore: 94,
      potentialScore: 98,
      affectedDimensionNumbers: [9],
    },
    redFlags: [],
    appliedRules: [],
    metadata: {
      repName: "Sarah Chen",
      clientName: "David Miller (Acme Corp)",
      callDuration: "28m 14s",
      wordCount: 3420,
    },
    dimensions: [
      {
        dimensionNumber: 1,
        name: "Pre-Call Preparation",
        score: 5,
        maxScore: 5,
        band: "ELITE",
        reasoning:
          "The rep referenced prior intake notes and demonstrated thorough familiarity with Acme Corp's data infrastructure requirements.",
        evidence: [
          {
            speaker: "Rep (Sarah)",
            quote:
              "I've reviewed your pre-call intake assessment and technical goals for Acme Corp.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 2,
        name: "Rapport & Tone",
        score: 8,
        maxScore: 8,
        band: "ELITE",
        reasoning:
          "Warm, highly professional demeanor with active listening and clear vocal pacing throughout.",
        evidence: [
          {
            speaker: "Rep (Sarah)",
            quote: "Thanks for taking the time to meet today, David. I'm looking forward to walking through the onboarding roadmap.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 3,
        name: "Agenda Framing",
        score: 8,
        maxScore: 8,
        band: "ELITE",
        reasoning:
          "Explicitly structured the call around three distinct goals and secured verbal client alignment before proceeding.",
        evidence: [
          {
            speaker: "Rep (Sarah)",
            quote:
              "Today's goal is to align on three things: first, confirming your primary data pipeline requirements; second, locking in the 4-week milestone timeline; and third, confirming our technical points of contact. How does that sound?",
          },
          {
            speaker: "Client (David)",
            quote: "That covers our priorities.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 4,
        name: "Goal Alignment & Deep Why",
        score: 10,
        maxScore: 10,
        band: "ELITE",
        reasoning:
          "Uncovered the core executive driver behind the rollout ($45k/mo cost savings) and anchored project milestones to this metric.",
        evidence: [
          {
            speaker: "Rep (Sarah)",
            quote:
              "Before we dive into the tooling, what is the single biggest business impact your leadership team expects if we hit this launch date flawlessly?",
          },
          {
            speaker: "Client (David)",
            quote:
              "If we hit this date, our executive team can decommission our legacy warehouse and save $45k a month in infrastructure spend.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 5,
        name: "Program Explanation (3 Phases)",
        score: 10,
        maxScore: 10,
        band: "ELITE",
        reasoning:
          "Clearly delineated the 3-phase journey (Ingest, Validation, Cutover) so the client has full architectural visibility.",
        evidence: [
          {
            speaker: "Rep (Sarah)",
            quote:
              "In Phase 1 we configure ingest, Phase 2 is validation, and Phase 3 is full production cutover.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 6,
        name: "Journey & Expectation Setting",
        score: 9,
        maxScore: 10,
        band: "STRONG",
        reasoning:
          "Defined realistic timelines for Snowflake synchronization checks during week 2.",
        evidence: [
          {
            speaker: "Client (David)",
            quote: "We especially need to ensure the Snowflake sync is tested by week 2.",
          },
          {
            speaker: "Rep (Sarah)",
            quote: "Understood. We'll set a hard benchmark at 2.5 seconds during stage testing in week 2.",
          },
        ],
        quickFix: "Provide a written milestone chart attached to the session summary.",
      },
      {
        dimensionNumber: 7,
        name: "Support System Clarity",
        score: 8,
        maxScore: 8,
        band: "ELITE",
        reasoning:
          "Outlined exact support escalation paths including dedicated Slack Connect channel and 15-minute business SLA.",
        evidence: [
          {
            speaker: "Rep (Sarah)",
            quote:
              "You'll have dedicated Slack Connect access directly to our tier-3 solutions engineering team with a guaranteed 15-minute SLA during business hours.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 8,
        name: "Coaching Intelligence Questions",
        score: 9,
        maxScore: 10,
        band: "STRONG",
        reasoning:
          "Used targeted inquiries to assess data architecture and identify potential SecOps bottlenecks early.",
        evidence: [
          {
            speaker: "Rep (Sarah)",
            quote: "In terms of stakeholders, who on your side will own the IAM permission provisioning?",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 9,
        name: "Next Steps & Diagnostics",
        score: 9,
        maxScore: 10,
        band: "STRONG",
        reasoning:
          "Clearly assigned immediate deliverables to both parties with distinct 4 PM timeline targets.",
        evidence: [
          {
            speaker: "Rep (Sarah)",
            quote:
              "I will email the integration playbook by 4 PM today, you will introduce Elena for SecOps permissions, and we reconvene Thursday at 10 AM.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 10,
        name: "Booking Next Call",
        score: 8,
        maxScore: 8,
        band: "ELITE",
        reasoning:
          "Locked the follow-up meeting directly into the calendar before concluding the call.",
        evidence: [
          {
            speaker: "Rep (Sarah)",
            quote: "I have Thursday at 10 AM EST open. Let's lock that into our calendars right now.",
          },
          {
            speaker: "Client (David)",
            quote: "Calendar invite accepted.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 11,
        name: "Close, Recap & Confidence",
        score: 8,
        maxScore: 8,
        band: "ELITE",
        reasoning:
          "Comprehensive closing recap that reinforced client confidence and mutual accountability.",
        evidence: [
          {
            speaker: "Client (David)",
            quote: "Sounds like a clear plan. Thanks Sarah.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 12,
        name: "Post-Call Execution",
        score: 5,
        maxScore: 5,
        band: "ELITE",
        reasoning:
          "Immediate delivery of integration playbook and automated Slack invite triggers within promised window.",
        evidence: [
          {
            speaker: "Rep (Sarah)",
            quote: "To recap: I will email the integration playbook by 4 PM today.",
          },
        ],
        quickFix: null,
      },
    ],
  },

  "coaching-d4-disabled": {
    id: "eval-co-4491",
    callType: "coaching",
    status: "completed",
    createdAt: "2026-08-22T14:30:00Z",
    completedAt: "2026-08-22T14:30:38Z",
    totalScore: 71,
    maxPossible: 85,
    normalizedScore: 84,
    performanceBand: "STRONG",
    brief:
      "Strategic coaching session addressing objection redirection frameworks and talk-to-listen ratios. Dimension 4 (Movement Coaching Quality) was evaluated as N/A due to the non-physical dialogue focus. The session exhibited strong diagnostic exploration and agreed accountability anchors.",
    oneThing: {
      title: "Integrate Real-Time Roleplay Simulation",
      explanation:
        "While the consequence-redirect framework was clearly formulated and noted, executing a 2-minute live simulated objection drill during the call would cement conversational agility before the client's upcoming enterprise pitch.",
      currentScore: 71,
      potentialScore: 79,
      affectedDimensionNumbers: [5, 8],
    },
    redFlags: [],
    appliedRules: [
      {
        ruleId: "DIM_APPLICABILITY_NORMALIZATION",
        label: "Dimension 4 Non-Applicability Normalization",
        description:
          "Movement Coaching Quality was not applicable on this call, so the rubric was scored out of 85 and normalized to a 100-point scale.",
        scope: "applicability",
        affectedDimensionNumber: 4,
        effect: "Raw score of 71 / 85 normalized to 84 / 100 (STRONG band).",
        nonRecoverable: false,
      },
    ],
    metadata: {
      repName: "Marcus Vance (Coach)",
      clientName: "Jordan Hayes (Account Executive)",
      callDuration: "31m 05s",
      wordCount: 2890,
    },
    dimensions: [
      {
        dimensionNumber: 1,
        name: "Check-In & Connection",
        score: 7,
        maxScore: 8,
        band: "STRONG",
        reasoning:
          "Established supportive conversational rapport and immediately grounded the session in last week's enterprise challenges.",
        evidence: [
          {
            speaker: "Coach (Marcus)",
            quote:
              "Hi Jordan, welcome back. Today's 1-on-1 is focused on reviewing your pacing through the objection handling phase and setting your Q4 focus targets.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 2,
        name: "Diagnostics Review",
        score: 8,
        maxScore: 8,
        band: "ELITE",
        reasoning:
          "Utilized precise conversational data metrics (78% talk-to-listen spike during objection phase) to diagnose the root problem.",
        evidence: [
          {
            speaker: "Coach (Marcus)",
            quote:
              "When you switched into feature explanation, your talk-to-listen ratio jumped to 78% for that four-minute block.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 3,
        name: "Program Focus + Vision",
        score: 7,
        maxScore: 8,
        band: "STRONG",
        reasoning:
          "Connected weekly behavioral adjustments directly to long-term Q4 target attainment.",
        evidence: [
          {
            speaker: "Coach (Marcus)",
            quote: "Today's 1-on-1 is focused on reviewing your pacing through the objection handling phase and setting your Q4 focus targets.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 4,
        name: "Movement Coaching Quality",
        score: null,
        maxScore: 15,
        band: null,
        disabled: true,
        disabledReason:
          "Movement Coaching Quality was not applicable on this call, so the rubric was scored out of 85 and normalized to a 100-point scale.",
        reasoning:
          "Session focused exclusively on objection handling dialogue and sales methodology; no physical movement coaching conducted.",
        evidence: [],
        quickFix: null,
      },
      {
        dimensionNumber: 5,
        name: "Adjustments & Strategy",
        score: 8,
        maxScore: 10,
        band: "STRONG",
        reasoning:
          "Co-developed the business-consequence redirect question to replace verbose feature defense.",
        evidence: [
          {
            speaker: "Client (Jordan)",
            quote:
              "I could have asked: 'Aside from license cost, how much engineering time are you currently losing per sprint to data reconciliation?'",
          },
          {
            speaker: "Coach (Marcus)",
            quote:
              "Exactly. That redirects the conversation from price to business consequence.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 6,
        name: "Action Steps & Accountability",
        score: 9,
        maxScore: 10,
        band: "STRONG",
        reasoning:
          "Set measurable weekly commitments: maintaining talk ratio under 45% on objections and applying redirect on 3 calls.",
        evidence: [
          {
            speaker: "Coach (Marcus)",
            quote:
              "For next week, let's track two metrics: keeping your talk ratio under 45% during objection responses, and using the business consequence redirect on at least three calls.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 7,
        name: "Accountability Anchor",
        score: 7,
        maxScore: 8,
        band: "STRONG",
        reasoning:
          "Client anchored commitment by logging action items on active cheat sheet and scheduling Friday recording submissions.",
        evidence: [
          {
            speaker: "Client (Jordan)",
            quote: "I'll write that down right now and keep it on my cheat sheet.",
          },
          {
            speaker: "Client (Jordan)",
            quote: "Agreed. I'll send over the recordings on Friday for review.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 8,
        name: "Struggle Handling",
        score: 8,
        maxScore: 10,
        band: "STRONG",
        reasoning:
          "Constructively validated client's feelings of feeling 'rocky' without allowing hesitation to undermine forward action.",
        evidence: [
          {
            speaker: "Client (Jordan)",
            quote: "Yeah, last week felt a bit rocky on the enterprise calls when prospects brought up competitor pricing.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 9,
        name: "Close Quality",
        score: 7,
        maxScore: 8,
        band: "STRONG",
        reasoning:
          "Summarized agreed behavior shifts concisely and verified client buy-in.",
        evidence: [
          {
            speaker: "Coach (Marcus)",
            quote: "Let's make that your default framework for tomorrow's call with Apex Partners.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 10,
        name: "Next Call Booking",
        score: 5,
        maxScore: 5,
        band: "ELITE",
        reasoning:
          "Confirmed exact date and time for the follow-up 1-on-1 prior to closing.",
        evidence: [
          {
            speaker: "Coach (Marcus)",
            quote: "Let's lock in our next session for next Tuesday at 2 PM.",
          },
          {
            speaker: "Client (Jordan)",
            quote: "Booked on my calendar. Talk soon Marcus.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 11,
        name: "Continuity & Follow-Up Clarity",
        score: 5,
        maxScore: 5,
        band: "ELITE",
        reasoning:
          "Established clear asynchronous cadence (Friday recording delivery) prior to Tuesday call.",
        evidence: [
          {
            speaker: "Client (Jordan)",
            quote: "I'll send over the recordings on Friday for review.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 12,
        name: "Structure & Time Management",
        score: 5,
        maxScore: 5,
        band: "ELITE",
        reasoning:
          "Kept session crisp, focused on highest-leverage skills, and concluded promptly within allocated 30-minute block.",
        evidence: [
          {
            speaker: "Coach (Marcus)",
            quote: "Let's lock in our next session for next Tuesday at 2 PM.",
          },
        ],
        quickFix: null,
      },
    ],
  },

  "kickoff-at-risk": {
    id: "eval-ko-1082",
    callType: "kickoff",
    status: "completed",
    createdAt: "2026-08-22T09:20:00Z",
    completedAt: "2026-08-22T09:21:05Z",
    totalScore: 61,
    maxPossible: 100,
    normalizedScore: 61,
    // ✓ Fixed: was "AT RISK" (with space) — canonical form is "AT_RISK"
    performanceBand: "AT_RISK",
    brief:
      "The kick-off call suffered from inadequate discovery regarding compliance constraints and failed to establish concrete next steps or milestone sign-offs. An explicit score cap was applied due to unaddressed HIPAA audit requirements.",
    oneThing: {
      title: "Establish Explicit Next Step Ownership & Booking",
      explanation:
        "The call concluded without scheduling the follow-up technical architecture review or assigning owners to compliance tasks, leaving the implementation timeline open-ended and at risk of stalling.",
      currentScore: 61,
      potentialScore: 78,
      affectedDimensionNumbers: [9, 10],
    },
    // ✓ Fixed: was string[] — now RedFlagItem[]
    redFlags: [
      {
        title: "No compliance stakeholder agreement established",
        explanation:
          "No technical stakeholder agreement was established for compliance sign-off, leaving HIPAA regulatory obligations unassigned.",
      },
      {
        title: "Premature go-live timeline commitment",
        explanation:
          "Rep committed to a 2-week go-live timeline without validating third-party API rate limits or security review completion.",
        severity: "high",
      },
      {
        title: "Follow-up checkpoint not booked",
        explanation:
          "The rep failed to lock in the next follow-up checkpoint call before ending the session, leaving continuity undefined.",
      },
    ],
    appliedRules: [
      {
        ruleId: "COMPLIANCE_OMISSION_CAP",
        label: "Compliance Omission Guardrail",
        description:
          "Client mentioned HIPAA regulated data in discovery, but rep did not initiate Business Associate Agreement (BAA) protocol.",
        scope: "total",
        effect: "Overall score capped at maximum 65 points (AT_RISK band).",
        nonRecoverable: true,
      },
    ],
    metadata: {
      repName: "Alex Rivera",
      clientName: "Rachel Sterling (MedTech Solutions)",
      callDuration: "19m 40s",
      wordCount: 1950,
    },
    dimensions: [
      {
        dimensionNumber: 1,
        name: "Pre-Call Preparation",
        score: 2,
        maxScore: 5,
        band: "FAIL",
        reasoning:
          "Rep appeared unfamiliar with MedTech's healthcare context and had not reviewed the intake documentation prior to the call.",
        evidence: [],
        quickFix: "Review customer compliance intake sheet and tech stack notes prior to call opening.",
      },
      {
        dimensionNumber: 2,
        name: "Rapport & Tone",
        score: 6,
        maxScore: 8,
        band: "STRONG",
        reasoning: "Pleasant conversational tone, though lacked targeted context regarding client business priorities.",
        evidence: [
          {
            speaker: "Rep (Alex)",
            quote: "Hope you're having a good week so far.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 3,
        name: "Agenda Framing",
        score: 4,
        maxScore: 8,
        band: "INCONSISTENT",
        reasoning:
          "Rep provided an informal opening without detailing specific discussion milestones or verifying client expectations.",
        evidence: [
          {
            speaker: "Rep (Alex)",
            quote: "Hey Rachel, glad to connect. Let's just talk about how the rollout is going to work.",
          },
        ],
        quickFix: "Structure opening with a strict 3-point agenda and seek verbal confirmation.",
      },
      {
        dimensionNumber: 4,
        name: "Goal Alignment & Deep Why",
        score: 5,
        maxScore: 10,
        band: "INCONSISTENT",
        reasoning:
          "Client raised healthcare data regulations, but rep bypassed deep questioning on compliance requirements and business impact.",
        evidence: [
          {
            speaker: "Client (Rachel)",
            quote: "We handle patient health records, so HIPAA security is our primary audit priority.",
          },
          {
            speaker: "Rep (Alex)",
            quote: "Right, our platform is super secure, we can handle that no problem.",
          },
        ],
        quickFix: "Drill into regulatory specifics: encryption in transit/at rest, BAA execution, and SOC2 audit reports.",
      },
      {
        dimensionNumber: 5,
        name: "Program Explanation (3 Phases)",
        score: 5,
        maxScore: 10,
        band: "INCONSISTENT",
        reasoning:
          "Gave a high-level summary but failed to explain Phase 2 staging tests or Phase 3 cutover criteria.",
        evidence: [
          {
            speaker: "Rep (Alex)",
            quote: "We basically set you up, test a little bit, and then you're good to go.",
          },
        ],
        quickFix: "Detail the 3 distinct phases (Ingest, Validation, Production Cutover) with concrete criteria.",
      },
      {
        dimensionNumber: 6,
        name: "Journey & Expectation Setting",
        score: 5,
        maxScore: 10,
        band: "INCONSISTENT",
        reasoning: "Promised a two-week go-live without technical validation of client API rate limits.",
        evidence: [
          {
            speaker: "Rep (Alex)",
            quote: "We can easily get you live in two weeks.",
          },
        ],
        quickFix: "Condition timeline commitments on security review completion and staging test sign-offs.",
      },
      {
        dimensionNumber: 7,
        name: "Support System Clarity",
        score: 4,
        maxScore: 8,
        band: "INCONSISTENT",
        reasoning:
          "Did not outline escalation paths or SLA tiers for emergency production incidents.",
        evidence: [],
        quickFix: "Specify the exact support channel (Slack Connect/Email) and SLA response times.",
      },
      {
        dimensionNumber: 8,
        name: "Coaching Intelligence Questions",
        score: 5,
        maxScore: 10,
        band: "INCONSISTENT",
        reasoning:
          "Failed to ask diagnostic questions regarding who manages InfoSec or firewall whitelist rules.",
        evidence: [
          {
            speaker: "Client (Rachel)",
            quote: "Our IT director will probably need to review the network egress.",
          },
        ],
        quickFix: "Ask: 'Who is the direct InfoSec contact responsible for approving firewall exceptions?'",
      },
      {
        dimensionNumber: 9,
        name: "Next Steps & Diagnostics",
        score: 4,
        maxScore: 10,
        band: "AT_RISK",
        reasoning: "No concrete next steps or task deliverables assigned with deadlines.",
        evidence: [
          {
            speaker: "Rep (Alex)",
            quote: "Cool, I'll follow up with some stuff over email and we can talk sometime next week.",
          },
        ],
        quickFix: "List explicit next step deliverables with assigned owners and due dates.",
      },
      {
        dimensionNumber: 10,
        name: "Booking Next Call",
        score: 2,
        maxScore: 8,
        band: "FAIL",
        reasoning:
          "Did not open calendar to book the next milestone session during the call.",
        evidence: [],
        quickFix: "Never end a kickoff call without securing the next milestone meeting on the calendar.",
      },
      {
        dimensionNumber: 11,
        name: "Close, Recap & Confidence",
        score: 3,
        maxScore: 8,
        band: "AT_RISK",
        reasoning:
          "Ending was rushed without verifying whether client felt confident in the roadmap.",
        evidence: [
          {
            speaker: "Rep (Alex)",
            quote: "Thanks for your time Rachel, looking forward to working together.",
          },
        ],
        quickFix: "Recap action items and explicitly ask: 'On a scale of 1-10, how confident do you feel about this plan?'",
      },
      {
        dimensionNumber: 12,
        name: "Post-Call Execution",
        score: 3,
        maxScore: 5,
        band: "INCONSISTENT",
        reasoning:
          "Delayed follow-up notes by 48 hours without meeting invite attached.",
        evidence: [],
        quickFix: "Send recap email and calendar invitation within 2 hours of call conclusion.",
      },
    ],
  },

  "completed-coaching-full": {
    id: "eval-co-8821",
    callType: "coaching",
    status: "completed",
    createdAt: "2026-08-22T15:00:00Z",
    completedAt: "2026-08-22T15:00:45Z",
    totalScore: 92,
    maxPossible: 100,
    normalizedScore: 92,
    performanceBand: "ELITE",
    brief:
      "Exceptional comprehensive coaching session incorporating real-time movement technique instruction, tactical objection reframing, structured habit accountability, and calendar booking.",
    oneThing: {
      title: "Introduce Micro-Rep Drills Before Complex Sets",
      explanation:
        "While movement technique correction on the hinge pattern was clear and precise, demonstrating a 3-second isometric pause drill prior to loaded repetitions would reinforce spinal alignment under fatigue.",
      currentScore: 92,
      potentialScore: 97,
      affectedDimensionNumbers: [4],
    },
    redFlags: [],
    appliedRules: [],
    metadata: {
      repName: "Coach Marcus",
      clientName: "Jordan Hayes",
      callDuration: "42m 18s",
      wordCount: 4580,
    },
    dimensions: [
      {
        dimensionNumber: 1,
        name: "Check-In & Connection",
        score: 8,
        maxScore: 8,
        band: "ELITE",
        reasoning: "Established explicit session focus on movement mechanics and objection drills.",
        evidence: [
          {
            speaker: "Coach (Marcus)",
            quote: "Today we will break down both your barbell hinge mechanics and enterprise objection responses.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 2,
        name: "Diagnostics Review",
        score: 8,
        maxScore: 8,
        band: "ELITE",
        reasoning: "Thoroughly verified recovery tracking and practice logs from prior week.",
        evidence: [
          {
            speaker: "Client (Jordan)",
            quote: "I logged 4 sessions and hit all mobility homework targets.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 3,
        name: "Program Focus + Vision",
        score: 8,
        maxScore: 8,
        band: "ELITE",
        reasoning: "Connected daily practice to long-term strength and sales leadership targets.",
        evidence: [
          {
            speaker: "Coach (Marcus)",
            quote: "Mastering this pattern protects your lower back so you maintain energy across full travel sprints.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 4,
        name: "Movement Coaching Quality",
        score: 14,
        maxScore: 15,
        band: "ELITE",
        disabled: false,
        reasoning: "Delivered precise real-time cueing on hip hinge mechanics and scapular retraction.",
        evidence: [
          {
            speaker: "Coach (Marcus)",
            quote: "Maintain ribcage-to-pelvis canister alignment before initiating the eccentric descent.",
          },
        ],
        quickFix: "Implement a 3-second isometric pause at mid-shin depth.",
      },
      {
        dimensionNumber: 5,
        name: "Adjustments & Strategy",
        score: 9,
        maxScore: 10,
        band: "ELITE",
        reasoning: "Adjusted foot stance width by 2 inches and modified bar path cues.",
        evidence: [
          {
            speaker: "Coach (Marcus)",
            quote: "Widen your stance by two inches and flare toes 15 degrees outward.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 6,
        name: "Action Steps & Accountability",
        score: 9,
        maxScore: 10,
        band: "STRONG",
        reasoning: "Collaboratively set warmup progressions and load constraints for next block.",
        evidence: [
          {
            speaker: "Client (Jordan)",
            quote: "Let's cap weight at 80% until the hinge tempo feels completely natural.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 7,
        name: "Accountability Anchor",
        score: 8,
        maxScore: 8,
        band: "ELITE",
        reasoning: "Secured high commitment to video check-ins before adding loading.",
        evidence: [
          {
            speaker: "Client (Jordan)",
            quote: "I'll upload form check videos on Wednesday before proceeding.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 8,
        name: "Struggle Handling",
        score: 9,
        maxScore: 10,
        band: "ELITE",
        reasoning: "Pinpointed pelvic tilt shift as the root cause of lumbar fatigue during deep hinge.",
        evidence: [
          {
            speaker: "Coach (Marcus)",
            quote: "Notice how your pelvis rotates anteriorly at the 60-degree inflection mark.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 9,
        name: "Close Quality",
        score: 8,
        maxScore: 8,
        band: "ELITE",
        reasoning: "Client recited the 3 key movement cues back accurately.",
        evidence: [
          {
            speaker: "Client (Jordan)",
            quote: "Set feet, brace canister, push hips back without dropping chest.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 10,
        name: "Next Call Booking",
        score: 5,
        maxScore: 5,
        band: "ELITE",
        reasoning: "Locked next coaching session directly in the calendar.",
        evidence: [
          {
            speaker: "Coach (Marcus)",
            quote: "Let's book our next form review for next Tuesday at 2 PM.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 11,
        name: "Continuity & Follow-Up Clarity",
        score: 5,
        maxScore: 5,
        band: "ELITE",
        reasoning: "Assigned specific video submission dates ahead of next live call.",
        evidence: [
          {
            speaker: "Client (Jordan)",
            quote: "I'll upload form check videos on Wednesday before proceeding.",
          },
        ],
        quickFix: null,
      },
      {
        dimensionNumber: 12,
        name: "Structure & Time Management",
        score: 5,
        maxScore: 5,
        band: "ELITE",
        reasoning: "Completed both movement and dialogue modules efficiently within scheduled time.",
        evidence: [
          {
            speaker: "Coach (Marcus)",
            quote: "Right on time. Looking forward to your Wednesday check-in.",
          },
        ],
        quickFix: null,
      },
    ],
  },

  "processing-coaching": {
    id: "eval-proc-7712",
    callType: "coaching",
    status: "processing",
    createdAt: "2026-08-22T17:58:10Z",
    completedAt: null,
    metadata: {
      repName: "Marcus Vance",
      clientName: "Jordan Hayes",
      callDuration: "31m 05s",
      wordCount: 3120,
    },
  },

  "queued-kickoff": {
    id: "eval-queue-3301",
    callType: "kickoff",
    status: "queued",
    createdAt: "2026-08-22T18:02:45Z",
    completedAt: null,
    metadata: {
      repName: "Sarah Chen",
      clientName: "David Miller (Acme Corp)",
      callDuration: "28m 14s",
      wordCount: 3420,
    },
  },

  "failed-kickoff": {
    id: "eval-fail-9011",
    callType: "kickoff",
    status: "failed",
    createdAt: "2026-08-22T16:12:00Z",
    completedAt: "2026-08-22T16:12:15Z",
    // ✓ Fixed: was string — now structured EvaluationError
    error: {
      code: "VALIDATION_ERROR",
      message:
        "Transcript parsing error: The submitted text contains fewer than 150 words and lacks speaker turn delineations (e.g., 'Speaker: ...'). A minimum transcript length of 300 words with attributed dialogue turns is required for valid rubric evaluation.",
      details: "word_count=84; speaker_turns_detected=0",
    },
    metadata: {
      wordCount: 84,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Alias Map
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_ALIASES: Record<string, string> = {
  // Queued state
  "demo-queued": "queued-kickoff",
  "queued-kickoff": "queued-kickoff",
  "queued-eval": "queued-kickoff",
  "queued": "queued-kickoff",

  // Processing state
  "demo-processing": "processing-coaching",
  "processing-coaching": "processing-coaching",
  "processing-eval": "processing-coaching",
  "processing": "processing-coaching",

  // Failed state
  "demo-failed": "failed-kickoff",
  "failed-kickoff": "failed-kickoff",
  "failed-eval": "failed-kickoff",
  "failed": "failed-kickoff",

  // Completed Kick-off
  "demo-completed-kickoff": "kickoff-elite",
  "completed-kickoff": "kickoff-elite",
  "kickoff-elite": "kickoff-elite",
  "kickoff": "kickoff-elite",
  "kickoff-at-risk": "kickoff-at-risk",

  // Completed Coaching (full 12 dimensions)
  "demo-completed-coaching": "completed-coaching-full",
  "completed-coaching": "completed-coaching-full",
  "coaching-full": "completed-coaching-full",

  // Completed Coaching (D4 disabled / normalized)
  "demo-coaching-d4-disabled": "coaching-d4-disabled",
  "coaching-d4-disabled": "coaching-d4-disabled",
  "coaching": "coaching-d4-disabled",
};

export function getEvaluationById(id: string): EvaluationRun | null {
  if (!id) return null;

  const normalizedId = id.trim();

  // 1. Direct fixture key match
  if (FIXTURE_EVALUATIONS[normalizedId]) {
    return FIXTURE_EVALUATIONS[normalizedId];
  }

  // 2. Alias match
  const aliasTarget = FIXTURE_ALIASES[normalizedId.toLowerCase()];
  if (aliasTarget && FIXTURE_EVALUATIONS[aliasTarget]) {
    return {
      ...FIXTURE_EVALUATIONS[aliasTarget],
      id: normalizedId.startsWith("demo-") || normalizedId.startsWith("eval-")
        ? normalizedId
        : FIXTURE_EVALUATIONS[aliasTarget].id,
    };
  }

  // 3. Dynamic prefixed ID pattern matching for realistic evaluation URLs
  const lower = normalizedId.toLowerCase();
  if (lower.startsWith("eval-queue-") || lower.includes("queued")) {
    return { ...FIXTURE_EVALUATIONS["queued-kickoff"], id: normalizedId };
  }
  if (lower.startsWith("eval-proc-") || lower.includes("proc")) {
    return { ...FIXTURE_EVALUATIONS["processing-coaching"], id: normalizedId };
  }
  if (lower.startsWith("eval-fail-") || lower.includes("fail")) {
    return { ...FIXTURE_EVALUATIONS["failed-kickoff"], id: normalizedId };
  }
  if (lower.startsWith("eval-ko-") || lower.includes("kickoff")) {
    return { ...FIXTURE_EVALUATIONS["kickoff-elite"], id: normalizedId };
  }
  if (lower.startsWith("eval-co-") || lower.includes("coach")) {
    return { ...FIXTURE_EVALUATIONS["coaching-d4-disabled"], id: normalizedId };
  }

  return null;
}
