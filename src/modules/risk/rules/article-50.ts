import type { RiskRule } from './types.js';

/** Article 50 — limited-risk transparency obligations (apply from August 2026). */
export const article50Rules: RiskRule[] = [
  {
    rule_id: 'art50-1-human-interaction',
    tier: 'limited',
    article: 'Article 50(1)',
    label: 'AI system interacting directly with natural persons (chatbots, assistants)',
    questionnaire: (q) => q.interacts_with_humans === true,
    keywords: [/chat.?bot/i, /conversational (ai|agent|assistant)/i, /virtual assistant/i, /customer (service|support) (bot|ai|agent)/i],
  },
  {
    rule_id: 'art50-2-synthetic-content',
    tier: 'limited',
    article: 'Article 50(2)',
    label: 'Generation of synthetic audio, image, video or text content',
    questionnaire: (q) => q.generates_synthetic_content === true,
    keywords: [/generat\w+ (image|video|audio|text|content)/i, /synthetic (media|content)/i, /text.to.(speech|image|video)/i],
  },
  {
    rule_id: 'art50-3-emotion-recognition',
    tier: 'limited',
    article: 'Article 50(3)',
    label: 'Emotion recognition or biometric categorisation (outside prohibited contexts)',
    questionnaire: (q) => q.emotion_recognition === true,
    keywords: [/emotion (recognition|detection|analysis)/i, /sentiment.{0,20}(facial|voice|biometric)/i],
  },
  {
    rule_id: 'art50-4-deepfake',
    tier: 'limited',
    article: 'Article 50(4)',
    label: 'Deep fake content — must be disclosed as artificially generated',
    questionnaire: () => false,
    keywords: [/deep.?fake/i, /face swap/i, /voice clon/i],
  },
];
