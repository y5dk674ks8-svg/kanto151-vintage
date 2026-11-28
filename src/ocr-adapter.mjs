const workers = new Map();

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label + " duurde langer dan " + ms + " ms.")), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

async function ensureTesseract() {
  if (globalThis.Tesseract?.createWorker) return globalThis.Tesseract;
  if (typeof document === "undefined") throw new Error("Tesseract kan alleen in de browser worden gestart.");
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("../assets/tesseract.min.js", import.meta.url).href;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Lokale Tesseract.js-runtime ontbreekt."));
    document.head.appendChild(script);
  });
  if (!globalThis.Tesseract?.createWorker) throw new Error("Tesseract.js is geladen, maar createWorker ontbreekt.");
  return globalThis.Tesseract;
}

async function getWorker(language) {
  const lang = language === "ja" ? "jpn" : "eng";
  if (workers.has(lang)) return workers.get(lang);
  const Tesseract = await ensureTesseract();
  const worker = await withTimeout(Tesseract.createWorker(lang, 1, {
    workerPath: new URL("../assets/worker.min.js", import.meta.url).href,
    corePath: new URL("../assets/tesseract-core/", import.meta.url).href,
    langPath: new URL("../assets/tessdata/", import.meta.url).href,
    cacheMethod: "write",
    gzip: true,
    workerBlobURL: false
  }), 60000, "OCR-worker initialiseren");
  workers.set(lang, worker);
  return worker;
}

function cropRegion(source, [left, top, right, bottom], scale = 3) {
  const x = Math.max(0, Math.floor(source.width * left));
  const y = Math.max(0, Math.floor(source.height * top));
  const width = Math.max(1, Math.min(source.width - x, Math.ceil(source.width * (right - left))));
  const height = Math.max(1, Math.min(source.height - y, Math.ceil(source.height * (bottom - top))));
  const crop = document.createElement("canvas");
  crop.width = Math.max(1, width * scale);
  crop.height = Math.max(1, height * scale);
  const context = crop.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("OCR-uitsnede kon niet worden aangemaakt.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, x, y, width, height, 0, 0, crop.width, crop.height);
  return crop;
}

async function recognize(worker, canvas, parameters, label) {
  if (worker.setParameters) await worker.setParameters(parameters);
  const result = await withTimeout(worker.recognize(canvas), 45000, label);
  return {
    text: String(result.data?.text ?? "").trim(),
    confidence: Number.isFinite(result.data?.confidence) ? result.data.confidence : null
  };
}

/**
 * Selects a collector-number fraction only when OCR passes agree.
 * Conflicting readings remain raw text so the downstream strict parser fails closed.
 */
export function selectCollectorNumberRead(reads) {
  const fractions = reads.flatMap(read =>
    [...String(read.text ?? "").matchAll(/(\d{1,3})\s*[\/|]\s*(\d{1,3})/g)]
      .map(match => match[1] + "/" + match[2])
  );
  const counts = new Map();
  for (const fraction of fractions) counts.set(fraction, (counts.get(fraction) || 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const clearWinner = ranked.length === 1 ||
    (ranked.length > 1 && ranked[0][1] > ranked[1][1]);
  if (ranked.length && clearWinner) {
    return {
      text: ranked[0][0],
      confidence: Math.max(...reads.map(read => read.confidence ?? 0))
    };
  }
  return {
    text: reads.map(read => read.text).filter(Boolean).join("\n"),
    confidence: null
  };
}

/**
 * OCR on a perspective-corrected card canvas.
 * Japanese early-era cards often have no printed collector number; an empty
 * number result is therefore valid and must not hard-exclude candidates.
 */
export async function recognizeCardText(cardCanvas, language = "en", numberCanvas = cardCanvas) {
  if (!cardCanvas || !cardCanvas.width || !cardCanvas.height) {
    throw new Error("Geen geldige, rechtgezette kaartafbeelding ontvangen.");
  }
  const nameWorker = await getWorker(language);
  // Keep the crop tight around the printed name. Including the HP/type area\n  // makes OCR merge unrelated symbols into short names (e.g. Diglett).\n  const nameCrop = cropRegion(cardCanvas, [0.07, 0.055, 0.46, 0.115], 4);
  let name;
  try {
    const params = language === "ja"
      ? { tessedit_pageseg_mode: "7", preserve_interword_spaces: "0" }
      : {
          tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'- ",
          tessedit_pageseg_mode: "7",
          preserve_interword_spaces: "0"
        };
    name = await recognize(nameWorker, nameCrop, params, "Pokémonnaam herkennen");
  } finally {
    nameCrop.width = 0;
    nameCrop.height = 0;
  }

  // Printed number is absent on many Japanese vintage cards, and is a weak
  // signal when present. OCR failure must not cancel name-based retrieval.
  // Base Set numbers are tiny and sit close to the lower/right card edge.
  // A single crop is brittle, so read overlapping regions with different
  // page-segmentation modes and accept only an unambiguous fraction.
  let number = { text: "", confidence: null, passes: [] };
  try {
    const numberWorker = await getWorker("en");
    const attempts = [
      { bounds: [0.73, 0.925, 0.985, 0.998], mode: "7" },
      { bounds: [0.62, 0.90, 0.998, 0.998], mode: "6" },
      { bounds: [0.78, 0.90, 0.998, 0.985], mode: "7" }
    ];
    for (const [index, attempt] of attempts.entries()) {
      const numberCrop = cropRegion(numberCanvas, attempt.bounds, 5);
      try {
        const read = await recognize(numberWorker, numberCrop, {
          tessedit_char_whitelist: "0123456789/|",
          tessedit_pageseg_mode: attempt.mode,
          preserve_interword_spaces: "0"
        }, "Kaartnummer herkennen (" + (index + 1) + ")");
        number.passes.push(read);
      } finally {
        numberCrop.width = 0;
        numberCrop.height = 0;
      }
    }

    number = { ...selectCollectorNumberRead(number.passes), passes: number.passes };
  } catch (error) {
    number = { ...number, text: number.passes.map(read => read.text).filter(Boolean).join("\n"), error: error.message };
  }

  return {
    language,
    nameText: name.text,
    nameConfidence: name.confidence,
    numberText: number.text,
    numberConfidence: number.confidence,
    numberError: number.error ?? null
  };
}

export async function terminateOcrWorkers() {
  const current = [...workers.values()];
  workers.clear();
  await Promise.all(current.map(worker => worker.terminate().catch(() => undefined)));
}
