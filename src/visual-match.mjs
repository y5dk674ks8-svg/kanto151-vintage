const DB_NAME = "kanto151-visual-features-v1";
const STORE_NAME = "features";
const featureCache = new Map();

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function openFeatureDb() {
  if (typeof indexedDB === "undefined") return null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCachedFeature(key) {
  const db = await openFeatureDb();
  if (!db) return null;
  try {
    return await requestToPromise(db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key));
  } finally {
    db.close();
  }
}

async function writeCachedFeature(key, value) {
  const db = await openFeatureDb();
  if (!db) return;
  try {
    await requestToPromise(db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(value, key));
  } finally {
    db.close();
  }
}

function loadImage(baseUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    const timer = setTimeout(() => reject(new Error("Referentieafbeelding laden duurde te lang.")), 20000);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Referentieafbeelding niet bereikbaar of niet leesbaar door CORS."));
    };
    image.src = baseUrl.replace(/\/$/, "") + "/low.webp";
  });
}

function crop(source, bounds) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(
    source,
    source.width * bounds[0],
    source.height * bounds[1],
    source.width * (bounds[2] - bounds[0]),
    source.height * (bounds[3] - bounds[1]),
    0, 0, 128, 128
  );
  return canvas;
}

function hash(context) {
  const size = 32, low = 8;
  let sourceContext = context;
  let reduced = null;
  if (context.canvas.width !== size || context.canvas.height !== size) {
    reduced = document.createElement("canvas");
    reduced.width = reduced.height = size;
    sourceContext = reduced.getContext("2d", { willReadFrequently: true });
    sourceContext.drawImage(context.canvas, 0, 0, size, size);
  }
  const pixels = sourceContext.getImageData(0, 0, size, size).data;
  const gray = new Float64Array(size * size);
  const horizontal = new Float64Array(size * size);
  const output = new Float64Array(low * low);
  for (let i = 0; i < size * size; i++) {
    gray[i] = .299 * pixels[i * 4] + .587 * pixels[i * 4 + 1] + .114 * pixels[i * 4 + 2];
  }
  const cosines = Array.from({ length: low }, (_, u) =>
    Float64Array.from({ length: size }, (_, x) => Math.cos((2 * x + 1) * u * Math.PI / (2 * size)))
  );
  for (let y = 0; y < size; y++) {
    for (let u = 0; u < low; u++) {
      let sum = 0;
      for (let x = 0; x < size; x++) sum += gray[y * size + x] * cosines[u][x];
      horizontal[y * size + u] = sum;
    }
  }
  let index = 0;
  for (let v = 0; v < low; v++) {
    for (let u = 0; u < low; u++) {
      let sum = 0;
      for (let y = 0; y < size; y++) sum += horizontal[y * size + u] * cosines[v][y];
      output[index++] = sum;
    }
  }
  const sorted = Array.from(output.slice(1)).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  let bits = 0n;
  for (let i = 0; i < 64; i++) if (output[i + 1] > median) bits |= 1n << BigInt(i);
  const result = bits.toString(16).padStart(16, "0");
  if (reduced) reduced.width = reduced.height = 0;
  return result;
}

function histogram(context) {
  const data = context.getImageData(0, 0, 128, 128).data;
  const bins = new Float32Array(20);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    let hue = 0;
    if (delta) {
      if (max === r) hue = ((g - b) / delta) % 6;
      else if (max === g) hue = (b - r) / delta + 2;
      else hue = (r - g) / delta + 4;
      hue = (hue * 60 + 360) % 360;
    }
    bins[Math.min(11, Math.floor(hue / 30))]++;
    bins[12 + Math.min(3, Math.floor((max ? delta / max : 0) * 4))]++;
    bins[16 + Math.min(3, Math.floor(max * 4))]++;
  }
  for (let i = 0; i < bins.length; i++) bins[i] /= 16384;
  return Array.from(bins);
}

function feature(source) {
  const normalized = document.createElement("canvas");
  normalized.width = normalized.height = 128;
  const context = normalized.getContext("2d", { willReadFrequently: true });
  context.drawImage(source, 0, 0, 128, 128);

  const footer = document.createElement("canvas");
  footer.width = 32;
  footer.height = 32;
  const footerContext = footer.getContext("2d", { willReadFrequently: true });
  footerContext.drawImage(normalized, 78, 118, 48, 10, 0, 0, 64, 32);
  const footerHash = hash(footerContext);
  footer.width = footer.height = 0;

  const tiles = [];
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const tile = document.createElement("canvas");
      tile.width = tile.height = 32;
      const tileContext = tile.getContext("2d", { willReadFrequently: true });
      tileContext.drawImage(normalized, x * 32, y * 32, 32, 32, 0, 0, 32, 32);
      tiles.push(hash(tileContext));
      tile.width = tile.height = 0;
    }
  }
  const result = { hash: hash(context), tiles, hist: histogram(context), footer: footerHash };
  normalized.width = normalized.height = 0;
  return result;
}

export function hammingDistance(left, right) {
  let bits = BigInt("0x" + left) ^ BigInt("0x" + right);
  let count = 0;
  while (bits) {
    count++;
    bits &= bits - 1n;
  }
  return count;
}

export function compareVisualFeatures(left, right) {
  let tileScore = 0;
  for (let i = 0; i < 16; i++) tileScore += 1 - hammingDistance(left.tiles[i], right.tiles[i]) / 64;
  tileScore /= 16;
  let histogramDifference = 0;
  for (let i = 0; i < left.hist.length; i++) histogramDifference += Math.abs(left.hist[i] - right.hist[i]);
  const globalScore = 1 - hammingDistance(left.hash, right.hash) / 64;
  const colourScore = Math.max(0, 1 - histogramDifference / 2);
  const footerScore = 1 - hammingDistance(left.footer, right.footer) / 64;
  return .12 * globalScore + .58 * tileScore + .10 * colourScore + .20 * footerScore;
}

function compareSimilarity(left, right) {
  return Math.max(0, Math.min(1, .84 * compareVisualFeatures(left.full, right.full) + .16 * compareVisualFeatures(left.art, right.art)));
}

function queryFeatures(source) {
  const bounds = [[0, 0, 1, 1], [.04, .04, .96, .96], [.065, .055, .94, .945], [.085, .07, .925, .935]];
  return bounds.map(box => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 840;
    canvas.getContext("2d", { willReadFrequently: true }).drawImage(
      source,
      source.width * box[0], source.height * box[1],
      source.width * (box[2] - box[0]), source.height * (box[3] - box[1]),
      0, 0, canvas.width, canvas.height
    );
    const artwork = crop(canvas, [.18, .23, .82, .66]);
    const result = { full: feature(canvas), art: feature(artwork) };
    canvas.width = canvas.height = artwork.width = artwork.height = 0;
    return result;
  });
}

async function referenceFeature(baseUrl) {
  if (featureCache.has(baseUrl)) return featureCache.get(baseUrl);
  const task = (async () => {
    const cached = await readCachedFeature(baseUrl).catch(() => null);
    if (cached) return cached;
    const image = await loadImage(baseUrl);
    const full = feature(image);
    const artwork = crop(image, [.18, .23, .82, .66]);
    const art = feature(artwork);
    artwork.width = artwork.height = 0;
    const result = { full, art };
    await writeCachedFeature(baseUrl, result).catch(() => undefined);
    return result;
  })();
  featureCache.set(baseUrl, task);
  try {
    const result = await task;
    featureCache.set(baseUrl, result);
    return result;
  } catch (error) {
    featureCache.delete(baseUrl);
    throw error;
  }
}

/**
 * Ranks only records with a reference image. The score is a similarity ranking,
 * never a probability or an automatic card confirmation.
 */
export async function rankVisualCandidates(cardCanvas, candidates, onProgress = null) {
  if (!cardCanvas || !candidates?.length) return { matches: candidates ?? [], compared: 0, failed: 0 };
  const queries = queryFeatures(cardCanvas);
  const results = new Array(candidates.length);
  let cursor = 0, done = 0, failed = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= candidates.length) return;
      const candidate = candidates[index];
      const baseUrl = candidate.record?.images?.sourceBaseUrl ?? candidate.images?.sourceBaseUrl ?? null;
      try {
        if (!baseUrl) throw new Error("Geen referentieafbeelding");
        const reference = await referenceFeature(baseUrl);
        results[index] = { ...candidate, visualScore: Math.max(...queries.map(query => compareSimilarity(query, reference))), visualMatch: true };
      } catch (error) {
        failed++;
        results[index] = { ...candidate, visualMatch: false, visualError: error.message };
      }
      done++;
      onProgress?.(done, candidates.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, worker));
  return {
    matches: results.filter(Boolean).sort((a, b) => (b.visualScore ?? -1) - (a.visualScore ?? -1)),
    compared: candidates.length - failed,
    failed
  };
}
