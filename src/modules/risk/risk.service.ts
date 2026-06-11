import { uuidv7 } from 'uuidv7';
import type { Sql } from '../../db/client.js';
import { article5Rules } from './rules/article-5.js';
import { annexIiiRules } from './rules/annex-iii.js';
import { article50Rules } from './rules/article-50.js';
import { obligationsForTier, type Obligation } from './rules/obligations.js';
import type { MatchedRule, Questionnaire, RiskRule, Tier } from './rules/types.js';

export const DISCLAIMER =
  'This is a rules-based screening tool referencing Regulation (EU) 2024/1689. It is not legal advice; consult qualified counsel for a definitive classification.';

export interface ClassifyInput {
  system_name: string;
  description: string;
  questionnaire?: Questionnaire;
}

export interface ClassifyResult {
  tier: Tier;
  confidence: 'high' | 'indicative';
  matched_rules: MatchedRule[];
  obligations: Obligation[];
  disclaimer: string;
}

const ALL_RULES: RiskRule[] = [...article5Rules, ...annexIiiRules, ...article50Rules];
const TIER_ORDER: Tier[] = ['prohibited', 'high', 'limited', 'minimal'];

function matchRule(rule: RiskRule, q: Questionnaire, text: string): MatchedRule | null {
  if (rule.questionnaire(q)) {
    return { ...toMatched(rule), triggered_by: 'questionnaire' };
  }
  if (rule.keywords.some((re) => re.test(text))) {
    return { ...toMatched(rule), triggered_by: 'keywords' };
  }
  return null;
}

function toMatched(rule: RiskRule): Omit<MatchedRule, 'triggered_by'> {
  const base: Omit<MatchedRule, 'triggered_by'> = {
    rule_id: rule.rule_id,
    tier: rule.tier,
    article: rule.article,
    label: rule.label,
  };
  if (rule.annex_ref) base.annex_ref = rule.annex_ref;
  return base;
}

export function classify(input: ClassifyInput): ClassifyResult {
  const q = input.questionnaire ?? {};
  const text = `${input.system_name}\n${input.description}`;

  const matched: MatchedRule[] = [];
  for (const rule of ALL_RULES) {
    const m = matchRule(rule, q, text);
    if (m) matched.push(m);
  }

  let tier: Tier = 'minimal';
  for (const t of TIER_ORDER) {
    if (matched.some((m) => m.tier === t)) {
      tier = t;
      break;
    }
  }

  // Questionnaire answers are authoritative; keyword hits are only a screen.
  const decisive = matched.filter((m) => m.tier === tier);
  const confidence: 'high' | 'indicative' =
    tier === 'minimal' || decisive.some((m) => m.triggered_by === 'questionnaire')
      ? input.questionnaire && Object.keys(q).length > 0
        ? 'high'
        : 'indicative'
      : 'indicative';

  return {
    tier,
    confidence,
    matched_rules: matched,
    obligations: obligationsForTier(tier),
    disclaimer: DISCLAIMER,
  };
}

export async function classifyAndPersist(
  sql: Sql,
  tenantId: string,
  input: ClassifyInput,
  persist: boolean,
): Promise<ClassifyResult & { assessment_id: string | null }> {
  const result = classify(input);
  if (!persist) return { ...result, assessment_id: null };

  const id = uuidv7();
  await sql`
    INSERT INTO risk_assessments (id, tenant_id, system_name, input, tier, confidence, matched_rules, obligations)
    VALUES (
      ${id}, ${tenantId}, ${input.system_name}, ${sql.json(input as never)},
      ${result.tier}, ${result.confidence},
      ${sql.json(result.matched_rules as never)}, ${sql.json(result.obligations as never)}
    )
  `;
  return { ...result, assessment_id: id };
}

export async function listAssessments(sql: Sql, tenantId: string) {
  const rows = await sql`
    SELECT id, created_at, system_name, tier, confidence, matched_rules, obligations
    FROM risk_assessments
    WHERE tenant_id = ${tenantId}
    ORDER BY created_at DESC
    LIMIT 200
  `;
  return rows.map((r) => ({
    id: r.id as string,
    created_at: (r.createdAt as Date).toISOString(),
    system_name: r.systemName as string,
    tier: r.tier as Tier,
    confidence: r.confidence as string,
    matched_rules: r.matchedRules,
    obligations: r.obligations,
  }));
}
