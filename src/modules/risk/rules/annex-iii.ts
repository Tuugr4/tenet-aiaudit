import type { RiskRule } from './types.js';

/** Annex III — high-risk AI systems (Article 6(2)). */
export const annexIiiRules: RiskRule[] = [
  // §1 Biometrics
  {
    rule_id: 'annex3-1-biometric-identification',
    tier: 'high',
    article: 'Article 6(2)',
    annex_ref: 'Annex III §1',
    label: 'Biometric identification, categorisation or emotion recognition systems',
    questionnaire: (q) => q.processes_biometrics === true,
    keywords: [/biometric/i, /face (recognition|matching|verification)/i, /fingerprint/i],
  },
  // §2 Critical infrastructure
  {
    rule_id: 'annex3-2-critical-infrastructure',
    tier: 'high',
    article: 'Article 6(2)',
    annex_ref: 'Annex III §2',
    label: 'Safety component in critical infrastructure (traffic, water, gas, electricity)',
    questionnaire: (q) =>
      q.is_safety_component === true || q.domain === 'critical_infrastructure',
    keywords: [/critical infrastructure/i, /(power|electricity|water|gas) (grid|supply)/i, /traffic (management|control)/i],
  },
  // §3 Education
  {
    rule_id: 'annex3-3-education',
    tier: 'high',
    article: 'Article 6(2)',
    annex_ref: 'Annex III §3',
    label: 'Education: admission, evaluation of learning outcomes, exam proctoring',
    questionnaire: (q) =>
      q.education_admission_or_scoring === true ||
      (q.domain === 'education' && q.used_for_evaluation_of_persons === true),
    keywords: [/(admission|enrol?ment) (decision|screening)/i, /exam (proctoring|scoring|grading)/i, /student (assessment|evaluation|grading)/i],
  },
  // §4 Employment — the HR-tech hook
  {
    rule_id: 'annex3-4a-recruitment-screening',
    tier: 'high',
    article: 'Article 6(2)',
    annex_ref: 'Annex III §4(a)',
    label: 'Recruitment/selection: CV screening, candidate filtering, interview analysis',
    questionnaire: (q) =>
      q.recruitment_or_screening === true ||
      (q.domain === 'employment' && q.used_for_evaluation_of_persons === true),
    keywords: [/(cv|résumé|resume|candidate|applicant) (screening|scoring|ranking|filtering|analysis)/i, /recruit\w+/i, /hiring decision/i],
  },
  {
    rule_id: 'annex3-4b-employment-decisions',
    tier: 'high',
    article: 'Article 6(2)',
    annex_ref: 'Annex III §4(b)',
    label: 'Work decisions: promotion, termination, task allocation, performance monitoring',
    questionnaire: (q) => q.employment_decisions === true,
    keywords: [/(promotion|termination|firing) decision/i, /performance (monitoring|evaluation).{0,30}(employee|worker)/i, /task allocation/i],
  },
  // §5 Essential services — the fintech hook
  {
    rule_id: 'annex3-5b-credit-scoring',
    tier: 'high',
    article: 'Article 6(2)',
    annex_ref: 'Annex III §5(b)',
    label: 'Creditworthiness evaluation / credit scoring of natural persons',
    questionnaire: (q) => q.credit_scoring === true,
    keywords: [/credit (scor|worthiness|risk assess)/i, /loan (approval|decision|eligibility)/i],
  },
  {
    rule_id: 'annex3-5c-insurance-pricing',
    tier: 'high',
    article: 'Article 6(2)',
    annex_ref: 'Annex III §5(c)',
    label: 'Risk assessment and pricing for life and health insurance',
    questionnaire: (q) => q.insurance_risk_pricing === true,
    keywords: [/insurance (pricing|premium|risk assess|underwriting)/i],
  },
  {
    rule_id: 'annex3-5a-essential-services',
    tier: 'high',
    article: 'Article 6(2)',
    annex_ref: 'Annex III §5(a)',
    label: 'Eligibility for essential public services and benefits',
    questionnaire: (q) => q.affects_access_to_essential_services === true,
    keywords: [/(welfare|benefit|social assistance) (eligibility|decision)/i, /essential (public )?services/i],
  },
  // §6 Law enforcement
  {
    rule_id: 'annex3-6-law-enforcement',
    tier: 'high',
    article: 'Article 6(2)',
    annex_ref: 'Annex III §6',
    label: 'Law enforcement: risk assessments, evidence evaluation, profiling',
    questionnaire: (q) => q.domain === 'law_enforcement',
    keywords: [/law enforcement/i, /predictive policing/i, /recidivism/i],
  },
  // §7 Migration
  {
    rule_id: 'annex3-7-migration',
    tier: 'high',
    article: 'Article 6(2)',
    annex_ref: 'Annex III §7',
    label: 'Migration, asylum and border control management',
    questionnaire: (q) => q.domain === 'migration',
    keywords: [/(visa|asylum|immigration|border) (application|assessment|control|decision)/i],
  },
  // §8 Justice & democratic processes
  {
    rule_id: 'annex3-8-justice',
    tier: 'high',
    article: 'Article 6(2)',
    annex_ref: 'Annex III §8',
    label: 'Administration of justice and democratic processes',
    questionnaire: (q) => q.domain === 'justice',
    keywords: [/judicial (decision|research|assistance)/i, /court (ruling|judgment)/i, /sentencing/i],
  },
];
