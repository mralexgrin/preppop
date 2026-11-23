// Clinical Shift: she rooms a fictional patient (Claude plays the patient),
// takes vitals, asks questions, reports to the doctor, then gets a debrief.
// Nothing is saved: the conversation lives only on this screen.

import { esc, plural } from "../util.js";
import { app, setTitle, view, announce } from "../ui.js";
import { shiftTurn, shiftDebrief, MODEL_LABEL } from "../ai.js";
import { SCENARIOS, CHECKLIST, MAX_TURNS, MAX_LINE, scenarioById, reportLine } from "../shift.js";

const MIN_TURNS_TO_REPORT = 2;

export function renderShiftList() {
  setTitle("Clinical Shift");
  app.innerHTML = `
    <header class="page-head">
      <div>
        <a class="back" href="#/">← Decks</a>
        <h1>Clinical Shift</h1>
        <p class="lede">Practice rooming a patient the way you will alongside a doctor: introduce yourself, check who they are, take vital signs, ask about their symptoms, and report to the doctor. Then get feedback on how it went.</p>
      </div>
    </header>
    <ul class="deck-grid shift-list">${SCENARIOS.map(
      (s) => `
      <li class="deck-tile" data-subject="clinical">
        <h2 class="tile-title">${esc(s.title)}</h2>
        <p class="meta">${esc(s.brief)}</p>
        <a class="btn btn-primary" href="#/shift/${s.id}">Start</a>
      </li>`,
    ).join("")}</ul>
    <p class="hint shift-fine">The patients are made up, and ${MODEL_LABEL} plays them. It's practice, not medical advice: follow your instructor and clinical site. Nothing you type here is saved.</p>`;
}

export function renderShift(id) {
  const scenario = scenarioById(id);
  if (!scenario) return renderShiftList();
  setTitle(`Clinical Shift: ${scenario.title}`);
  // phase: chat | waiting | report | debriefing | debrief
  const s = { phase: "chat", transcript: [], readings: [], aside: "", error: "", draft: "", report: "", debrief: null };
  let alive = true;
  let controller = null;
  const cancel = () => {
    controller?.abort();
    controller = null;
  };
  const turns = () => s.transcript.filter((l) => l.from === "student").length;

  const header = `
    <header class="page-head">
      <div>
        <a class="back" href="#/shift">← Clinical Shift</a>
        <h1>${esc(scenario.title)}</h1>
        <p class="lede">${esc(scenario.brief)} You're the student clinical assistant. Go in and room the patient.</p>
      </div>
    </header>`;

  const checklist = `
    <details class="shift-checklist">
      <summary>What a good visit includes</summary>
      <ul>${CHECKLIST.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
    </details>`;

  const lineHTML = (l) =>
    l.from === "student"
      ? `<li class="shift-line you"><span class="visually-hidden">You: </span>${esc(l.text)}</li>`
      : `<li class="shift-line patient"><span class="visually-hidden">Patient: </span>${esc(l.text)}${l.reading ? `<span class="shift-reading">${esc(l.reading)}</span>` : ""}</li>`;

  const draw = () => {
    if (s.phase === "debrief") return drawDebrief();
    const waiting = s.phase === "waiting" || s.phase === "debriefing";
    const left = MAX_TURNS - turns();
    let controls;
    if (s.phase === "report" || s.phase === "debriefing") {
      controls = `
        <form class="shift-form" id="report-form" novalidate>
          <label class="field">
            <span class="field-label">What do you tell the doctor?</span>
            <textarea class="input" id="report" rows="4" maxlength="${MAX_LINE}" aria-describedby="report-tip" ${waiting ? "disabled" : ""}>${esc(s.report)}</textarea>
          </label>
          <p class="hint" id="report-tip">Who the patient is, why they came in, the vital signs you took, and anything that worried you.</p>
          <div class="row">
            <button class="btn btn-primary" type="submit" ${waiting ? "disabled" : ""}>${waiting ? "Getting your feedback…" : "Send report and get feedback"}</button>
            ${waiting ? "" : `<button class="btn btn-ghost" type="button" id="back-to-patient" ${left > 0 ? "" : "hidden"}>Back to the patient</button>`}
          </div>
        </form>`;
    } else {
      controls = `
        <form class="shift-form" id="say-form" novalidate>
          <label class="field">
            <span class="field-label">What do you say or do?</span>
            <textarea class="input" id="say" rows="3" maxlength="${MAX_LINE}" aria-describedby="say-tip" placeholder="Hi, I'm a student assistant working with the doctor today. Could you tell me your full name and date of birth?" ${waiting ? "disabled" : ""}>${esc(s.draft)}</textarea>
          </label>
          <p class="hint" id="say-tip">Enter sends; Shift+Enter starts a new line. You can describe actions too, like "I wash my hands and take her temperature." ${plural(left, "message")} left.</p>
          <div class="row">
            <button class="btn btn-primary" type="submit" ${waiting ? "disabled" : ""}>${waiting ? "The patient is answering…" : "Send"}</button>
            <button class="btn btn-soft" type="button" id="to-report" ${turns() >= MIN_TURNS_TO_REPORT && !waiting ? "" : "disabled"}>Finish: report to the doctor</button>
          </div>
        </form>`;
    }

    app.innerHTML = `${header}
      ${checklist}
      <ol class="shift-log" aria-label="Your visit so far">${s.transcript.map(lineHTML).join("") || `<li class="shift-empty">You knock and walk into the exam room.</li>`}</ol>
      ${s.aside ? `<div class="notice ai shift-aside" role="note"><span>${esc(s.aside)}</span></div>` : ""}
      ${s.readings.length ? `<section class="shift-readings" aria-labelledby="readings-h"><h2 id="readings-h">Your readings</h2><ul>${s.readings.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></section>` : ""}
      ${s.error ? `<div class="notice warn" role="alert">${esc(s.error)} <button class="text-btn" type="button" id="retry">Try again</button></div>` : ""}
      ${controls}
      <p class="source-tag">✦ The patient is played by ${MODEL_LABEL}. It's a made-up case for practice.</p>`;

    const log = app.querySelector(".shift-log");
    log.lastElementChild?.scrollIntoView({ block: "nearest" });
    bind();
  };

  const bind = () => {
    const say = app.querySelector("#say");
    if (say) {
      say.addEventListener("input", () => (s.draft = say.value));
      say.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          app.querySelector("#say-form").requestSubmit();
        }
      });
      app.querySelector("#say-form").addEventListener("submit", (e) => {
        e.preventDefault();
        send();
      });
      app.querySelector("#to-report").addEventListener("click", () => {
        s.phase = "report";
        draw();
        app.querySelector("#report")?.focus();
      });
      if (s.phase === "chat") say.focus({ preventScroll: true });
    }
    const report = app.querySelector("#report");
    if (report) {
      report.addEventListener("input", () => (s.report = report.value));
      app.querySelector("#report-form").addEventListener("submit", (e) => {
        e.preventDefault();
        sendReport();
      });
      app.querySelector("#back-to-patient")?.addEventListener("click", () => {
        s.phase = "chat";
        draw();
      });
    }
    app.querySelector("#retry")?.addEventListener("click", () => (s.transcript.at(-1)?.report ? askDebrief() : askPatient()));
  };

  const send = () => {
    const text = s.draft.trim();
    if (!text || s.phase !== "chat") return;
    s.transcript.push({ from: "student", text: text.slice(0, MAX_LINE) });
    s.draft = "";
    askPatient();
  };

  const wire = (lines) => lines.map(({ from, text }) => ({ from, text }));

  const askPatient = async () => {
    s.phase = "waiting";
    s.error = "";
    draw();
    announce("The patient is answering…");
    cancel();
    const ctrl = (controller = new AbortController());
    try {
      const reply = await shiftTurn({ scenario: scenario.id, transcript: wire(s.transcript) }, { signal: ctrl.signal });
      if (!alive) return;
      s.transcript.push({ from: "patient", text: reply.say, reading: reply.reading });
      if (reply.reading) s.readings.push(reply.reading);
      s.aside = reply.aside;
      s.phase = turns() >= MAX_TURNS ? "report" : "chat";
      draw();
      announce(`Patient: ${reply.say}${reply.reading ? ` Reading: ${reply.reading}` : ""}${reply.aside ? ` Note: ${reply.aside}` : ""}${s.phase === "report" ? " That's the end of the visit. Report to the doctor." : ""}`);
      (app.querySelector("#say") ?? app.querySelector("#report"))?.focus({ preventScroll: true });
    } catch (err) {
      if (!alive || ctrl.signal.aborted) return;
      s.error = `The patient couldn't answer: ${err.message}.`;
      s.phase = "chat";
      // Her line stays in the conversation; Try again asks the patient again.
      draw();
      app.querySelector("#retry")?.focus();
    }
  };

  const sendReport = () => {
    const text = s.report.trim();
    if (!text) return app.querySelector("#report")?.focus();
    s.transcript.push({ from: "student", text: reportLine(text).slice(0, MAX_LINE), report: true });
    askDebrief();
  };

  const askDebrief = async () => {
    s.phase = "debriefing";
    s.error = "";
    draw();
    announce("Getting your feedback…");
    cancel();
    const ctrl = (controller = new AbortController());
    try {
      s.debrief = await shiftDebrief({ scenario: scenario.id, transcript: wire(s.transcript) }, { signal: ctrl.signal });
      if (!alive) return;
      s.phase = "debrief";
      draw();
      window.scrollTo(0, 0);
      app.querySelector("#debrief-h")?.focus();
      announce(s.debrief.summary);
    } catch (err) {
      if (!alive || ctrl.signal.aborted) return;
      s.error = `Couldn't get feedback: ${err.message}.`;
      s.phase = "report";
      draw();
      app.querySelector("#retry")?.focus();
    }
  };

  const section = (title, items, cls) =>
    items.length ? `<section class="shift-debrief-part ${cls}"><h3>${title}</h3><ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>` : "";

  const drawDebrief = () => {
    const d = s.debrief;
    app.innerHTML = `${header}
      <section class="panel wide shift-debrief" aria-labelledby="debrief-h">
        <h2 id="debrief-h" tabindex="-1">How it went</h2>
        <p class="teach-summary">${esc(d.summary)}</p>
        ${section("You did well", d.didWell, "got")}
        ${section("Next time", d.missed, "missing")}
        ${section("Findings for the doctor", d.toReport, "report")}
        ${section("Terms you used", d.terms, "terms")}
        ${d.note ? `<section class="shift-debrief-part"><h3>How you could chart it</h3><pre class="shift-note">${esc(d.note)}</pre></section>` : ""}
        <div class="row">
          <a class="btn btn-primary" href="#/shift">Try another patient</a>
          <button class="btn btn-soft" type="button" id="again">Practice this one again</button>
        </div>
      </section>
      <details class="shift-checklist"><summary>See the whole visit</summary><ol class="shift-log">${s.transcript.map(lineHTML).join("")}</ol></details>
      <p class="source-tag">✦ Feedback from ${MODEL_LABEL}. Double-check with your instructor.</p>`;
    app.querySelector("#again").addEventListener("click", () => {
      Object.assign(s, { phase: "chat", transcript: [], readings: [], aside: "", error: "", draft: "", report: "", debrief: null });
      draw();
    });
  };

  view.leaveGuard = () => s.phase === "debrief" || !s.transcript.length || confirm("Leave this visit? It isn't saved.");
  view.cleanup = () => {
    alive = false;
    cancel();
  };
  draw();
}
