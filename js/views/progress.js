// Progress: streaks, a practice calendar, this week's numbers, mastery by
// subject, what's coming up, and the cards she misses most.

import { state, dailyGoal } from "../store.js";
import { esc, plural } from "../util.js";
import { app, setTitle } from "../ui.js";
import { dayKey, streak } from "../srs.js";
import { longestStreak, weekSummary, calendar, subjectMastery, weakCards, upcoming } from "../progress.js";

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
    <header class="page-head"><div><h1>Progress</h1><p class="lede">Daily goal: ${plural(dailyGoal(), "card")}. <a href="#/settings">Change</a></p></div></header>

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
}
