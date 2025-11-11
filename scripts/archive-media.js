#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const DEFAULT_BUCKET = process.env.SUPABASE_STORAGE_ARCHIVE_BUCKET || "media-archive";

function parseArgs(argv) {
  const options = {
    bucket: DEFAULT_BUCKET,
    output: path.resolve(process.cwd(), "backups", "media-archive"),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--bucket" && argv[i + 1]) {
      options.bucket = argv[i + 1];
      i += 1;
    } else if ((arg === "--out" || arg === "--output") && argv[i + 1]) {
      options.output = path.resolve(argv[i + 1]);
      i += 1;
    }
  }
  return options;
}

async function ensureFetch() {
  if (typeof fetch === "function") return fetch;
  const { default: fetchImpl } = await import("node-fetch");
  return fetchImpl;
}

function encodePath(value) {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function listObjects(bucket, fetchImpl) {
  const results = [];
  let cursor = null;
  const base = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/list/${bucket}`;
  do {
    const params = new URLSearchParams({ limit: "1000" });
    if (cursor) params.set("cursor", cursor);
    const response = await fetchImpl(`${base}?${params.toString()}`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`List request failed (${response.status}): ${text}`);
    }
    const payload = await response.json();
    if (Array.isArray(payload)) {
      payload.forEach((item) => {
        if (item?.name) {
          results.push(item);
        }
      });
      cursor = payload.length === 1000 ? payload[payload.length - 1]?.id || null : null;
    } else {
      cursor = null;
    }
  } while (cursor);
  return results;
}

async function downloadObject(bucket, object, outputDir, fetchImpl) {
  const targetPath = path.join(outputDir, object.name);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const response = await fetchImpl(
    `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${bucket}/${encodePath(object.name)}`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Download failed for ${object.name} (${response.status}): ${text}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const hash = crypto.createHash("sha256");
  hash.update(buffer);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buffer);
  const checksum = hash.digest("hex");
  const size = buffer.length;
  return { name: object.name, checksum, size };
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    process.exit(1);
  }
  const options = parseArgs(process.argv.slice(2));
  const fetchImpl = await ensureFetch();
  console.log(`📦 Archiving bucket '${options.bucket}' to ${options.output}`);
  const objects = await listObjects(options.bucket, fetchImpl);
  if (!objects.length) {
    console.log("No objects found.");
    return;
  }
  const manifest = [];
  for (const object of objects) {
    try {
      const entry = await downloadObject(
        options.bucket,
        object,
        options.output,
        fetchImpl
      );
      manifest.push(entry);
      console.log(`✅ ${object.name}`);
    } catch (error) {
      console.warn(`⚠️  Failed to archive ${object.name}: ${error.message}`);
    }
  }
  const manifestPath = path.join(options.output, "manifest.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        bucket: options.bucket,
        generatedAt: new Date().toISOString(),
        objects: manifest,
      },
      null,
      2
    )
  );
  console.log(`📝 Manifest written to ${manifestPath}`);
}

main().catch((error) => {
  console.error("❌ Archive failed", error);
  process.exit(1);
});
