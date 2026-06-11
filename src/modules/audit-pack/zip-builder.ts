import archiver from 'archiver';
import { createHash } from 'node:crypto';
import { Transform } from 'node:stream';

export interface ManifestFile {
  path: string;
  sha256: string;
  bytes: number;
}

/**
 * Streaming ZIP builder: files are appended progressively, each file's sha256
 * is recorded for the manifest, and the whole pack's sha256 is computed from
 * the bytes that actually go over the wire.
 */
export function createZipBuilder() {
  const archive = archiver('zip', { zlib: { level: 6 } });
  const packHash = createHash('sha256');
  const files: ManifestFile[] = [];

  // Hash inline as bytes pass through. A 'data' listener on a PassThrough
  // would switch it to flowing mode and drop bytes before a consumer attaches.
  const output = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      packHash.update(chunk);
      cb(null, chunk);
    },
  });
  archive.pipe(output);

  const completed = new Promise<string>((resolve, reject) => {
    output.on('finish', () => resolve(packHash.digest('hex')));
    output.on('error', reject);
    archive.on('error', (err) => {
      output.destroy(err);
      reject(err);
    });
  });

  return {
    /** Stream to send as the HTTP response body. */
    stream: output,
    /** Resolves with the pack sha256 once the consumer has read everything. */
    completed,
    addFile(path: string, content: string | Buffer) {
      const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
      files.push({
        path,
        sha256: createHash('sha256').update(buf).digest('hex'),
        bytes: buf.length,
      });
      archive.append(buf, { name: path });
    },
    async finalize(manifestExtra: Record<string, unknown>) {
      const manifest = { ...manifestExtra, files };
      archive.append(Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'), {
        name: 'audit-pack/manifest.json',
      });
      await archive.finalize();
    },
    abort(err: Error) {
      archive.abort();
      output.destroy(err);
    },
  };
}
