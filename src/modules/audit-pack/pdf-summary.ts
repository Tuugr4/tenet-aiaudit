import PDFDocument from 'pdfkit';
import type { VerifyResult } from '../verification/verification.service.js';

export interface PackStats {
  totalCalls: number;
  byModel: { modelId: string; count: number }[];
  oversightCount: number;
  consentRecordedCount: number;
  errorCount: number;
  appealCount: number;
}

export interface PdfSummaryInput {
  tenantName: string;
  tenantSlug: string;
  packId: string;
  rangeFrom: string;
  rangeTo: string;
  generatedAt: string;
  stats: PackStats;
  verification: VerifyResult;
  genesisHash: string;
  riskAssessments: { system_name: string; tier: string; created_at: string }[];
  incidents: {
    title: string;
    severity: string;
    is_article_73: boolean;
    occurred_at: string;
    status: string;
  }[];
}

const MARGIN = 50;

export function renderPdfSummary(input: PdfSummaryInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pct = (n: number) =>
      input.stats.totalCalls === 0 ? 'n/a' : `${((n / input.stats.totalCalls) * 100).toFixed(1)}%`;

    // ── Cover ──────────────────────────────────────────────────────────────
    doc.fontSize(24).font('Helvetica-Bold').text('AI Act Audit Pack', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text('Tenet Audit — tamper-evident AI call records', {
      align: 'center',
    });
    doc.moveDown(2);

    kv(doc, 'Organisation', `${input.tenantName} (${input.tenantSlug})`);
    kv(doc, 'Reporting period', `${input.rangeFrom} - ${input.rangeTo}`);
    kv(doc, 'Generated at', input.generatedAt);
    kv(doc, 'Pack ID', input.packId);
    doc.moveDown(1);

    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor(input.verification.valid ? '#1a7f37' : '#b91c1c')
      .text(
        input.verification.valid
          ? 'HASH CHAIN VERIFIED — records are tamper-evident and intact'
          : `HASH CHAIN VERIFICATION FAILED — ${input.verification.reason ?? 'integrity violation'}`,
      )
      .fillColor('black');
    doc.moveDown(2);

    // ── Executive summary ──────────────────────────────────────────────────
    heading(doc, '1. Executive Summary');
    kv(doc, 'Total AI calls recorded', String(input.stats.totalCalls));
    kv(
      doc,
      'Human oversight (Article 14)',
      `${input.stats.oversightCount} calls (${pct(input.stats.oversightCount)})`,
    );
    kv(
      doc,
      'User consent recorded',
      `${input.stats.consentRecordedCount} calls (${pct(input.stats.consentRecordedCount)})`,
    );
    kv(doc, 'Calls with errors', `${input.stats.errorCount} (${pct(input.stats.errorCount)})`);
    kv(doc, 'Appeals recorded', String(input.stats.appealCount));
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica-Bold').text('Calls by model:');
    doc.font('Helvetica');
    for (const m of input.stats.byModel.slice(0, 20)) {
      doc.text(`  • ${m.modelId}: ${m.count}`);
    }
    doc.moveDown(1.5);

    // ── Article 12 statement ───────────────────────────────────────────────
    heading(doc, '2. Record-Keeping Methodology (Article 12)');
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(
        'Each AI call is stored as an append-only record containing model identity and version, ' +
          'prompt version, data sources, user consent, human oversight, decision output reference, ' +
          'errors and appeals. Records form a per-tenant hash chain: every record embeds the SHA-256 ' +
          'hash of its predecessor and its own content hash, computed over a canonical JSON ' +
          'serialization. Any modification, deletion or reordering of historical records breaks the ' +
          'chain and is detected by recomputation. The chain can be independently re-verified from ' +
          'the evidence files in this pack.',
        { align: 'justify' },
      );
    doc.moveDown(0.5);
    kv(doc, 'Genesis hash', input.genesisHash, 9);
    kv(doc, 'Chain head hash', input.verification.headHash, 9);
    kv(
      doc,
      'Records verified',
      `${input.verification.checkedRecords} (seq ${input.verification.fromSeq}–${input.verification.toSeq})`,
    );
    doc.moveDown(1.5);

    // ── Risk assessments ───────────────────────────────────────────────────
    heading(doc, '3. Risk Classification Summary (Article 6 / Annex III)');
    if (input.riskAssessments.length === 0) {
      doc.fontSize(10).font('Helvetica-Oblique').text('No risk assessments recorded.');
    } else {
      doc.fontSize(10).font('Helvetica');
      for (const r of input.riskAssessments.slice(0, 25)) {
        doc.text(`  • [${r.tier.toUpperCase()}] ${r.system_name} — assessed ${r.created_at}`);
      }
    }
    doc.moveDown(1.5);

    // ── Incident register ──────────────────────────────────────────────────
    heading(doc, '4. Incident Register (Article 73)');
    if (input.incidents.length === 0) {
      doc.fontSize(10).font('Helvetica-Oblique').text('No incidents recorded in this period.');
    } else {
      doc.fontSize(10).font('Helvetica');
      for (const i of input.incidents.slice(0, 50)) {
        doc.text(
          `  • ${i.occurred_at} [${i.severity.toUpperCase()}${i.is_article_73 ? ', ART. 73' : ''}] ` +
            `${i.title} — status: ${i.status}`,
        );
      }
    }
    doc.moveDown(1.5);

    // ── Disclaimer ─────────────────────────────────────────────────────────
    heading(doc, '5. Methodology Notes & Disclaimer');
    doc
      .fontSize(9)
      .font('Helvetica')
      .text(
        'Threat model: the hash chain detects modification or deletion of historical records. It does ' +
          'not by itself detect truncation performed by an actor able to rewrite the chain head; ' +
          'periodic external anchoring of head hashes is recommended for that scenario. ' +
          'This document is generated from records supplied by the organisation and constitutes ' +
          'supporting evidence, not legal advice or a conformity assessment under Regulation (EU) 2024/1689.',
        { align: 'justify' },
      );

    doc.end();
  });
}

function heading(doc: PDFKit.PDFDocument, text: string) {
  doc.fontSize(14).font('Helvetica-Bold').text(text);
  doc.moveDown(0.5);
}

function kv(doc: PDFKit.PDFDocument, key: string, value: string, size = 11) {
  doc.fontSize(size).font('Helvetica-Bold').text(`${key}: `, { continued: true });
  doc.font('Helvetica').text(value);
}
