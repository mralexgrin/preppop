// Clinical Shift: practice rooming a fictional patient as a student clinical
// assistant. The scenarios' details (and the patient's vital signs) live in
// the answer service (worker/src/index.js, SCENARIOS); these are the titles
// and the short brief she sees. Ids must match.

export const MAX_TURNS = 14; // her messages per shift, same as the service
export const MAX_LINE = 400;

export const SCENARIOS = [
  { id: "fever", title: "Fever and cough", brief: "An adult patient has been sick for a few days." },
  { id: "breathing", title: "Short of breath", brief: "An older patient says he gets winded on the stairs." },
  { id: "belly", title: "Stomach pain", brief: "A teenager came in with his mom because his stomach hurts." },
];

export const scenarioById = (id) => SCENARIOS.find((s) => s.id === id) ?? null;

// What a good visit includes, shown as a checklist she can open.
export const CHECKLIST = [
  "Clean your hands and introduce yourself",
  "Check two identifiers: full name and date of birth",
  "Explain what you're going to do before you do it",
  "Ask why they came in: when it started, where, how bad (0 to 10), what makes it better or worse",
  "Take vital signs: temperature, pulse, breathing rate, blood pressure, oxygen saturation, pain",
  "Ask about allergies and current medicines",
  "Keep them comfortable and their information private",
  "Report to the doctor, especially anything abnormal",
];

// The report she gives the doctor is sent as her last line, marked so the
// debrief knows it's the report.
export const reportLine = (text) => `(Reporting to the doctor) ${text.trim()}`;
