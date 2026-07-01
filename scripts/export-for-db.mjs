import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(root, "data", "global-data.json");
const outputPath = join(root, "data", "db-export.json");

const raw = await readFile(sourcePath, "utf8");
const data = JSON.parse(raw);
const exportedAt = new Date().toISOString();
const entries = [];
const samples = [];

addEntries(data.signs ?? [], "sign");
addEntries(data.letters ?? [], "letter");

const exportData = {
  schemaVersion: 2,
  exportedAt,
  source: "data/global-data.json",
  entries,
  samples
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(exportData, null, 2)}\n`, "utf8");

console.log(`Export listo: ${outputPath}`);
console.log(`Entradas: ${entries.length}`);
console.log(`Muestras: ${samples.length}`);

function addEntries(items, entryType) {
  for (const item of items) {
    if (!item?.label || !Array.isArray(item.samples)) continue;

    const entryId = toUuid(item.id) ?? randomUUID();
    const now = new Date().toISOString();
    entries.push({
      id: entryId,
      label: item.label,
      entry_type: item.type ?? entryType,
      scope: "global",
      schema_version: Number(item.schemaVersion ?? data.schemaVersion ?? 1),
      created_at: validDate(item.createdAt) ?? firstSampleDate(item.samples) ?? now,
      updated_at: validDate(item.updatedAt) ?? lastSampleDate(item.samples) ?? now
    });

    item.samples.forEach((sample) => {
      const normalized = normalizeSample(sample);
      samples.push({
        id: toUuid(sample?.id) ?? randomUUID(),
        entry_id: entryId,
        sample_kind: normalized.kind,
        feature_vector_version: sample?.featureVectorVersion ?? null,
        feature_count: normalized.featureCount,
        duration_ms: normalized.durationMs,
        frame_count: normalized.frameCount,
        captured_at: validDate(sample?.capturedAt) ?? now,
        vector: normalized.vector,
        frames: normalized.frames,
        raw_sample: sample
      });
    });
  }
}

function normalizeSample(sample) {
  if (sample?.kind === "motion" && Array.isArray(sample.frames)) {
    return {
      kind: "motion",
      featureCount: Number(sample.featureCount ?? sample.frames[0]?.length ?? 0),
      durationMs: Number(sample.durationMs ?? sample.duration ?? 0) || null,
      frameCount: Number(sample.frameCount ?? sample.frames.length),
      vector: null,
      frames: sample.frames
    };
  }

  const vector = Array.isArray(sample?.vector)
    ? sample.vector
    : Array.isArray(sample)
      ? sample
      : [];

  return {
    kind: "pose",
    featureCount: Number(sample?.featureCount ?? vector.length),
    durationMs: null,
    frameCount: null,
    vector,
    frames: null
  };
}

function toUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function firstSampleDate(items) {
  return items.map((sample) => validDate(sample?.capturedAt)).filter(Boolean).sort()[0] ?? null;
}

function lastSampleDate(items) {
  return items.map((sample) => validDate(sample?.capturedAt)).filter(Boolean).sort().at(-1) ?? null;
}
