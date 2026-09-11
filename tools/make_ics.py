#!/usr/bin/env python3
"""Build assets/ashford-serena-2027.ics — the guest 'add to calendar' file.

Four events: the weekend, the ceremony, and the two payment deadlines (each with a
week-prior reminder). Isla Serena is AST/UTC-4 year-round, so the ceremony carries a
fixed-offset VTIMEZONE — a guest sees their own local time at home and the true
5:00 PM once they land.

Re-run after any date change:  python3 tools/make_ics.py
"""

from urllib.parse import urlencode
from pathlib import Path

SITE = "https://meni-gottesman.github.io/isla-serena/"
STAMP = "20260711T120000Z"
TZ = "America/Antigua"
RESORT = "The Aurelia, Marisol Beach, Port Lucía, Isla Serena, West Indies"


def esc(text):
    """Escape a TEXT value per RFC 5545 §3.3.11."""
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def fold(line):
    """Fold to <=75 octets per line, continuations prefixed with one space."""
    raw = line.encode("utf-8")
    if len(raw) <= 75:
        return [line]
    out, cur = [], b""
    for ch in line:
        b = ch.encode("utf-8")
        # 75 octets for the first line, 74 + leading space for continuations
        limit = 75 if not out else 74
        if len(cur) + len(b) > limit:
            out.append(cur.decode("utf-8"))
            cur = b""
        cur += b
    if cur:
        out.append(cur.decode("utf-8"))
    return [out[0]] + [" " + s for s in out[1:]]


def event(uid, summary, description, location, start, end, timed=False, alarm=None, busy=False):
    lines = [
        "BEGIN:VEVENT",
        f"UID:{uid}@isla-serena.meni-gottesman.github.io",
        f"DTSTAMP:{STAMP}",
    ]
    if timed:
        lines += [f"DTSTART;TZID={TZ}:{start}", f"DTEND;TZID={TZ}:{end}"]
    else:
        lines += [f"DTSTART;VALUE=DATE:{start}", f"DTEND;VALUE=DATE:{end}"]
    lines += [
        f"SUMMARY:{esc(summary)}",
        f"DESCRIPTION:{esc(description)}",
        f"URL:{SITE}",
        f"TRANSP:{'OPAQUE' if busy else 'TRANSPARENT'}",
    ]
    if location:
        lines.append(f"LOCATION:{esc(location)}")
    if alarm:
        lines += [
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            f"TRIGGER:{alarm}",
            f"DESCRIPTION:{esc(summary)}",
            "END:VALARM",
        ]
    lines.append("END:VEVENT")
    return lines


cal = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Ashford Wedding//Isla Serena 2027//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Julian & Mara — Isla Serena 2027",
    # Isla Serena: Atlantic Standard Time, UTC-4, no daylight saving.
    "BEGIN:VTIMEZONE",
    f"TZID:{TZ}",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:-0400",
    "TZOFFSETTO:-0400",
    "TZNAME:AST",
    "END:STANDARD",
    "END:VTIMEZONE",
]

cal += event(
    "weekend-2027",
    "Julian & Mara's Wedding — Isla Serena",
    "The Ashford wedding at The Aurelia, Isla Serena.\n"
    "Arrive Thursday June 10 (check-in 3:00 PM) — depart Monday June 14 (check-out noon).\n"
    "Fly into Port Lucía (SRN). US passport required.\n"
    f"All the details: {SITE}",
    RESORT,
    "20270610",
    "20270615",
)

cal += event(
    "ceremony-2027",
    "The Ceremony — Julian & Mara",
    # The time is anchored to Isla Serena, so a guest still at home sees it converted to
    # their own zone. Spell it out so nobody mistakes that for the real hour.
    "5:00 PM island time (AST) — your calendar shows this in your local time zone "
    "until you land.\n"
    "Vows on the Sunset Lawn, with cocktails and dinner to follow.\n"
    "Dress: your best in black evening wear.\n"
    f"{SITE}",
    "Sunset Lawn, " + RESORT,
    "20270611T170000",
    "20270611T220000",
    timed=True,
    busy=True,
)

for uid, day, summary, note in [
    ("deposit-due", "20261201", "Room deposit due — Ashford wedding",
     "Deposit due to hold your room in the Reyes–Ashford Celebration block.\n"
     "The Aurelia, Isla Serena reservations: (555) 010-0170."),
    ("balance-due", "20270301", "Room balance due — Ashford wedding",
     "Balance due in full for the Aurelia, Isla Serena room block."),
]:
    # DTEND is exclusive for all-day events, so a one-day event ends the next day.
    end = str(int(day) + 1)
    cal += event(uid, summary, note + f"\n{SITE}", None, day, end, alarm="-P7D")

cal.append("END:VCALENDAR")

folded = []
for line in cal:
    folded.extend(fold(line))

# Relative to this script — an absolute home path broke when the project moved.
out = str(Path(__file__).resolve().parent.parent / "assets" / "ashford-serena-2027.ics")
with open(out, "w", newline="") as f:
    f.write("\r\n".join(folded) + "\r\n")

print(f"wrote {out}")
print(f"  {len(folded)} lines, {sum(1 for l in cal if l == 'BEGIN:VEVENT')} events")

# The Google Calendar template link for the weekend (used in the HTML).
google = "https://calendar.google.com/calendar/render?" + urlencode({
    "action": "TEMPLATE",
    "text": "Julian & Mara's Wedding — Isla Serena",
    "dates": "20270610/20270615",
    "details": "The Ashford wedding at The Aurelia, Isla Serena.\n"
               "Arrive Thu June 10, depart Mon June 14. Fly into Port Lucía (SRN).\n"
               f"All the details: {SITE}",
    "location": RESORT,
})
print("\nGoogle link:\n" + google)
