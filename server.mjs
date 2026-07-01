import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT ?? 5173);
loadEnvFile();
const host = process.env.HOST ?? (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
const dataDir = process.env.DATA_DIR ?? join(root, "data");
const globalDataPath = join(dataDir, "global-data.json");
const DATA_SCHEMA_VERSION = 2;
const adminUser = process.env.ADMIN_USER ?? "";
const adminPassword = process.env.ADMIN_PASSWORD ?? "";
const adminToken = process.env.ADMIN_TOKEN ?? randomUUID();
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

mkdirSync(dataDir, { recursive: true });

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(request, response, url);
    return;
  }

  const requestedPath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(root, requestedPath);

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(root, "index.html");
  }

  response.setHeader("Content-Type", types[extname(filePath)] ?? "application/octet-stream");
  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  console.log(`VInculacion listo en http://localhost:${port}`);
});

async function handleApi(request, response, url) {
  try {
    if (request.method === "GET" && url.pathname === "/api/global-data") {
      sendJson(response, 200, await readGlobalData());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/global-data/export") {
      sendJson(response, 200, createDbExport(await readGlobalData()));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/admin-login") {
      const body = await readJsonBody(request);
      if (!adminUser || !adminPassword) {
        sendJson(response, 503, { error: "Credenciales de administrador no configuradas" });
        return;
      }
      if (body.username === adminUser && body.password === adminPassword) {
        sendJson(response, 200, { token: adminToken });
      } else {
        sendJson(response, 401, { error: "Credenciales incorrectas" });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/global-data") {
      if (!isAdmin(request)) {
        sendJson(response, 401, { error: "Solo administradores pueden guardar globalmente" });
        return;
      }

      const body = await readJsonBody(request);
      const key = body.type === "letters" ? "letters" : "signs";
      const item = body.item;
      if (!item?.label || !Array.isArray(item.samples)) {
        sendJson(response, 400, { error: "Dato global invalido" });
        return;
      }

      const data = await readGlobalData();
      const existing = data[key].find((entry) => entry.label === item.label);
      if (existing) {
        existing.id ??= item.id ?? randomUUID();
        existing.type ??= key === "letters" ? "letter" : "sign";
        existing.createdAt ??= item.createdAt ?? new Date().toISOString();
        existing.samples.push(...item.samples);
        existing.updatedAt = new Date().toISOString();
        existing.schemaVersion = DATA_SCHEMA_VERSION;
      } else {
        data[key].push(normalizeEntryForStorage(item, key));
      }
      await writeGlobalData(data);
      sendJson(response, 200, data);
      return;
    }

    if (request.method === "DELETE" && url.pathname === "/api/global-data") {
      if (!isAdmin(request)) {
        sendJson(response, 401, { error: "Solo administradores pueden borrar globalmente" });
        return;
      }

      const key = url.searchParams.get("type") === "letters" ? "letters" : "signs";
      const label = url.searchParams.get("label");
      const sampleIndexRaw = url.searchParams.get("sampleIndex");
      const data = await readGlobalData();

      if (sampleIndexRaw !== null) {
        const sampleIndex = Number(sampleIndexRaw);
        const entry = data[key].find((item) => item.label === label);
        if (!entry || !Array.isArray(entry.samples) || !Number.isInteger(sampleIndex) || sampleIndex < 0 || sampleIndex >= entry.samples.length) {
          sendJson(response, 400, { error: "Muestra global invalida" });
          return;
        }
        entry.samples.splice(sampleIndex, 1);
        entry.updatedAt = new Date().toISOString();
        entry.schemaVersion = DATA_SCHEMA_VERSION;
        data[key] = data[key].filter((item) => item.samples?.length > 0);
      } else {
        data[key] = data[key].filter((entry) => entry.label !== label);
      }

      await writeGlobalData(data);
      sendJson(response, 200, data);
      return;
    }

    sendJson(response, 404, { error: "Ruta no encontrada" });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Error del servidor" });
  }
}

async function readGlobalData() {
  try {
    const raw = await readFile(globalDataPath, "utf8");
    const data = JSON.parse(raw);
    return {
      schemaVersion: data.schemaVersion ?? 1,
      signs: Array.isArray(data.signs) ? data.signs : [],
      letters: Array.isArray(data.letters) ? data.letters : []
    };
  } catch {
    return { schemaVersion: DATA_SCHEMA_VERSION, signs: [], letters: [] };
  }
}

async function writeGlobalData(data) {
  await writeFile(globalDataPath, `${JSON.stringify({
    schemaVersion: DATA_SCHEMA_VERSION,
    signs: Array.isArray(data.signs) ? data.signs : [],
    letters: Array.isArray(data.letters) ? data.letters : []
  }, null, 2)}\n`, "utf8");
}

function normalizeEntryForStorage(item, key) {
  const now = new Date().toISOString();
  return {
    id: item.id ?? randomUUID(),
    schemaVersion: DATA_SCHEMA_VERSION,
    type: item.type ?? (key === "letters" ? "letter" : "sign"),
    label: item.label,
    createdAt: item.createdAt ?? now,
    updatedAt: now,
    samples: item.samples
  };
}

function createDbExport(data) {
  const entries = [];
  const samples = [];
  addExportEntries(entries, samples, data.signs ?? [], "sign");
  addExportEntries(entries, samples, data.letters ?? [], "letter");
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    entries,
    samples
  };
}

function addExportEntries(entries, samples, items, entryType) {
  for (const item of items) {
    if (!item?.label || !Array.isArray(item.samples)) continue;
    const entryId = isUuid(item.id) ? item.id : randomUUID();
    const now = new Date().toISOString();
    entries.push({
      id: entryId,
      label: item.label,
      entry_type: item.type ?? entryType,
      scope: "global",
      schema_version: Number(item.schemaVersion ?? DATA_SCHEMA_VERSION),
      created_at: validIsoDate(item.createdAt) ?? now,
      updated_at: validIsoDate(item.updatedAt) ?? now
    });

    for (const sample of item.samples) {
      const normalized = normalizeSampleForExport(sample);
      samples.push({
        id: isUuid(sample?.id) ? sample.id : randomUUID(),
        entry_id: entryId,
        sample_kind: normalized.kind,
        feature_vector_version: sample?.featureVectorVersion ?? null,
        feature_count: normalized.featureCount,
        duration_ms: normalized.durationMs,
        frame_count: normalized.frameCount,
        captured_at: validIsoDate(sample?.capturedAt) ?? now,
        vector: normalized.vector,
        frames: normalized.frames,
        raw_sample: sample
      });
    }
  }
}

function normalizeSampleForExport(sample) {
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

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isAdmin(request) {
  return request.headers.authorization === `Bearer ${adminToken}`;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 25_000_000) request.destroy();
    });
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function loadEnvFile() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").trim();
    }
  }
}
