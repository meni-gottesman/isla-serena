# Nevis Affair — a destination-wedding website

An editorial, cinematic wedding site: an opening film you tap to open, a
score that carries through the visit, a lookbook dress code, a working RSVP
with a public guest list, and a password-gated Hosts panel for the couple.

**Live:** https://meni-gottesman.github.io/nevis-affair/

> This is a portfolio copy. The couple, the guests, the contacts and the
> registry are fictional, and the RSVP is disconnected — replies stay in your
> own browser and go nowhere. The photography is used with permission.

## What's in it

- **Opening film** — a wax-seal envelope that opens on tap. The score is baked
  into the film's own audio track, which is the only way a phone will reliably
  play it: iOS mutes a separate `<audio>` element with the Ring/Silent switch,
  and may never grant playback to a hidden one at all.
- **Score that loops** without ever reaching the track's fade-out — it turns
  over at a beat-aligned point (96 BPM, twenty bars in) so the music just keeps
  going.
- **Dress code lookbook** — twelve full-length looks cut to a common scale and
  baseline, butted together so they read as one lined-up photograph, each still
  its own tappable tile.
- **RSVP** with companions, a wedding-song prompt, a photo and a one-line bio,
  and a public "who's coming" list that unlocks once you've replied.
- **Hosts panel** (`/admin/`) — counts, search, filter, per-guest editing,
  inline remove-confirm, CSV export. In this copy any password opens it.
- **Add to calendar** — a hand-built RFC 5545 `.ics` (fixed-offset VTIMEZONE,
  75-octet folding, `download=` so iOS offers "Add All") plus a Google
  Calendar link.
- Clean URLs, a 404 page, focus containment with `inert`, a no-JS fallback,
  reduced-motion support, and a real dark theme rather than a swapped palette.

## Stack

Static HTML/CSS/JS, no framework, no build step. Hosted on GitHub Pages.
The production build talks to a Google Apps Script web app over a Google
Sheet the couple own (`rsvp-backend.gs` — the password is checked on
Google's servers, never in the page); this copy runs in demo mode with a
seeded fictional guest list.

## Running it

It's a static site under a `/nevis-affair/` base path, so serve the *parent*
directory and open `http://localhost:8000/nevis-affair/`:

```bash
cd .. && python3 -m http.server 8000
```

`tools/make_ics.py` regenerates the calendar file and prints the matching
Google Calendar link.

---
Design and build by [Meni Gottesman](https://menigottesman.com).
