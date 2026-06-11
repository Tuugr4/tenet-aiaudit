import { Type } from '@sinclair/typebox';
import { RiskTier } from '../ai-calls/ai-calls.schemas.js';

const QuestionnaireSchema = Type.Partial(
  Type.Object({
    domain: Type.Union(
      [
        'employment',
        'education',
        'finance',
        'insurance',
        'healthcare',
        'law_enforcement',
        'migration',
        'justice',
        'critical_infrastructure',
        'customer_service',
        'marketing',
        'other',
      ].map((d) => Type.Literal(d)),
    ),
    is_safety_component: Type.Boolean(),
    processes_biometrics: Type.Boolean(),
    realtime_remote_biometric_id_public: Type.Boolean(),
    emotion_recognition: Type.Boolean(),
    emotion_recognition_workplace_or_education: Type.Boolean(),
    social_scoring: Type.Boolean(),
    subliminal_or_manipulative: Type.Boolean(),
    exploits_vulnerable_groups: Type.Boolean(),
    untargeted_facial_scraping: Type.Boolean(),
    used_for_evaluation_of_persons: Type.Boolean(),
    affects_access_to_essential_services: Type.Boolean(),
    credit_scoring: Type.Boolean(),
    insurance_risk_pricing: Type.Boolean(),
    education_admission_or_scoring: Type.Boolean(),
    recruitment_or_screening: Type.Boolean(),
    employment_decisions: Type.Boolean(),
    interacts_with_humans: Type.Boolean(),
    generates_synthetic_content: Type.Boolean(),
  }),
);

export const RiskClassifyBody = Type.Object({
  system_name: Type.String({ minLength: 1, maxLength: 300 }),
  description: Type.String({ minLength: 1, maxLength: 10_000 }),
  questionnaire: Type.Optional(QuestionnaireSchema),
  persist: Type.Optional(Type.Boolean({ default: true })),
});

const MatchedRuleSchema = Type.Object({
  rule_id: Type.String(),
  tier: Type.String(),
  article: Type.String(),
  annex_ref: Type.Optional(Type.String()),
  label: Type.String(),
  triggered_by: Type.String(),
});

const ObligationSchema = Type.Object({
  id: Type.String(),
  article: Type.String(),
  title: Type.String(),
  description: Type.String(),
  how_tenet_helps: Type.Optional(Type.String()),
  deadline_note: Type.Optional(Type.String()),
});

export const RiskClassifyResponse = Type.Object({
  assessment_id: Type.Union([Type.String(), Type.Null()]),
  tier: RiskTier,
  confidence: Type.Union([Type.Literal('high'), Type.Literal('indicative')]),
  matched_rules: Type.Array(MatchedRuleSchema),
  obligations: Type.Array(ObligationSchema),
  disclaimer: Type.String(),
});

export const ListAssessmentsResponse = Type.Array(
  Type.Object({
    id: Type.String(),
    created_at: Type.String(),
    system_name: Type.String(),
    tier: RiskTier,
    confidence: Type.String(),
    matched_rules: Type.Array(MatchedRuleSchema),
    obligations: Type.Array(ObligationSchema),
  }),
);
