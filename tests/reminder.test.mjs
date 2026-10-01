import { test } from "node:test";
import assert from "node:assert/strict";
import { reminderIcs } from "../js/reminder.js";

test("makes a daily repeating event at the chosen local time", () => {
  const ics = reminderIcs("19:30", "2026-10-01", new Date(Date.UTC(2026, 8, 30, 12, 0, 0)));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /\r\nDTSTART:20261001T193000\r\n/);
  assert.match(ics, /\r\nRRULE:FREQ=DAILY\r\n/);
  assert.match(ics, /\r\nDTSTAMP:20260930T120000Z\r\n/);
  assert.match(ics, /BEGIN:VALARM[\s\S]*TRIGGER:PT0M[\s\S]*END:VALARM/);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});

test("rejects a bad time", () => {
  assert.throws(() => reminderIcs("25:00", "2026-10-01"));
});
