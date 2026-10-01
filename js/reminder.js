// A daily study reminder as a calendar event (.ics). Phones' calendar apps
// import it and handle the alert, so no server or push notifications are needed.

const APP_URL = "https://mralexgrin.github.io/preppop/";

// time: "HH:MM" (24h, local). startDay: "YYYY-MM-DD".
export function reminderIcs(time, startDay, now = new Date()) {
  const [h, m] = time.split(":").map(Number);
  if (!(h >= 0 && h < 24 && m >= 0 && m < 60)) throw new Error("bad time");
  const pad = (n) => String(n).padStart(2, "0");
  const start = `${startDay.replace(/-/g, "")}T${pad(h)}${pad(m)}00`;
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PrepPop//Study reminder//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:preppop-daily-study-reminder",
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    "DURATION:PT15M",
    "RRULE:FREQ=DAILY",
    "SUMMARY:Study with PrepPop",
    `DESCRIPTION:A few minutes a day: open PrepPop and tap Start review. ${APP_URL}`,
    `URL:${APP_URL}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Time for a quick PrepPop review",
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
