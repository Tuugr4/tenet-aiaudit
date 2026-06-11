import type { RiskRule } from './types.js';

/** Article 5 — prohibited AI practices. Any match short-circuits to "prohibited". */
export const article5Rules: RiskRule[] = [
  {
    rule_id: 'art5-1a-subliminal-manipulation',
    tier: 'prohibited',
    article: 'Article 5(1)(a)',
    label: 'Subliminal or purposefully manipulative techniques causing significant harm',
    questionnaire: (q) => q.subliminal_or_manipulative === true,
    keywords: [/sublimin/i, /manipulat\w+ (behaviou?r|users?)/i, /dark pattern/i],
  },
  {
    rule_id: 'art5-1b-exploit-vulnerabilities',
    tier: 'prohibited',
    article: 'Article 5(1)(b)',
    label: 'Exploitation of vulnerabilities (age, disability, social/economic situation)',
    questionnaire: (q) => q.exploits_vulnerable_groups === true,
    keywords: [/exploit\w* (vulnerab|children|elderly|disab)/i],
  },
  {
    rule_id: 'art5-1c-social-scoring',
    tier: 'prohibited',
    article: 'Article 5(1)(c)',
    label: 'Social scoring leading to detrimental or unjustified treatment',
    questionnaire: (q) => q.social_scoring === true,
    keywords: [/social scor/i, /social credit/i, /trustworthiness scor/i],
  },
  {
    rule_id: 'art5-1e-facial-scraping',
    tier: 'prohibited',
    article: 'Article 5(1)(e)',
    label: 'Untargeted scraping of facial images for facial recognition databases',
    questionnaire: (q) => q.untargeted_facial_scraping === true,
    keywords: [/scrap\w+ (facial|face) (image|data)/i, /facial recognition database/i],
  },
  {
    rule_id: 'art5-1f-emotion-workplace-education',
    tier: 'prohibited',
    article: 'Article 5(1)(f)',
    label: 'Emotion recognition in the workplace or education institutions',
    questionnaire: (q) =>
      q.emotion_recognition_workplace_or_education === true ||
      (q.emotion_recognition === true && (q.domain === 'employment' || q.domain === 'education')),
    keywords: [/emotion (recognition|detection).{0,40}(work|employee|school|student)/i],
  },
  {
    rule_id: 'art5-1h-realtime-biometric-id',
    tier: 'prohibited',
    article: 'Article 5(1)(h)',
    label: 'Real-time remote biometric identification in publicly accessible spaces',
    questionnaire: (q) => q.realtime_remote_biometric_id_public === true,
    keywords: [/real.?time.{0,30}biometric identif/i, /live facial recognition.{0,30}public/i],
  },
];
