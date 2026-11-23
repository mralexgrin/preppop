// Clinical Shift: she rooms a fictional patient (Claude plays the patient),
// takes vitals, asks questions, reports to the doctor, then gets a debrief.
// Nothing is saved on the device or by PrepPop: the conversation lives only
// on this screen.

import { esc, plural } from "../util.js";
import { app, setTitle, view, announce } from "../ui.js";
import { shortcutsOn } from "../store.js";
import { shiftTurn, shiftDebrief, MODEL_LABEL } from "../ai.js";
import { SCENARIOS, CHECKLIST, MAX_TURNS, MAX_LINE, MAX_REPORT, CRISIS_NOTE, HELP_LINE, scenarioById, reportLine } from "../shift.js";

const MIN_TURNS_TO_REPORT = 2;
const PRIVACY = `Nothing is saved on your device or by PrepPop. What you type is sent to ${MODEL_LABEL} (Anthropic) to play the patient, so you don't need to use your real name.`;

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
        <div><h3>${esc(s.title)}</h3><p class="meta">${esc(s.brief)}</p></div>
        <a class="btn btn-primary" href="#/shift/${s.id}">Start<span class="visually-hidden">: ${esc(s.title)}</span></a>
      </li>`,
    ).join("")}</ul>
    <p class="hint shift-fine">The patients are made up, and ${MODEL_LABEL} plays them. It's practice, not medical advice: follow your instructor and clinical site. ${PRIVACY}</p>
    <p class="hint shift-fine">${HELP_LINE}</p>`;
}

export function renderShift(id) {
  const scenario = scenarioById(id);
  if (!scenario) return renderShiftList();
  setTitle(`Clinical Shift: ${scenario.title}`);
  // phase: chat | waiting | report | debriefing | debrief
  // transcript: her lines and the patient's, alternating. Patient lines keep the
  // service's signature, which it checks when they're sent back.
  const fresh = () => ({ phase: "chat", transcript: [], readings: [], crisis: false, error: "", failed: null, draft: "", report: "", debrief: null, checklistOpen: false });
  const s = fresh();
  let alive = true;
  let controller = null;
  const cancel = () => {
    controller?.abort();
    controller = null;
  };
  const turns = () => s.transcript.filter((l) => l.from === "student").length;
  const atLimit = () => turns() >= MAX_TURNS;

  const lineHTML = (l) =>
    l.from === "student"
      ? `<li class="shift-line you"><span class="visually-hidden">You: </span>${esc(l.text)}</li>`
      : `<li class="shift-line patient"><span class="visually-hidden">Patient: </span>${esc(l.text)}${l.readings.map((r) => `<span class="shift-reading">${esc(r)}</span>`).join("")}</li>`;

  // The page is drawn once per phase; while chatting only the log, readings,
  // and notices update, so the text box (and the phone keyboard) stays put.
  const draw = () => {
    if (s.phase === "debrief") return drawDebrief();
    app.innerHTML = `
      <header class="page-head">
        <div>
          <a class="back" href="#/shift">← Clinical Shift</a>
          <h1>${esc(scenario.title)}</h1>
          <p class="lede">${esc(scenario.brief)} You're the student clinical assistant. Go in and room the patient.</p>
        </div>
      </header>
      <details class="shift-checklist" ${s.checklistOpen ? "open" : ""}>
        <summary>What a good visit includes</summary>
        <ul>${CHECKLIST.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
      </details>
      <ol class="shift-log" aria-label="Your visit so far"></ol>
      <div id="shift-notices"></div>
      <div id="shift-controls"></div>
      <p class="source-tag">✦ The patient is played by ${MODEL_LABEL}. It's a made-up case for practice. ${PRIVACY}</p>
      <p class="source-tag">${HELP_LINE}</p>`;
    app.querySelector(".shift-checklist").addEventListener("toggle", (e) => (s.checklistOpen = e.target.open));
    update();
    drawControls();
  };

  const update = () => {
    const log = app.querySelector(".shift-log");
    if (!log) return;
    log.innerHTML = s.transcript.map(lineHTML).join("") || `<li class="shift-empty">You knock and walk into the exam room.</li>`;
    app.querySelector("#shift-notices").innerHTML = `
      ${s.crisis ? `<div class="notice ai shift-crisis" role="note"><span>${esc(CRISIS_NOTE)}</span><button class="text-btn" type="button" id="crisis-ok">OK</button></div>` : ""}
      ${s.readings.length ? `<section class="shift-readings" aria-labelledby="readings-h"><h2 id="readings-h">Your readings</h2><ul>${s.readings.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></section>` : ""}
      ${s.error ? `<div class="notice warn"><span>${esc(s.error)}</span> <button class="text-btn" type="button" id="retry">Try again</button></div>` : ""}`;
    app.querySelector("#crisis-ok")?.addEventListener("click", () => {
      s.crisis = false;
      update();
      (app.querySelector("#say") ?? app.querySelector("#report"))?.focus();
    });
    app.querySelector("#retry")?.addEventListener("click", () => (s.failed === "debrief" ? askDebrief() : send()));
    log.lastElementChild?.scrollIntoView({ block: "nearest" });
  };

  const drawControls = () => {
    const box = app.querySelector("#shift-controls");
    const waiting = s.phase === "waiting" || s.phase === "debriefing";
    const keys = shortcutsOn() && matchMedia("(hover: hover)").matches;
    if (s.phase === "report" || s.phase === "debriefing") {
      box.innerHTML = `
        ${atLimit() ? `<p class="shift-limit">That's the end of the visit. Now report to the doctor.</p>` : ""}
        <form class="shift-form" id="report-form" novalidate>
          <label class="field">
            <span class="field-label">What do you tell the doctor?</span>
            <textarea class="input" id="report" rows="5" maxlength="${MAX_REPORT}" aria-describedby="report-tip" ${waiting ? "readonly" : ""}>${esc(s.report)}</textarea>
          </label>
          <p class="hint" id="report-tip">Who the patient is, why they came in, the vital signs you took, and anything that worried you.</p>
          <div class="row">
            <button class="btn btn-primary" type="submit" ${waiting ? "disabled" : ""}>${waiting ? "Getting your feedback…" : "Send report and get feedback"}</button>
            ${waiting || atLimit() ? "" : `<button class="btn btn-ghost" type="button" id="back-to-patient">Back to the patient</button>`}
          </div>
        </form>`;
      const report = box.querySelector("#report");
      report.addEventListener("input", () => (s.report = report.value));
      box.querySelector("#report-form").addEventListener("submit", (e) => {
        e.preventDefault();
        sendReport();
      });
      box.querySelector("#back-to-patient")?.addEventListener("click", () => {
        setPhase("chat");
        app.querySelector("#say")?.focus();
      });
      return;
    }
    const left = MAX_TURNS - turns();
    const canReport = turns() >= MIN_TURNS_TO_REPORT;
    box.innerHTML = `
      <form class="shift-form" id="say-form" novalidate>
        <label class="field">
          <span class="field-label">What do you say or do?</span>
          <textarea class="input" id="say" rows="3" maxlength="${MAX_LINE}" enterkeyhint="send" aria-describedby="say-tip" placeholder="Hi, I'm the student assistant working with the doctor today. Could you tell me your full name and date of birth?">${esc(s.draft)}</textarea>
        </label>
        <p class="hint" id="say-tip">You can describe actions too, like "I wash my hands and take her temperature." Don't type your real name or other personal details.${keys ? " Enter sends; Shift+Enter starts a new line." : ""} <span id="left">${plural(left, "message")} left.</span></p>
        <div class="row">
          <button class="btn btn-primary" type="submit" id="send">Send</button>
          <button class="btn btn-soft" type="button" id="to-report" ${canReport ? "" : `disabled aria-describedby="report-when"`}>Finish: report to the doctor</button>
          ${canReport ? "" : `<span class="hint" id="report-when">After a couple of messages</span>`}
        </div>
      </form>`;
    const say = box.querySelector("#say");
    say.addEventListener("input", () => (s.draft = say.value));
    say.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        box.querySelector("#say-form").requestSubmit();
      }
    });
    box.querySelector("#say-form").addEventListener("submit", (e) => {
      e.preventDefault();
      send();
    });
    box.querySelector("#to-report").addEventListener("click", () => {
      setPhase("report");
      app.querySelector("#report")?.focus();
    });
    setWaiting(waiting);
  };

  // While the patient answers, the box stays (read-only) so the keyboard can stay open.
  const setWaiting = (waiting) => {
    const say = app.querySelector("#say");
    if (!say) return;
    say.readOnly = waiting;
    const send = app.querySelector("#send");
    send.disabled = waiting;
    send.textContent = waiting ? "The patient is answering…" : "Send";
    app.querySelector("#to-report").disabled = waiting || turns() < MIN_TURNS_TO_REPORT;
    const left = app.querySelector("#left");
    if (left) left.textContent = `${plural(MAX_TURNS - turns(), "message")} left.`;
  };

  const setPhase = (phase) => {
    const redraw = (phase === "report" || phase === "debriefing") !== (s.phase === "report" || s.phase === "debriefing") || phase === "debrief";
    s.phase = phase;
    s.error = "";
    s.failed = null;
    if (redraw) draw();
    else {
      update();
      if (s.phase === "chat" || s.phase === "waiting") setWaiting(s.phase === "waiting");
      else drawControls();
    }
  };

  const fail = (message, failed) => {
    s.error = message;
    s.failed = failed;
    update();
    app.querySelector("#retry")?.focus();
    announce(`${message} Try again.`);
  };

  const send = async () => {
    const text = (app.querySelector("#say")?.value ?? s.draft).trim();
    if (!text || s.phase !== "chat" || atLimit()) return;
    s.transcript.push({ from: "student", text: text.slice(0, MAX_LINE) });
    s.draft = "";
    const say = app.querySelector("#say");
    if (say) say.value = "";
    setPhase("waiting");
    announce("The patient is answering…");
    cancel();
    const ctrl = (controller = new AbortController());
    try {
      const reply = await shiftTurn({ scenario: scenario.id, transcript: wire() }, { signal: ctrl.signal });
      if (!alive) return;
      s.transcript.push({ from: "patient", text: reply.say, readings: reply.readings, sig: reply.sig });
      for (const r of reply.readings) if (!s.readings.includes(r)) s.readings.push(r);
      if (reply.crisis) s.crisis = true;
      setPhase(atLimit() ? "report" : "chat");
      announce(`Patient: ${reply.say}${reply.readings.length ? ` Reading: ${reply.readings.join("; ")}.` : ""}${reply.crisis ? ` ${CRISIS_NOTE}` : ""}${atLimit() ? " That's the end of the visit. Report to the doctor." : ""}`);
      app.querySelector(atLimit() ? "#report" : "#say")?.focus({ preventScroll: true });
      app.querySelector("#shift-controls")?.scrollIntoView({ block: "end" });
    } catch (err) {
      if (!alive || ctrl.signal.aborted) return;
      // Her unanswered line goes back in the box, so Try again (or Send) resends it.
      s.draft = s.transcript.pop().text;
      setPhase("chat");
      const say = app.querySelector("#say");
      if (say) say.value = s.draft;
      fail(`The patient couldn't answer: ${err.message}.`, "turn");
    }
  };

  const wire = () => s.transcript.map((l) => (l.from === "patient" ? { from: l.from, text: l.text, readings: l.readings, sig: l.sig } : { from: l.from, text: l.text }));

  const sendReport = () => {
    if (s.phase !== "report") return;
    s.report = app.querySelector("#report")?.value ?? s.report;
    if (!reportLine(s.report)) return app.querySelector("#report")?.focus();
    askDebrief();
  };

  // The report goes with the request; it's only part of the visit once the debrief comes back.
  const askDebrief = async () => {
    if (s.transcript.at(-1)?.from !== "patient") return;
    setPhase("debriefing");
    announce("Getting your feedback…");
    cancel();
    const ctrl = (controller = new AbortController());
    try {
      s.debrief = await shiftDebrief({ scenario: scenario.id, transcript: wire(), report: reportLine(s.report).slice(0, MAX_REPORT) }, { signal: ctrl.signal });
      if (!alive) return;
      if (s.debrief.crisis) s.crisis = true;
      setPhase("debrief");
      window.scrollTo(0, 0);
      app.querySelector("#debrief-h")?.focus();
      announce(`${s.debrief.summary}${s.crisis ? ` ${CRISIS_NOTE}` : ""}`);
    } catch (err) {
      if (!alive || ctrl.signal.aborted) return;
      setPhase("report");
      fail(`Couldn't get feedback: ${err.message}.`, "debrief");
    }
  };

  const section = (title, items, cls) =>
    items.length ? `<section class="shift-debrief-part ${cls}"><h3>${title}</h3><ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>` : "";

  const drawDebrief = () => {
    const d = s.debrief;
    app.innerHTML = `
      <header class="page-head">
        <div>
          <a class="back" href="#/shift">← Clinical Shift</a>
          <h1>${esc(scenario.title)}</h1>
        </div>
      </header>
      ${s.crisis ? `<div class="notice ai shift-crisis" role="note"><span>${esc(CRISIS_NOTE)}</span></div>` : ""}
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
      <details class="shift-checklist"><summary>See the whole visit</summary>
        <ol class="shift-log">${s.transcript.map(lineHTML).join("")}<li class="shift-line you"><span class="visually-hidden">Your report: </span>To the doctor: ${esc(reportLine(s.report))}</li></ol>
      </details>
      <p class="source-tag">✦ Feedback from ${MODEL_LABEL}. Double-check with your instructor.</p>
      <p class="source-tag">${HELP_LINE}</p>`;
    app.querySelector("#again").addEventListener("click", () => {
      Object.assign(s, fresh());
      draw();
      app.querySelector("#say")?.focus();
    });
  };

  const unsaved = () => s.phase !== "debrief" && (s.transcript.length > 0 || s.draft.trim() !== "");
  const onUnload = (e) => {
    if (unsaved()) e.preventDefault();
  };
  window.addEventListener("beforeunload", onUnload);
  view.leaveGuard = () => !unsaved() || confirm("Leave this visit? It isn't saved.");
  view.cleanup = () => {
    alive = false;
    cancel();
    window.removeEventListener("beforeunload", onUnload);
  };
  draw();
}
