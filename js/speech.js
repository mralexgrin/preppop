// Read card text aloud with the device's built-in voices (free, offline).

import { subjectOf } from "./subjects.js";

export const canSpeak = () => "speechSynthesis" in globalThis && "SpeechSynthesisUtterance" in globalThis;

const SPANISH_HINT = /[ñáéíóúü¿¡]/i;

// Which language to read a side of a card in. Spanish decks read the term in
// Spanish; any side with Spanish letters is read in Spanish too.
export function langFor(deck, side, text) {
  const lang = subjectOf(deck).speech[side];
  if (deck?.subject === "spanish" && SPANISH_HINT.test(text)) return "es-ES";
  return lang;
}

export function speak(text, lang) {
  if (!canSpeak() || !text) return;
  const synth = globalThis.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = lang.startsWith("es") ? 0.9 : 1;
  const prefix = lang.split("-")[0];
  const voice = synth.getVoices().find((v) => v.lang === lang) ?? synth.getVoices().find((v) => v.lang?.startsWith(prefix));
  if (voice) utter.voice = voice;
  synth.speak(utter);
}

export const SPEAKER_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
