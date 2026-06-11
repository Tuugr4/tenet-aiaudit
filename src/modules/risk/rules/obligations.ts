import type { Tier } from './types.js';

export interface Obligation {
  id: string;
  article: string;
  title: string;
  description: string;
  how_tenet_helps?: string;
  deadline_note?: string;
}

const HIGH_RISK: Obligation[] = [
  {
    id: 'art9-risk-management',
    article: 'Article 9',
    title: 'Risk management system',
    description: 'Establish, implement and maintain a continuous risk management process across the system lifecycle.',
  },
  {
    id: 'art10-data-governance',
    article: 'Article 10',
    title: 'Data and data governance',
    description: 'Training, validation and testing data must meet quality criteria; document data provenance.',
    how_tenet_helps: 'Record data sources per AI call via the data_sources field of POST /v1/log-ai-call.',
  },
  {
    id: 'art11-technical-documentation',
    article: 'Article 11',
    title: 'Technical documentation',
    description: 'Draw up technical documentation before placing the system on the market and keep it up to date.',
  },
  {
    id: 'art12-record-keeping',
    article: 'Article 12',
    title: 'Record-keeping (automatic logging)',
    description: 'High-risk AI systems must technically allow automatic recording of events over their lifetime.',
    how_tenet_helps: 'POST /v1/log-ai-call provides tamper-evident, hash-chained event logging; GET /v1/export-audit-pack produces auditor-ready evidence.',
  },
  {
    id: 'art13-transparency',
    article: 'Article 13',
    title: 'Transparency and provision of information to deployers',
    description: 'Provide instructions for use enabling deployers to interpret output and use the system appropriately.',
  },
  {
    id: 'art14-human-oversight',
    article: 'Article 14',
    title: 'Human oversight',
    description: 'Design so natural persons can effectively oversee the system, intervene or interrupt.',
    how_tenet_helps: 'Track oversight per decision via the human_oversight and oversight_actor fields; oversight coverage is summarized in every audit pack.',
  },
  {
    id: 'art15-accuracy-robustness',
    article: 'Article 15',
    title: 'Accuracy, robustness and cybersecurity',
    description: 'Achieve appropriate levels of accuracy, robustness and cybersecurity; declare accuracy metrics.',
    how_tenet_helps: 'Log errors per call via the error field to evidence accuracy monitoring.',
  },
  {
    id: 'art17-qms',
    article: 'Article 17',
    title: 'Quality management system',
    description: 'Providers must put a quality management system in place ensuring regulatory compliance.',
  },
  {
    id: 'art43-conformity',
    article: 'Article 43',
    title: 'Conformity assessment',
    description: 'Undergo the relevant conformity assessment procedure before placing on the market.',
  },
  {
    id: 'art49-registration',
    article: 'Article 49',
    title: 'EU database registration',
    description: 'Register the high-risk system in the EU database before placing on the market.',
  },
  {
    id: 'art73-incidents',
    article: 'Article 73',
    title: 'Serious incident reporting',
    description: 'Report serious incidents to market surveillance authorities (within 15 days as a general rule).',
    how_tenet_helps: 'POST /v1/incident-report records incidents with severity, affected users and remediation; serious incidents are auto-flagged for Article 73.',
  },
];

const LIMITED: Obligation[] = [
  {
    id: 'art50-1-disclosure',
    article: 'Article 50(1)',
    title: 'Disclose AI interaction',
    description: 'Inform natural persons that they are interacting with an AI system (unless obvious).',
    deadline_note: 'Transparency obligations apply from 2 August 2026.',
  },
  {
    id: 'art50-2-marking',
    article: 'Article 50(2)',
    title: 'Mark synthetic content',
    description: 'Synthetic audio/image/video/text must be marked as artificially generated in a machine-readable way.',
    deadline_note: 'Transparency obligations apply from 2 August 2026.',
  },
  {
    id: 'art50-5-record',
    article: 'Article 50',
    title: 'Evidence transparency compliance',
    description: 'Keep records demonstrating that required disclosures were made.',
    how_tenet_helps: 'Log each disclosed interaction via POST /v1/log-ai-call (metadata.disclosure) to evidence Article 50 compliance.',
  },
];

const PROHIBITED: Obligation[] = [
  {
    id: 'art5-cease',
    article: 'Article 5',
    title: 'Prohibited practice — do not deploy',
    description: 'This use case matches a prohibited AI practice. Placing on the market, putting into service or use is banned (fines up to €35M or 7% of global turnover).',
  },
];

const MINIMAL: Obligation[] = [
  {
    id: 'voluntary-codes',
    article: 'Article 95',
    title: 'Voluntary codes of conduct',
    description: 'No mandatory obligations; voluntary application of high-risk requirements is encouraged.',
    how_tenet_helps: 'Logging AI calls anyway future-proofs you against reclassification and customer due-diligence requests.',
  },
];

export function obligationsForTier(tier: Tier): Obligation[] {
  switch (tier) {
    case 'prohibited':
      return PROHIBITED;
    case 'high':
      return HIGH_RISK;
    case 'limited':
      return LIMITED;
    case 'minimal':
      return MINIMAL;
  }
}
