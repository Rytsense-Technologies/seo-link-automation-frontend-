/**
 * Splits a backend `reason` into the plain-language explanation and the scoring signals the
 * deterministic generator appends, e.g.
 *
 *   'The source sentence already mentions "X", which matches the target page\'s title.
 *    Strongest deterministic signals: content_h1 0.74, slug_similarity 0.70, phrase_overlap 0.59.'
 *
 * Only that exact shape is split; any other reason (for example one written by an AI provider)
 * comes back whole as the explanation with no signals, so nothing is ever lost or reworded.
 * Signal values are passed through as the backend wrote them.
 */
const SIGNALS_PATTERN = /^([\s\S]*?)\s*Strongest(?: \w+)? signals:\s*([\s\S]+?)\.?\s*$/;
const SIGNAL_PATTERN = /^([a-z][a-z0-9_]*)\s+(-?\d+(?:\.\d+)?)$/i;

/** "content_h1" -> "Content H1", "slug_similarity" -> "Slug similarity". */
export function signalLabel(name) {
  const words = name.split("_").map((word) => (/^h\d$/i.test(word) ? word.toUpperCase() : word));
  const label = words.join(" ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function splitReason(reason) {
  const text = reason ?? "";
  const match = text.match(SIGNALS_PATTERN);
  if (!match) return { explanation: text.trim(), signals: [] };

  const signals = [];
  for (const part of match[2].split(/,\s*/)) {
    const signal = part.trim().match(SIGNAL_PATTERN);
    if (!signal) return { explanation: text.trim(), signals: [] };
    signals.push({ name: signal[1], label: signalLabel(signal[1]), value: signal[2] });
  }
  return { explanation: match[1].trim(), signals };
}
