export interface Questionnaire {
  domain?:
    | 'employment'
    | 'education'
    | 'finance'
    | 'insurance'
    | 'healthcare'
    | 'law_enforcement'
    | 'migration'
    | 'justice'
    | 'critical_infrastructure'
    | 'customer_service'
    | 'marketing'
    | 'other';
  is_safety_component?: boolean;
  processes_biometrics?: boolean;
  realtime_remote_biometric_id_public?: boolean;
  emotion_recognition?: boolean;
  emotion_recognition_workplace_or_education?: boolean;
  social_scoring?: boolean;
  subliminal_or_manipulative?: boolean;
  exploits_vulnerable_groups?: boolean;
  untargeted_facial_scraping?: boolean;
  used_for_evaluation_of_persons?: boolean;
  affects_access_to_essential_services?: boolean;
  credit_scoring?: boolean;
  insurance_risk_pricing?: boolean;
  education_admission_or_scoring?: boolean;
  recruitment_or_screening?: boolean;
  employment_decisions?: boolean;
  interacts_with_humans?: boolean;
  generates_synthetic_content?: boolean;
}

export type Tier = 'prohibited' | 'high' | 'limited' | 'minimal';

export interface RiskRule {
  rule_id: string;
  tier: Exclude<Tier, 'minimal'>;
  article: string;
  annex_ref?: string;
  label: string;
  questionnaire: (q: Questionnaire) => boolean;
  keywords: RegExp[];
}

export interface MatchedRule {
  rule_id: string;
  tier: Tier;
  article: string;
  annex_ref?: string;
  label: string;
  triggered_by: 'questionnaire' | 'keywords';
}
