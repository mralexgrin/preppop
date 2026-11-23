// Progress: streaks, a practice calendar, this week's numbers, tests coming
// up and how ready she is, mastery by subject, what's coming up, and the cards
// she misses most.

import { state, dailyGoal } from "../store.js";
import { esc, plural } from "../util.js";
import { app, setTitle, toast, examLabel } from "../ui.js";
import { dayKey, streak, addDays } from "../srs.js";
import { longestStreak, weekSummary, calendar, subjectMastery, weakCards, upcoming, progressSummary, calibration, isOverconfident, blindSpots } from "../progress.js";
import { mixupPairs } from "../mixups.js";
import { forecast, readinessText, pct } from "../readiness.js";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function renderProgress() {
  setTitle("Progress");
  const today = dayKey();
  const current = streak(state.activity, today);
  const best = Math.max(current, longestStreak(state.activity));
  const week = weekSummary(state.activity, today);
  const cells = calendar(state.activity, today, 12);
  const mastery = subjectMastery(state.decks);
  const weak = weakCards(state.decks);
  const next = upcoming(state.decks, today);
  const practicedDays = cells.filter((c) => c.count > 0).length;
  const sureness = calibration(state.decks);
  const blind = blindSpots(state.decks);
  const pairs = mixupPairs(state.decks);

  if (!state.decks.length) {
    app.innerHTML = `
      <header class="page-head"><div><h1>Progress</h1></div></header>
      <section class="result">
        <p class="sub">Your streak, practice calendar, and progress in each subject show up here once you start studying.</p>
        <div class="actions"><a class="btn btn-primary" href="#/starters">Browse starter decks</a></div>
      </section>`;
    return;
  }

  const fmt = (day) => {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  };

  app.innerHTML = `
    <header class="page-head">
      <div><h1>Progress</h1><p class="lede">Daily goal: ${plural(dailyGoal(), "card")}. <a href="#/settings">Change</a></p></div>
      <button class="btn btn-soft" type="button" id="share-progress">Share my progress</button>
    </header>

    <section class="stat-grid" aria-label="Summary">
      <div class="stat"><strong>${current}</strong><span>day streak</span></div>
      <div class="stat"><strong>${best}</strong><span>best streak</span></div>
      <div class="stat"><strong>${week.answered}</strong><span>cards this week</span></div>
      <div class="stat"><strong>${week.accuracy === null ? "–" : `${week.accuracy}%`}</strong><span>right this week</span></div>
    </section>

    <section class="panel wide" aria-labelledby="cal-heading">
      <h2 id="cal-heading">Last 12 weeks</h2>
      <p>You practiced on ${plural(practicedDays, "day")} in the last 12 weeks.</p>
      <div class="cal-wrap">
        <div class="cal-days" aria-hidden="true">${WEEKDAYS.map((d) => `<span>${d}</span>`).join("")}</div>
        <div class="cal" role="img" aria-label="Practice calendar: ${plural(practicedDays, "day")} with practice in the last 12 weeks">
          ${cells
            .map((c) => `<span class="cal-cell l${c.level}" title="${c.level < 0 ? "" : `${esc(fmt(c.day))}: ${plural(c.count, "card")}`}"></span>`)
            .join("")}
        </div>
      </div>
      <ul class="visually-hidden">${cells
        .filter((c) => c.count > 0)
        .map((c) => `<li>${esc(fmt(c.day))}: ${plural(c.count, "card")}</li>`)
        .join("")}</ul>
      <p class="cal-legend" aria-hidden="true">Less <span class="cal-cell l0"></span><span class="cal-cell l1"></span><span class="cal-cell l2"></span><span class="cal-cell l3"></span><span class="cal-cell l4"></span> More</p>
    </section>

    <section class="panel wide" aria-labelledby="upcoming-heading">
      <h2 id="upcoming-heading">Coming up</h2>
      <ul class="upcoming">
        <li><strong>${next.today}</strong> due today</li>
        <li><strong>${next.tomorrow}</strong> by tomorrow</li>
        <li><strong>${next.week}</strong> within a week</li>
      </ul>
      ${next.today ? `<div class="row"><a class="btn btn-primary" href="#/review">Review ${plural(next.today, "card")} now</a></div>` : ""}
    </section>

    ${
      mastery.length
        ? `<section class="panel wide" aria-labelledby="mastery-heading">
            <h2 id="mastery-heading">By subject</h2>
            <ul class="mastery">${mastery
              .map(
                (m) => `
              <li data-subject="${m.subject.id}">
                <div class="mastery-head"><span><span class="subject-dot" aria-hidden="true"></span>${m.subject.name}</span><span>${m.known} of ${plural(m.total, "card")} known</span></div>
                <div class="meter" role="img" aria-label="${m.pct}% known">
                  <span class="m-know" style="width:${(m.known / m.total) * 100}%"></span>
                  <span class="m-learn" style="width:${(m.learning / m.total) * 100}%"></span>
                </div>
              </li>`,
              )
              .join("")}</ul>
          </section>`
        : ""
    }

    ${testsPanel(today)}
    ${confidencePanel(sureness, blind)}
    ${mixupPanel(pairs)}

    <section class="panel wide" aria-labelledby="weak-heading">
      <h2 id="weak-heading">Cards to work on</h2>
      ${
        weak.length
          ? `<p>The cards you've missed most and haven't learned yet. They're already in your review schedule.</p>
             <ul class="weak">${weak
               .map(
                 ({ deck, card }) => `
               <li data-subject="${deck.subject}">
                 <p class="m-prompt">${esc(card.term)}</p>
                 <p class="weak-def">${esc(card.definition)}</p>
                 <p class="weak-meta"><span class="subject-dot" aria-hidden="true"></span>${esc(deck.name)} · missed ${card.stats.missed} of ${card.stats.seen}</p>
               </li>`,
               )
               .join("")}</ul>`
          : `<p>Nothing yet. Cards you miss in Flashcards, Review, Write, or Test will show up here.</p>`
      }
    </section>`;

  app.querySelector("#share-progress").addEventListener("click", async () => {
    const text = progressSummary({ streakDays: current, week, mastery, next });
    if (navigator.share) {
      try {
        await navigator.share({ title: "My PrepPop progress", text });
        return;
      } catch (err) {
        if (err?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast("Progress copied. Paste it in a message.");
    } catch {
      toast("Couldn't share or copy on this device.");
    }
  });
}

// How often she's right when she says she's sure, per subject, and the cards
// she was sure about but got wrong. Shown once she's used the confidence check.
function confidencePanel(sureness, blind) {
  if (!sureness.length) return "";
  const fmtPct = (n) => (n === null ? "–" : `${n}%`);
  return `
    <section class="panel wide" aria-labelledby="confidence-heading">
      <h2 id="confidence-heading">How sure vs. how right</h2>
      <p>From Test mode's confidence check. When you're sure, you should be right about 9 times in 10.</p>
      <ul class="calibration">${sureness
        .map(
          (c) => `
        <li data-subject="${c.subject.id}">
          <p class="mastery-head"><span><span class="subject-dot" aria-hidden="true"></span>${c.subject.name}</span></p>
          <p class="calib-line">${[
            c.sure ? `When sure: <strong>${fmtPct(c.surePct)}</strong> right <span class="calib-n">(${plural(c.sure, "answer")})</span>` : "",
            c.guess ? `When guessing: <strong>${fmtPct(c.guessPct)}</strong> right <span class="calib-n">(${plural(c.guess, "answer")})</span>` : "",
          ].filter(Boolean).join(" · ")}</p>
          ${isOverconfident(c) ? `<p class="calib-warn">You're often sure and wrong here. Slow down and check before you lock in.</p>` : ""}
        </li>`,
        )
        .join("")}</ul>
      ${
        blind.length
          ? `<h3 class="sub-heading">Blind spots</h3>
             <p>Cards you were sure about but got wrong. They're back in your review.</p>
             <ul class="weak">${blind
               .map(
                 ({ deck, card }) => `
               <li data-subject="${deck.subject}">
                 <p class="m-prompt">${esc(card.term)}</p>
                 <p class="weak-def">${esc(card.definition)}</p>
                 <p class="weak-meta"><span class="subject-dot" aria-hidden="true"></span>${esc(deck.name)} · sure but wrong ${card.stats.sureMissed === 1 ? "once" : `${card.stats.sureMissed} times`}</p>
               </li>`,
               )
               .join("")}</ul>`
          : ""
      }
    </section>`;
}

function mixupPanel(pairs) {
  if (!pairs.length) return "";
  const top = pairs.slice(0, 3);
  return `
    <section class="panel wide" aria-labelledby="mixups-heading">
      <h2 id="mixups-heading">Mix-ups</h2>
      <p>${plural(pairs.length, "pair")} of cards you've given each other's answers for.</p>
      <ul class="mixup-mini">${top
        .map(({ deck, a, b }) => `<li data-subject="${deck.subject}"><span class="subject-dot" aria-hidden="true"></span><strong>${esc(a.term)}</strong> <span class="mixup-vs">vs</span> <strong>${esc(b.term)}</strong></li>`)
        .join("")}</ul>
      <div class="row"><a class="btn btn-primary" href="#/mixups">Practice telling them apart</a></div>
    </section>`;
}

// Tests in the next 30 days: how ready she is and what daily practice gets her there.
function testsPanel(today) {
  const tests = state.decks
    .filter((d) => d.examDate && d.examDate >= today && d.examDate <= addDays(today, 30) && d.cards.length)
    .sort((a, b) => a.examDate.localeCompare(b.examDate));
  if (!tests.length) return "";
  return `
    <section class="panel wide" aria-labelledby="tests-heading">
      <h2 id="tests-heading">Tests coming up</h2>
      <ul class="tests">${tests
        .map((deck) => {
          const f = forecast(deck, today);
          return `
        <li data-subject="${deck.subject}">
          <div class="mastery-head"><span><span class="subject-dot" aria-hidden="true"></span>${esc(deck.name)}</span><span>${examLabel(deck.examDate, today)}</span></div>
          <div class="meter" aria-hidden="true"><span class="m-know" style="width:${pct(f.now)}%"></span></div>
          <p class="readiness-line">${readinessText(f)}</p>
          <div class="row"><a class="btn btn-soft" href="#/deck/${deck.id}/study/cram">Cram<span class="visually-hidden"> ${esc(deck.name)}</span></a><a class="btn btn-ghost" href="#/deck/${deck.id}/test">Practice test<span class="visually-hidden">: ${esc(deck.name)}</span></a></div>
        </li>`;
        })
        .join("")}</ul>
      <p class="hint">An estimate from your practice so far, assuming you get most reviews right. It's a guide, not a grade. <a href="#/help">How it works</a></p>
    </section>`;
}
