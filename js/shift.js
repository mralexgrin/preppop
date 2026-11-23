// Clinical Shift: practice rooming a fictional patient as a student clinical
// assistant. The scenarios' details (and the patient's vital signs) live in
// the answer service (worker/src/index.js, SCENARIOS); these are the titles
// and the short brief she sees. Ids and limits must match (checked in
// worker/test).

export const MAX_TURNS = 14; // her messages per shift, before the report
export const MAX_LINE = 400;
export const MAX_REPORT = 800;

export const SCENARIOS = [
  { id: "fever", title: "Fever and cough", brief: "An adult patient has been sick for a few days." },
  { id: "breathing", title: "Short of breath", brief: "An older patient says he gets winded on the stairs." },
  { id: "belly", title: "Stomach pain", brief: "A teenager came in with his mom because his stomach hurts." },
];

export const scenarioById = (id) => SCENARIOS.find((s) => s.id === id) ?? null;

// What a good visit includes, shown as a checklist she can open.
export const CHECKLIST = [
  "Clean your hands and introduce yourself (a first name or \"the student assistant\" is fine)",
  "Check two identifiers: full name and date of birth",
  "Explain what you're going to do before you do it",
  "Ask why they came in: when it started, where, how bad (0 to 10), what makes it better or worse",
  "Take vital signs: temperature, pulse, breathing rate, blood pressure, oxygen saturation, pain",
  "Ask about allergies and current medicines",
  "Keep them comfortable and their information private",
  "Report to the doctor, especially anything abnormal",
];

// Fixed wording, shown when the service thinks something she wrote may be
// about a real problem in her own life (and always on the Clinical Shift
// pages, in short form). Reviewed text, never written by the model.
export const CRISIS_NOTE =
  "This is just practice. If something real is going on, please talk to a trusted adult, like a parent, teacher, or school counselor. In an emergency, call 911. You can call or text 988 (the 988 Suicide & Crisis Lifeline) any time.";
export const HELP_LINE = "If something real is going on, talk to a trusted adult. Emergency: 911. Call or text 988 any time.";

export const reportLine = (text) => text.trim();
