import { recognizeCardText } from "./ocr-adapter.mjs";

const MAX_VINTAGE_SET_TOTAL = 250;

export function parseCollectorNumber(ocrText) {
  const text = String(ocrText ?? "").replace(/[|Il]/g, "/");
  const matches = [...text.matchAll(/(?:^|\D)(\d{1,3})\s*\/\s*(\d{1,3})(?:$|\D)/g)];
  const valid = matches.map(match => ({
    rawNumber: match[1],
    number: Number(match[1]),
    total: Number(match[2])
  })).filter(pair =>
    pair.number > 0 &&
    pair.number <= 250 &&
    pair.total > pair.number &&
    pair.total <= MAX_VINTAGE_SET_TOTAL
  );
  if (valid.length) {
    const distinct = new Map(valid.map(pair => [pair.number + "/" + pair.total, pair]));
    if (distinct.size === 1) {
      const pair = [...distinct.values()][0];
      return { number: String(pair.number), total: String(pair.total), repaired: false };
    }
    return null;
  }

  // Only repair a three-digit impossible numerator when dropping its first
  // character yields a valid vintage pair. Do not guess from a plausible pair.
  const repairs = matches.map(match => ({
    rawNumber: match[1],
    number: Number(match[1].slice(1)),
    total: Number(match[2])
  })).filter(pair =>
    pair.rawNumber.length === 3 &&
    pair.number > 0 &&
    pair.number < pair.total &&
    pair.total <= MAX_VINTAGE_SET_TOTAL
  );
  const distinctRepairs = new Map(repairs.map(pair => [pair.number + "/" + pair.total, pair]));
  if (distinctRepairs.size === 1) {
    const pair = [...distinctRepairs.values()][0];
    return { number: String(pair.number), total: String(pair.total), repaired: true };
  }
  return null;
}

/**
 * End-to-end first-pass pipeline: locate one card, read the name/number, then
 * retrieve ranked local catalog candidates. It never auto-confirms a card.
 */
export async function recognizeCardPhoto({
  sourceCanvas,
  fullResolutionCanvas = sourceCanvas,
  language = "auto",
  catalog,
  onStage = null
}) {
  if (!catalog || typeof catalog.search !== "function") {
    throw new Error("Een geladen KantoCatalog is vereist.");
  }
  const detector = globalThis.KantoCardVision;
  if (!detector?.detect) {
    throw new Error("De lokale OpenCV-kaartdetector is niet geladen.");
  }
  onStage?.("Kaartcontour zoeken");
  const detection = await detector.detect(sourceCanvas, fullResolutionCanvas);
  if (!detection?.found) {
    return {
      status: "needs-better-photo",
      reason: detection?.reason ?? "Geen betrouwbare kaartcontour gevonden.",
      detection
    };
  }

  const languages = language === "auto" ? ["en", "ja"] : [language];
  const results = [];
  for (const currentLanguage of languages) {
    onStage?.(currentLanguage === "ja" ? "Japanse kaarttekst uitlezen" : "Engelse kaarttekst uitlezen");
    const ocr = await recognizeCardText(
      detection.canvas,
      currentLanguage,
      detection.numberCanvas ?? detection.canvas
    );
    const parsedNumber = parseCollectorNumber(ocr.numberText);
    const query = {
      name: ocr.nameText,
      collectorNumber: parsedNumber?.number ?? ""
    };

    onStage?.("Lokale " + (currentLanguage === "ja" ? "Japanse" : "Engelse") + " catalogus doorzoeken");
    let candidates = await catalog.search(currentLanguage, query, { limit: 30 });
    let numberFallbackUsed = false;
    if (!candidates.length && query.collectorNumber) {
      candidates = await catalog.search(currentLanguage, { name: query.name }, { limit: 30 });
      numberFallbackUsed = true;
    }
    results.push({ language: currentLanguage, ocr, parsedNumber, candidates, numberFallbackUsed });
  }

  const candidates = results.flatMap(result => result.candidates.map(candidate => ({
    ...candidate,
    language: result.language
  }))).sort((a, b) => b.score - a.score || a.record.recordId.localeCompare(b.record.recordId));

  return {
    status: candidates.length ? "candidate-review" : "no-candidates",
    detection: {
      confidence: detection.confidence ?? null,
      ratio: detection.ratio ?? null,
      method: detection.method ?? null
    },
    results,
    candidates: candidates.slice(0, 30),
    autoConfirmed: false
  };
}
