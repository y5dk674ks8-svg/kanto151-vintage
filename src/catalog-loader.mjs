const CACHE_DB = "kanto151-catalog-v1";
const CACHE_STORE = "sets";

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function openCatalogDb() {
  if (typeof indexedDB === "undefined") return null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function cacheGet(key) {
  const db = await openCatalogDb();
  if (!db) return null;
  try {
    return await requestToPromise(db.transaction(CACHE_STORE, "readonly").objectStore(CACHE_STORE).get(key));
  } finally {
    db.close();
  }
}

async function cachePut(key, value) {
  const db = await openCatalogDb();
  if (!db) return;
  try {
    await requestToPromise(db.transaction(CACHE_STORE, "readwrite").objectStore(CACHE_STORE).put(value, key));
  } finally {
    db.close();
  }
}

export function normalizeCardText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function normalizeCollectorNumber(value) {
  let raw = String(value ?? "").trim().toLocaleLowerCase();
  if (!raw) return "";
  raw = raw.split("/")[0].trim();
  if (/^\d+$/.test(raw)) return String(Number(raw));
  return raw.replace(/\s+/g, "");
}

export function textSimilarity(left, right) {
  const a = normalizeCardText(left);
  const b = normalizeCardText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + cost);
      diagonal = above;
    }
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

export function rankCatalogCandidates(records, query = {}) {
  const queryNumber = normalizeCollectorNumber(query.collectorNumber ?? query.number);
  const queryName = String(query.name ?? "");
  const queryDex = Number.isInteger(Number(query.dexId)) ? Number(query.dexId) : null;
  const querySet = normalizeCardText(query.setName ?? query.setId ?? "");
  return records.map(record => {
    const dexMatch = queryDex !== null && record.pokemonDexIds?.includes(queryDex);
    const numberMatch = Boolean(queryNumber) && normalizeCollectorNumber(record.collectorNumber?.raw) === queryNumber;
    const nameScore = queryName ? textSimilarity(queryName, record.cardIdentity?.name) : 0;
    const setScore = querySet && (
      normalizeCardText(record.set?.name).includes(querySet) ||
      normalizeCardText(record.set?.setId) === querySet
    ) ? 1 : 0;
    const score =
      (dexMatch ? 0.38 : 0) +
      (numberMatch ? 0.34 : 0) +
      (nameScore * 0.22) +
      (setScore * 0.06);
    const evidence = [];
    if (dexMatch) evidence.push("Pokédexnummer komt overeen");
    if (numberMatch) evidence.push("Kaartnummer komt overeen");
    if (nameScore >= 0.8) evidence.push("Kaartnaam komt sterk overeen");
    else if (nameScore >= 0.45) evidence.push("Kaartnaam komt gedeeltelijk overeen");
    if (setScore) evidence.push("Set komt overeen");
    return { record, score, evidence };
  }).filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.record.recordId.localeCompare(b.record.recordId));
}

export class KantoCatalog {
  constructor({ baseUrl = "./catalog/", fetchImpl = globalThis.fetch, onProgress = null } = {}) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
    this.fetchImpl = fetchImpl;
    this.onProgress = onProgress;
    this.index = null;
    this.loadedSets = new Map();
  }

  async loadIndex() {
    if (this.index) return this.index;
    const cached = await cacheGet("index");
    if (cached) {
      this.index = cached;
      return cached;
    }
    const response = await this.fetchImpl(this.baseUrl + "index.json");
    if (!response.ok) throw new Error("Catalogusindex kon niet worden geladen: HTTP " + response.status);
    this.index = await response.json();
    await cachePut("index", this.index);
    return this.index;
  }

  async loadSet(language, setId) {
    const key = language + "/" + setId;
    if (this.loadedSets.has(key)) return this.loadedSets.get(key);
    const index = await this.loadIndex();
    const entry = (index.languages?.[language] ?? []).find(item => item.setId === setId);
    if (!entry) throw new Error("Set niet gevonden in catalogusindex: " + key);
    const cached = await cacheGet(key);
    if (cached) {
      this.loadedSets.set(key, cached);
      return cached;
    }
    const response = await this.fetchImpl(this.baseUrl + entry.path);
    if (!response.ok) throw new Error("Setbestand kon niet worden geladen: " + entry.path + " (HTTP " + response.status + ")");
    const records = await response.json();
    this.loadedSets.set(key, records);
    await cachePut(key, records);
    return records;
  }

  async loadLanguage(language, { concurrency = 4 } = {}) {
    const index = await this.loadIndex();
    const sets = index.languages?.[language];
    if (!sets) throw new Error("Niet-ondersteunde catalogustaal: " + language);
    const results = new Array(sets.length);
    let next = 0;
    let completed = 0;
    const worker = async () => {
      while (true) {
        const position = next++;
        if (position >= sets.length) return;
        results[position] = await this.loadSet(language, sets[position].setId);
        completed++;
        this.onProgress?.({ language, completed, total: sets.length, setId: sets[position].setId });
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, sets.length) }, worker));
    return results.flat();
  }

  async search(language, query, { limit = 30 } = {}) {
    const records = await this.loadLanguage(language);
    return rankCatalogCandidates(records, query).slice(0, limit);
  }

  async clearMemoryCache() {
    this.loadedSets.clear();
    this.index = null;
  }
}
