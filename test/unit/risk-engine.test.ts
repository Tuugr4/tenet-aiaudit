import { describe, expect, it } from 'vitest';
import { classify } from '../../src/modules/risk/risk.service.js';

describe('risk classification engine', () => {
  it('classifies CV screening as high risk via questionnaire (HR tech)', () => {
    const result = classify({
      system_name: 'TalentMatch',
      description: 'Ranks applicants for open positions.',
      questionnaire: { domain: 'employment', recruitment_or_screening: true },
    });
    expect(result.tier).toBe('high');
    expect(result.confidence).toBe('high');
    expect(result.matched_rules.map((m) => m.rule_id)).toContain('annex3-4a-recruitment-screening');
    expect(result.obligations.map((o) => o.id)).toContain('art12-record-keeping');
  });

  it('classifies credit scoring as high risk via keywords (fintech)', () => {
    const result = classify({
      system_name: 'LoanBot',
      description: 'Uses an LLM for credit scoring and loan approval recommendations.',
    });
    expect(result.tier).toBe('high');
    expect(result.confidence).toBe('indicative');
    expect(result.matched_rules.some((m) => m.rule_id === 'annex3-5b-credit-scoring')).toBe(true);
  });

  it('prohibited beats high: emotion recognition at the workplace', () => {
    const result = classify({
      system_name: 'MoodWatch',
      description: 'Monitors employees.',
      questionnaire: {
        domain: 'employment',
        emotion_recognition: true,
        used_for_evaluation_of_persons: true,
      },
    });
    expect(result.tier).toBe('prohibited');
    expect(result.matched_rules.some((m) => m.rule_id === 'art5-1f-emotion-workplace-education')).toBe(true);
    expect(result.obligations[0]!.id).toBe('art5-cease');
  });

  it('classifies a customer service chatbot as limited risk', () => {
    const result = classify({
      system_name: 'SupportBuddy',
      description: 'A customer support chatbot answering billing questions.',
      questionnaire: { domain: 'customer_service', interacts_with_humans: true },
    });
    expect(result.tier).toBe('limited');
    expect(result.matched_rules.some((m) => m.rule_id === 'art50-1-human-interaction')).toBe(true);
    expect(result.obligations.some((o) => o.deadline_note?.includes('2026'))).toBe(true);
  });

  it('classifies deepfake tools as limited via keywords', () => {
    const result = classify({
      system_name: 'FaceFun',
      description: 'Creates deepfake videos for entertainment.',
    });
    expect(result.tier).toBe('limited');
    expect(result.matched_rules.some((m) => m.rule_id === 'art50-4-deepfake')).toBe(true);
  });

  it('returns minimal when nothing matches', () => {
    const result = classify({
      system_name: 'LogSummarizer',
      description: 'Summarizes internal server logs for the ops team.',
      questionnaire: { domain: 'other' },
    });
    expect(result.tier).toBe('minimal');
    expect(result.matched_rules).toHaveLength(0);
    expect(result.obligations.some((o) => o.article === 'Article 95')).toBe(true);
  });

  it('social scoring is prohibited regardless of other matches', () => {
    const result = classify({
      system_name: 'CitizenRank',
      description: 'Chatbot that assigns a social score to citizens.',
      questionnaire: { social_scoring: true, interacts_with_humans: true },
    });
    expect(result.tier).toBe('prohibited');
    // lower-tier matches are still reported
    expect(result.matched_rules.some((m) => m.tier === 'limited')).toBe(true);
  });

  it('always includes the legal disclaimer', () => {
    expect(classify({ system_name: 'X', description: 'y' }).disclaimer).toContain('not legal advice');
  });
});
