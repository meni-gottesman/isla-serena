/* ============================================================================
   ISLA SERENA AFFAIR — interactions
   ========================================================================== */
(function () {
  "use strict";
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

  /* ---------- FOCUS CONTAINMENT ----------
     `inert` on the background siblings makes everything outside the active
     overlay non-focusable, giving a native focus trap with no Tab handler. */
  const body = document.body;
  // Bring `active` to the front and make everything else unreachable.
  // The active element must be un-inerted, not merely skipped: these layers
  // stack. The opening film inerts the whole page, so a guest arriving straight
  // at /#admin had the Hosts panel opened on top of a film that had already
  // marked it inert — the password field rendered fine but could not be clicked
  // or focused at all. Skipping it left that stale inert in place.
  function lockBackground(active) {
    Array.from(body.children).forEach((el) => {
      if (el === active || el.tagName === "SCRIPT") { el.removeAttribute("inert"); return; }
      el.setAttribute("inert", "");
    });
  }
  // Closing a layer must not expose the page when the opening film is still
  // sealing it — restore the film's lock in that case.
  function unlockBackground() {
    Array.from(body.children).forEach((el) => el.removeAttribute("inert"));
    if (body.classList.contains("is-sealed")) {
      const g = document.getElementById("gate");
      if (g) lockBackground(g);
    }
  }

  /* ---------- ENTRY GATE (home page only) — the opening film ----------
     The couple's "J&M" wax-heart envelope. It plays ONLY on a tap (poster +
     "Tap to open" until then), with the film's own letter-opening sound, blooms
     to white, and the site fades in from white. As the film ends, that sound
     crossfades into the looping ambient track. Phones get a more zoomed-out
     portrait cut. Audio is ON by default (a prior mute is respected). */
  const gate = $("#gate");
  const gateVideo = $("#gateVideo");
  let opened = false;

  if (gate && gateVideo) {
    var exitGate = function (focusTarget) {
      if (opened) return;
      opened = true;
      gate.classList.add("is-open");
      body.classList.remove("is-sealed");
      body.classList.add("entered");
      unlockBackground();
      try { sessionStorage.setItem("serena_entered", "1"); } catch (e) {}
      // The browser chrome was tinted to the envelope's navy so the film met the
      // screen edges; hand it back to the site's colour now that the site is here.
      try {
        const tc = $("#themeColor");
        if (tc) tc.setAttribute("content", "#191512");
      } catch (e) {}
      // The film is deliberately NOT paused: it carries the score, which plays on
      // for ~a minute after the picture ends. iOS only keeps a media element
      // playing while it stays rendered, so once the overlay has faded we shrink
      // it to a 1px sliver (.is-done) instead of hiding it.
      window.setTimeout(function () { gate.classList.add("is-done"); }, 1600);
      // It stays in the DOM for the score, so stop presenting it as an open modal —
      // otherwise screen readers treat the whole site as outside a live dialog.
      try {
        gate.removeAttribute("role");
        gate.removeAttribute("aria-modal");
        gate.removeAttribute("tabindex");
        gate.setAttribute("aria-hidden", "true");
      } catch (e) {}
      const t = focusTarget || $("#top");
      if (t) t.focus({ preventScroll: true });
    };

    // The picture ends here; the element plays on, carrying the score.
    const FILM_END = 7.0;

    let returning = false;
    try { returning = sessionStorage.getItem("serena_entered") === "1"; } catch (e) {}

    if (returning) {
      gate.classList.add("is-instant");
      exitGate();
    } else if (prefersReduced) {
      // Honour reduced motion: hold on the sealed poster and enter on the tap
      // without the film — but still start the element so the score plays.
      lockBackground(gate);
      gate.addEventListener("click", function () {
        applyAudioPref();
        const p = gateVideo.play(); if (p && p.catch) p.catch(function () {});
        exitGate();
      });
    } else {
      lockBackground(gate);
      let clicked = false, watchdog = 0;
      const playFilm = function () {
        const p = gateVideo.play();
        if (p && p.catch) p.catch(function () {});
      };
      // SAFETY NET. The gate normally leaves on `timeupdate`, but a paused element
      // stops firing it — and the phone pauses this one whenever the guest locks
      // the screen, takes a call, pulls down notifications or switches apps. Without
      // a fallback that stranded them behind the envelope with no way out. After a
      // tap the gate now ALWAYS opens within a few seconds of the film's length,
      // whatever the media does.
      const armWatchdog = function () {
        window.clearTimeout(watchdog);
        watchdog = window.setTimeout(exitGate, (FILM_END + 5) * 1000);
      };
      gateVideo.addEventListener("playing", function () { gate.classList.add("is-playing"); });
      // The element runs on past the picture to carry the score, so we leave the
      // gate when the PICTURE finishes — not on 'ended', which is now ~1:05 away.
      gateVideo.addEventListener("timeupdate", function () {
        if (!opened && gateVideo.currentTime >= FILM_END) exitGate();
      });
      // A film that fails or stalls must never strand anyone.
      gateVideo.addEventListener("error", function () { if (clicked) exitGate(); });
      gateVideo.addEventListener("stalled", function () { if (clicked) armWatchdog(); });
      // Coming back to the tab: if they're still at the envelope, pick the film up
      // again (silenceOnExit paused it when they left).
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden && !opened && clicked) { playFilm(); armWatchdog(); }
      });

      const enter = function () {
        if (opened) return;
        if (clicked) { exitGate(); return; }  // a second tap means "just let me in"
        clicked = true;
        applyAudioPref();   // sets .muted inside the gesture, before play()
        playFilm();
        armWatchdog();
      };
      gate.addEventListener("click", enter);
      // Keyboard and switch-access guests need a way in too.
      gate.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); enter(); }
      });
      try { gate.focus({ preventScroll: true }); } catch (e) {}
    }
  } else {
    // No gate on this page — show content immediately.
    body.classList.remove("is-sealed");
    body.classList.add("entered");
  }

  /* ---------- THE SCORE ----------
     There is exactly ONE media element with sound on this page: the opening film
     itself, which now carries the score in its own audio track.

     That is deliberate. On iPhone a separate <audio> element is silenced by the
     physical Ring/Silent switch, and a hidden media element may never be granted
     playback at all — which is why the film played but the music didn't. The film
     is full-screen, visible, and started by the guest's own tap, so its audio is
     always allowed, and picture and score can never drift apart.

     Muting uses .muted, which IS settable on iOS (.volume is read-only there).
     The film keeps playing after the picture ends — see exitGate. */
  const audioToggle = $("#audioToggle");
  const audioEl = gateVideo;                 // the film IS the score
  const hasRealTrack = !!audioEl;
  let isOn = false;

  function setAudioUI(on) {
    if (!audioToggle) return;
    audioToggle.classList.toggle("is-playing", on);
    audioToggle.classList.toggle("is-muted", !on);
    audioToggle.setAttribute("aria-pressed", String(on));
    audioToggle.setAttribute("aria-label", on ? "Mute the music" : "Play the music");
  }

  // Called on the opening tap, inside the gesture: honour whatever the guest
  // chose last time, so a returning guest who muted us stays muted.
  function applyAudioPref() {
    if (!audioEl) return;
    let want = "on";
    try { want = localStorage.getItem("serena_audio") || "on"; } catch (e) {}
    audioEl.muted = want === "off";
    isOn = !audioEl.muted;
    setAudioUI(isOn);
  }

  function scoreOn() {
    if (!audioEl) return;
    audioEl.muted = false;
    // The score is only ~1:05, so it often finishes while the guest is still
    // reading. Without this the control did nothing forever after that — and still
    // showed itself as "playing". Restart from where the music comes in; replaying
    // the envelope-opening sound mid-visit would make no sense.
    if (audioEl.ended || (audioEl.duration && audioEl.currentTime >= audioEl.duration - 0.25)) {
      try { audioEl.currentTime = SCORE_IN; } catch (e) {}
    }
    if (audioEl.paused) {
      const p = audioEl.play(); if (p && p.catch) p.catch(function () {});
    }
    isOn = true; setAudioUI(true);
    try { localStorage.setItem("serena_audio", "on"); } catch (e) {}
  }

  function scoreOff() {
    if (!audioEl) return;
    audioEl.muted = true;
    isOn = false; setAudioUI(false);
    try { localStorage.setItem("serena_audio", "off"); } catch (e) {}
  }

  // ---- looping the score ----------------------------------------------------
  // The music should keep playing rather than stop after one pass. The score is baked into the film: envelope sound for the first ~5s,
  // the music settled by 7s, and a deliberate fade-out from ~61.3s to the end
  // at 65.16s. Looping the element itself would replay the envelope sound, and
  // running to the end would fade to silence and then lurch back in — so it
  // turns over early instead, at a beat-aligned point that never reaches the
  // fade. Measured off the track: 96.2 BPM, so a bar is 2.496s; 20 bars from
  // SCORE_IN is five four-bar phrases and stops 4.4s short of the fade.
  const SCORE_IN = 7.0;
  const SCORE_OUT = SCORE_IN + 20 * 2.496;   // 56.92s

  if (audioEl) {
    audioEl.addEventListener("timeupdate", function () {
      if (audioEl.currentTime >= SCORE_OUT) {
        try { audioEl.currentTime = SCORE_IN; } catch (e) {}
      }
    });
    // Kept as a backstop: if a browser ever runs past SCORE_OUT (a stall, a
    // dropped timeupdate), don't leave the control claiming it's still playing.
    audioEl.addEventListener("ended", function () { isOn = false; setAudioUI(false); });
    audioEl.addEventListener("playing", function () { if (!audioEl.muted) { isOn = true; setAudioUI(true); } });
  }

  if (audioToggle) audioToggle.addEventListener("click", function () {
    if (!audioEl) return;
    if (!audioEl.muted && !audioEl.paused) scoreOff(); else scoreOn();
  });

  // Stop the music the moment the guest leaves or backgrounds the site — otherwise
  // phones can keep it playing long after they've moved on (the "it played for
  // hours" report). Only pause; the saved on/off preference is left untouched.
  function silenceOnExit() {
    if (audioEl) { try { audioEl.pause(); } catch (e) {} }
  }
  document.addEventListener("visibilitychange", function () { if (document.hidden) silenceOnExit(); });
  window.addEventListener("pagehide", silenceOnExit);

  /* ---------- HEADER state + MENU ---------- */
  const header = $("#header");
  const hero = $(".hero");
  const menu = $("#menu");
  const navToggle = $("#navToggle");

  if (header && hero) {
    new IntersectionObserver(
      ([e]) => {
        header.classList.toggle("on-hero", e.isIntersecting && e.intersectionRatio > 0.1);
        header.classList.toggle("scrolled", !(e.isIntersecting && e.intersectionRatio > 0.1));
      },
      { threshold: [0, 0.1, 0.9] }
    ).observe(hero);
  }

  // Not every page carries the menu overlay — /hosts/ deliberately doesn't.
  // Without this guard the null deref threw here and aborted the whole file,
  // so nothing below it (including the Hosts panel) ever initialised.
  if (menu && navToggle) {
  function setMenu(open) {
    menu.classList.toggle("is-open", open);
    body.classList.toggle("menu-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    body.style.overflow = open ? "hidden" : "";
    if (open) { lockBackground(menu); $("#menuClose").focus(); }
    else { unlockBackground(); }
  }
  navToggle.addEventListener("click", () => setMenu(true));
  $("#menuClose").addEventListener("click", () => { setMenu(false); navToggle.focus(); });
  $$("#menu .menu__nav a").forEach((a) =>
    a.addEventListener("click", () => setMenu(false))
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("is-open")) { setMenu(false); navToggle.focus(); }
  });
  } /* end if (menu && navToggle) */

  /* ---------- SCROLL REVEALS ---------- */
  const reveals = $$(".reveal");
  if (prefersReduced || !("IntersectionObserver" in window)) {
    reveals.forEach((r) => r.classList.add("in"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach((r) => io.observe(r));
  }

  /* ---------- HERO PARALLAX (subtle cinematic depth) ---------- */
  if (!prefersReduced) {
    const heroMedia = $(".hero__media");
    if (heroMedia) {
      let ticking = false;
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const y = window.scrollY || 0;
          if (y < window.innerHeight * 1.1) {
            heroMedia.style.transform = "translate3d(0," + (y * 0.1).toFixed(1) + "px,0)";
          }
          ticking = false;
        });
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
  }

  /* ---------- DEFER the closing photo until it's near (mobile data) ---------- */
  (function deferClosing() {
    const cbg = $(".closing__bg");
    if (!cbg) return;
    if (!("IntersectionObserver" in window)) { cbg.classList.add("loaded"); return; }
    const io = new IntersectionObserver((entries, obs) => {
      if (entries.some((e) => e.isIntersecting)) { cbg.classList.add("loaded"); obs.disconnect(); }
    }, { rootMargin: "400px 0px" });
    io.observe(cbg.closest(".closing") || cbg);
  })();

  /* ---------- SAVE THE DATE — three hearts, scratch to reveal ----------
     Each heart hides one of Day · Month · Year; scratch (or Enter) clears the
     ocean-toned cover. When all three are open, the line beneath fades in.
     No countdown — the date stays a surprise until the guest uncovers it. */
  (function saveTheDate() {
    const hearts = $("#hearts");
    if (!hearts) return;
    const cue = $("#heartsCue");
    const revealedLine = $("#savedateRevealed");
    const canvases = $$(".heart__cover", hearts);
    if (!canvases.length) return;

    let openedCount = 0;
    function onHeartOpen() {
      if (++openedCount < canvases.length) return;
      hearts.classList.add("unlocked");
      if (cue) cue.style.opacity = "0";
      if (revealedLine) revealedLine.classList.add("revealed");
      startCountdown(); // the date is uncovered now, so a countdown gives nothing away
    }

    function startCountdown() {
      const cd = $("#countdown");
      if (!cd || cd.dataset.started) return;
      cd.dataset.started = "1";
      // Ceremony: Friday, 11 June 2027, 5:00 PM Atlantic Standard Time (UTC−04:00).
      const target = new Date("2027-06-11T17:00:00-04:00").getTime();
      const dEl = cd.querySelector('[data-cd="days"]');
      const hEl = cd.querySelector('[data-cd="hours"]');
      const mEl = cd.querySelector('[data-cd="mins"]');
      const pad = function (n) { return String(n).padStart(2, "0"); };
      let timer = null;
      function tick() {
        const diff = target - Date.now();
        if (diff <= 0) {
          cd.innerHTML = '<p class="savedate__line" style="margin:0">Today is the day. ✦</p>';
          if (timer) clearInterval(timer);
          return;
        }
        dEl.textContent = pad(Math.floor(diff / 86400000));
        hEl.textContent = pad(Math.floor((diff % 86400000) / 3600000));
        mEl.textContent = pad(Math.floor((diff % 3600000) / 60000));
      }
      tick();
      timer = setInterval(tick, 30000); // calm, not a frantic per-second tick
    }

    function makeHeart(canvas) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      let dpr = Math.min(window.devicePixelRatio || 1, 2);
      let drawing = false, cleared = false, samples = 0, painted = false;

      function paint() {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (!w || !h) return false;
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        g.addColorStop(0, "#2f5d6b"); g.addColorStop(1, "#21424c"); // Caribbean-toned cover
        ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "destination-out";
        painted = true; return true;
      }
      function posOf(e) {
        const r = canvas.getBoundingClientRect();
        const p = e.touches ? e.touches[0] : e;
        return { x: (p.clientX - r.left) * dpr, y: (p.clientY - r.top) * dpr };
      }
      function scratch(e) {
        if (!drawing || cleared || !painted) return;
        if (e.cancelable && e.type === "touchmove") e.preventDefault();
        const { x, y } = posOf(e);
        ctx.beginPath(); ctx.arc(x, y, canvas.width * 0.24, 0, Math.PI * 2); ctx.fill();
        if (++samples % 4 === 0) check();
      }
      function check() {
        if (cleared) return;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let clear = 0, total = 0;
        for (let i = 3; i < data.length; i += 64) { total++; if (data[i] < 128) clear++; }
        if (clear / total > 0.5) reveal();
      }
      function reveal() {
        if (cleared) return;
        cleared = true;
        canvas.classList.add("is-cleared");
        onHeartOpen();
      }

      let downX = 0, downY = 0, moved = false;
      const TAP_SLOP = 10; // px of travel under which a press counts as a tap, not a scratch

      canvas.addEventListener("pointerdown", function (e) {
        drawing = true; moved = false; downX = e.clientX; downY = e.clientY;
        try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
        scratch(e);
      });
      canvas.addEventListener("pointermove", function (e) {
        if (!moved && (Math.abs(e.clientX - downX) > TAP_SLOP || Math.abs(e.clientY - downY) > TAP_SLOP)) moved = true;
        scratch(e);
      });
      canvas.addEventListener("pointerup", function () {
        drawing = false;
        // A simple TAP (no real dragging) reveals the whole heart, so no guest is left
        // unsure how to "scratch". A drag still scratches and reveals past halfway.
        if (!moved) reveal();
      });
      canvas.addEventListener("pointercancel", function () { drawing = false; });
      canvas.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); reveal(); }
      });

      return {
        paint: paint,
        repaint: function () { if (!cleared) paint(); },
        setDpr: function () { dpr = Math.min(window.devicePixelRatio || 1, 2); },
        reveal: reveal,
      };
    }

    const cards = canvases.map(makeHeart);

    // Reduced motion: skip the ritual, show the date straight away.
    if (prefersReduced) { cards.forEach(function (c) { c.reveal(); }); return; }

    // Paint the covers once the hearts are laid out & in view (real canvas size).
    let allPainted = false;
    function paintAll() {
      if (allPainted) return;
      let ok = true;
      cards.forEach(function (c) { if (!c.paint()) ok = false; });
      if (ok) allPainted = true;
    }
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { paintAll(); if (allPainted) io.disconnect(); } });
      }, { threshold: 0.2 });
      io.observe(hearts);
    }
    requestAnimationFrame(paintAll);
    if (document.fonts) document.fonts.ready.then(paintAll);

    let rT;
    window.addEventListener("resize", function () {
      clearTimeout(rT);
      rT = setTimeout(function () { cards.forEach(function (c) { c.setDpr(); c.repaint(); }); }, 200);
    });
  })();

  /* ---------- RSVP — form · public guest list · hosts admin ----------
     Data lives in a Google Sheet via an Apps Script web app (see RSVP_ENDPOINT).
     With no endpoint set it runs in LOCAL DEMO mode (this browser only) so the
     flow can be shown before the couple connects their Sheet. The admin password
     is verified SERVER-SIDE by the Apps Script in live mode. */
  (function rsvp() {
    // Three independent pieces share this module's data layer: the reply form and
    // the public list (home page), and the Hosts panel (its own page at /hosts/).
    // Any of them may be absent, so each is guarded rather than assumed.
    const form = $("#rsvpForm");
    const admin = $("#admin");
    if (!form && !admin) return;

    // Read outside the form block — the public list is gated on whether this
    // device has already replied, and that check has to work with no form present.
    const savedReply = function () {
      try { return JSON.parse(localStorage.getItem("serena_my_rsvp") || "null"); } catch (x) { return null; }
    };
    const hasReplied = function () { const m = savedReply(); return !!(m && m.email); };

    // ===== CONFIG — set these to go live ===================================
    // Paste the Apps Script web-app URL (…/exec). Empty = local demo mode.
    // PORTFOLIO COPY: deliberately empty. Replies stay in this browser's
    // localStorage and never leave the page — nothing here talks to any real
    // guest list. (The production build points this at a Google Apps Script
    // web app; see rsvp-backend.gs for that backend.)
    const RSVP_ENDPOINT = "";
    // The admin password lives ONLY in the Apps Script, never here — this file is
    // public. In demo mode (no endpoint) the "guest list" is just this browser's
    // own localStorage, so any non-empty password opens it; there is nothing to
    // protect and hardcoding one here would only publish a real credential.
    // =======================================================================
    const LIVE = !!RSVP_ENDPOINT;
    if (!LIVE) console.warn("[RSVP] Demo mode (saves to this browser only). Set RSVP_ENDPOINT in assets/app.js — see README §6 — to collect replies in your Google Sheet.");

    /* ----- data layer (swaps between the Sheet API and local demo) ----- */
    function gas(payload) {
      return fetch(RSVP_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // simple req → no CORS preflight
        body: JSON.stringify(payload),
        redirect: "follow",
      }).then((r) => r.json());
    }
    const LS_KEY = "serena_rsvps_v2";
    const lsAll = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; } };
    // Demo seed: a fictional guest list so the public "who's coming" list and the
    // Hosts panel have something to show on a first visit. Entirely made up.
    if (!LIVE) {
      try {
        if (!localStorage.getItem(LS_KEY)) {
          const t = (d) => new Date(Date.UTC(2026, 8, d, 15)).toISOString();
          localStorage.setItem(LS_KEY, JSON.stringify([
            { id: "demo-1", name: "Priya Raman",     email: "priya@example.com",  attending: "yes", party: 2, companions: ["Dev Raman"],
              song: "At Last — Etta James",            roomBooked: "yes", bio: "College roommates, still finishing each other's sentences.", photo: "", note: "", updated: t(2) },
            { id: "demo-2", name: "Tomas Ferreira",  email: "tomas@example.com",  attending: "yes", party: 1, companions: [],
              song: "La Vie en Rose — Louis Armstrong", roomBooked: "no",  bio: "Julian's oldest friend, in from Lisbon.", photo: "", note: "", updated: t(3) },
            { id: "demo-3", name: "Hannah Okafor",   email: "hannah@example.com", attending: "yes", party: 2, companions: ["Ben Okafor"],
              song: "Perfect — Ed Sheeran",             roomBooked: "yes", bio: "Mara's cousins, and the reason there'll be dancing.", photo: "", note: "", updated: t(5) },
            { id: "demo-4", name: "Elliot Marsh",    email: "elliot@example.com", attending: "no",  party: 0, companions: [],
              song: "",                                  roomBooked: "",    bio: "", photo: "", note: "So sorry to miss it — raising a glass from afar.", updated: t(6) },
          ]));
        }
      } catch (e) {}
    }
    const lsSave = (a) => { try { localStorage.setItem(LS_KEY, JSON.stringify(a)); } catch (e) {} };
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    // Only a base64 image data URL, and nothing that could close the src="" it gets
    // dropped into — the value comes back from the sheet, so treat it as untrusted.
    const safePhoto = (p) => (typeof p === "string" && /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(p)) ? p : "";
    const pub = (r) => ({ name: r.name, party: r.party, companions: r.companions || [], bio: r.bio || "", photo: safePhoto(r.photo) });
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const initialsOf = (name) => (String(name || "?").trim().split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("") || "?").toUpperCase();

    // Resize an uploaded image to a small square avatar data URL. Re-encoding via
    // canvas also sanitises it (strips EXIF / any non-image payload) and keeps it
    // small enough to store inline (≈320px JPEG, centre-cropped).
    function fileToAvatar(file) {
      return new Promise(function (resolve, reject) {
        if (!file || !/^image\//.test(file.type || "")) { reject(new Error("not an image")); return; }
        if (file.size > 25 * 1024 * 1024) { reject(new Error("too large")); return; }
        const fr = new FileReader();
        fr.onerror = function () { reject(new Error("read failed")); };
        fr.onload = function () {
          const img = new Image();
          img.onerror = function () { reject(new Error("decode failed")); };
          img.onload = function () {
            try {
              const S = 320, c = document.createElement("canvas"); c.width = S; c.height = S;
              const ctx = c.getContext("2d");
              const side = Math.min(img.width, img.height);
              ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
              resolve(c.toDataURL("image/jpeg", 0.72));
            } catch (e) { reject(e); }
          };
          img.src = fr.result;
        };
        fr.readAsDataURL(file);
      });
    }

    const api = {
      submit(rec) {
        if (LIVE) return gas({ action: "submit", record: rec });
        const all = lsAll();
        const i = all.findIndex((r) => (r.email || "").toLowerCase() === rec.email.toLowerCase());
        const saved = Object.assign({ id: i >= 0 ? all[i].id : uid() }, rec, { updated: new Date().toISOString() });
        if (i >= 0) all[i] = saved; else all.push(saved);
        lsSave(all);
        return Promise.resolve({ ok: true, record: saved });
      },
      listPublic() {
        if (LIVE) return gas({ action: "list" }).then((r) => r.guests || []);
        return Promise.resolve(lsAll().filter((r) => r.attending === "yes").map(pub));
      },
      adminAuth(pw) {
        if (LIVE) return gas({ action: "admin", password: pw });
        return Promise.resolve(pw ? { ok: true, guests: lsAll() } : { ok: false });
      },
      adminUpdate(pw, id, fields) {
        if (LIVE) return gas({ action: "update", password: pw, id: id, fields: fields });
        const all = lsAll(); const r = all.find((x) => x.id === id);
        if (r) { Object.assign(r, fields); lsSave(all); }
        return Promise.resolve({ ok: true, guests: all });
      },
      adminRemove(pw, id) {
        if (LIVE) return gas({ action: "remove", password: pw, id: id });
        const all = lsAll().filter((x) => x.id !== id); lsSave(all);
        return Promise.resolve({ ok: true, guests: all });
      },
    };

    if (form) {
    /* ----- companions (who's coming with you) ----- */
    const companionsWrap = $("#companions");
    function addCompanion(value) {
      const row = document.createElement("div");
      row.className = "companion";
      row.innerHTML = '<input type="text" class="companion__name" placeholder="Guest name" autocomplete="off" />' +
        '<button type="button" class="companion__remove" aria-label="Remove guest">×</button>';
      row.querySelector(".companion__name").value = value || "";
      row.querySelector(".companion__remove").addEventListener("click", () => row.remove());
      companionsWrap.appendChild(row);
      return row;
    }
    const getCompanions = () => $$(".companion__name", companionsWrap).map((i) => i.value.trim()).filter(Boolean);
    const setCompanions = (arr) => { companionsWrap.innerHTML = ""; (arr || []).forEach((n) => addCompanion(n)); };
    const addBtn = $("#addCompanion");
    if (addBtn) addBtn.addEventListener("click", () => addCompanion().querySelector("input").focus());

    /* ----- attending toggle ----- */
    const ifYes = $("#ifYes");
    function syncIfYes() {
      const yes = (form.querySelector('[name="attending"]:checked') || {}).value === "yes";
      ifYes.classList.toggle("collapsed", !yes);
    }
    form.addEventListener("change", (e) => { if (e.target.name === "attending") syncIfYes(); });
    syncIfYes();

    /* ----- submit ----- */
    const statusEl = $("#rsvpStatus");
    const thanks = $("#rsvpThanks");

    /* ----- photo + bio (shown on the public "On the island" list) ----- */
    let pendingPhoto = "";
    const photoInput = $("#guestPhoto");
    const photoPreview = $("#photoPreview");
    const photoClear = $("#photoClear");
    const photoChoose = $("#photoChoose");
    function setPhotoPreview(url) {
      pendingPhoto = safePhoto(url);
      if (photoPreview) {
        if (pendingPhoto) { photoPreview.src = pendingPhoto; photoPreview.hidden = false; }
        else { photoPreview.removeAttribute("src"); photoPreview.hidden = true; }
      }
      if (photoClear) photoClear.hidden = !pendingPhoto;
    }
    if (photoChoose && photoInput) photoChoose.addEventListener("click", () => photoInput.click());
    if (photoInput) photoInput.addEventListener("change", function () {
      const f = photoInput.files && photoInput.files[0];
      if (!f) return;
      statusEl.textContent = "Adding your photo…";
      fileToAvatar(f).then(function (url) { setPhotoPreview(url); statusEl.textContent = ""; })
        .catch(function () { statusEl.textContent = "That image didn’t work — please try another."; });
    });
    if (photoClear) photoClear.addEventListener("click", function () { setPhotoPreview(""); if (photoInput) photoInput.value = ""; });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const attending = (form.querySelector('[name="attending"]:checked') || {}).value || "no";
      const companions = attending === "yes" ? getCompanions() : [];
      const rec = {
        name: $("#guestName").value.trim(),
        email: $("#guestEmail").value.trim(),
        attending: attending,
        companions: companions,
        party: attending === "yes" ? 1 + companions.length : 0,
        song: ($("#weddingSong").value || "").trim(),
        roomBooked: attending === "yes" ? ((form.querySelector('[name="roomBooked"]:checked') || {}).value || "") : "",
        bio: attending === "yes" ? ($("#guestBio").value || "").trim() : "",
        photo: attending === "yes" ? pendingPhoto : "",
        note: ($("#note").value || "").trim(),
      };
      const btn = $("#rsvpSubmit");
      btn.disabled = true; statusEl.textContent = "Sending…";
      api.submit(rec).then((res) => {
        // The endpoint answers 200 even when it refuses the write, so a reply could
        // be lost while the guest was told "Received with love". Trust res.ok only.
        if (res && res.ok === false) throw new Error(res.error || "not saved");
        try { localStorage.setItem("serena_my_rsvp", JSON.stringify(rec)); } catch (x) {}
        statusEl.textContent = "";
        showThanks(rec);
        loadGuestList();
      }).catch(() => { statusEl.textContent = "Hmm — that didn’t send. Please try again."; })
        .then(() => { btn.disabled = false; });
    });

    function showThanks(rec, scroll) {
      const attending = rec.attending === "yes";
      const first = rec.name ? rec.name.split(" ")[0] : "";
      $("#thanksEyebrow").textContent = attending ? "Received with love" : "Thank you for letting us know";
      $("#thanksName").textContent = attending
        ? (first ? "See you on the island, " + first + "." : "See you on the island.")
        : (first ? "Thank you, " + first + "." : "Thank you.");
      $("#thanksMsg").textContent = attending
        ? (rec.party > 1 ? "Your party of " + rec.party + " is on the list. Details to follow." : "Your reply is received with love. Details to follow.")
        : "We’ll miss you — but we’re so grateful you let us know.";
      form.style.display = "none";
      thanks.classList.add("show");
      // Skipped when we're just restoring a previous reply on page load — nobody
      // wants to be yanked down the page the moment they arrive.
      if (scroll !== false) thanks.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "center" });
    }

    /* ----- a reply already sent from this device ----- */
    function fillFormFromSaved(mine) {
      if (!mine) return;
      $("#guestName").value = mine.name || "";
      $("#guestEmail").value = mine.email || "";
      const r = form.querySelector('[name="attending"][value="' + mine.attending + '"]'); if (r) r.checked = true;
      $("#weddingSong").value = mine.song || "";
      if (mine.roomBooked) { const rb = form.querySelector('[name="roomBooked"][value="' + mine.roomBooked + '"]'); if (rb) rb.checked = true; }
      $("#guestBio").value = mine.bio || "";
      setPhotoPreview(safePhoto(mine.photo));
      $("#note").value = mine.note || "";
      setCompanions(mine.companions);
      syncIfYes();
    }

    // Show a returning guest that they've already replied, rather than a blank
    // form. A blank form invited them to "reply again" — and because a submit
    // overwrites their whole row, that silently wiped their party, song and note.
    const mine0 = savedReply();
    if (mine0 && mine0.email) showThanks(mine0, false);

    /* ----- change my reply (this device) ----- */
    const editAgain = $("#rsvpEditAgain");
    if (editAgain) editAgain.addEventListener("click", () => {
      thanks.classList.remove("show");
      form.style.display = "";
      fillFormFromSaved(savedReply());
      form.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "center" });
    });
    } /* end if (form) */

    /* ----- public guest list -----
       Held back until this device has replied: the couple didn't want arriving
       guests to read the list before saying whether they're coming. */
    const glItems = $("#guestlistItems");
    const glCount = $("#guestlistCount");
    const glEmpty = $("#guestlistEmpty");
    const glLocked = $("#guestlistLocked");
    function loadGuestList() {
      if (!glItems) return;
      if (!hasReplied()) {
        glItems.innerHTML = "";
        glCount.innerHTML = "&nbsp;";
        if (glEmpty) glEmpty.hidden = true;
        if (glLocked) glLocked.hidden = false;
        return;
      }
      if (glLocked) glLocked.hidden = true;
      api.listPublic().then((guests) => {
        glItems.innerHTML = "";
        if (!guests.length) { glCount.innerHTML = "&nbsp;"; glEmpty.hidden = false; return; }
        glEmpty.hidden = true;
        const total = guests.reduce((s, g) => s + (Number(g.party) || 1), 0);
        glCount.textContent = total + " coming, so far";
        guests.forEach((g) => {
          const li = document.createElement("li");
          li.className = "guestlist__item";
          const withText = (g.companions && g.companions.length) ? "with " + g.companions.join(", ") : "";
          const partyText = g.party > 1 ? "party of " + g.party : "";
          const meta = [partyText, withText].filter(Boolean).join(" · ");
          const photo = safePhoto(g.photo);
          const avatar = photo
            ? '<span class="g-avatar"><img src="' + photo + '" alt="" loading="lazy" decoding="async" /></span>'
            : '<span class="g-avatar g-avatar--ph" aria-hidden="true">' + esc(initialsOf(g.name)) + '</span>';
          li.innerHTML = avatar +
            '<span class="g-text"><span class="g-name">' + esc(g.name) + '</span>' +
            (meta ? '<span class="g-meta">' + esc(meta) + '</span>' : '') +
            (g.bio ? '<span class="g-bio">' + esc(g.bio) + '</span>' : '') +
            '</span>';
          glItems.appendChild(li);
        });
      }).catch(() => {});
    }
    loadGuestList();

    /* ----- hosts admin (password-gated) ----- */
    if (admin) {
      const adminGate = $("#adminGate");
      const adminPanel = $("#adminPanel");
      const adminErr = $("#adminError");
      const adminList = $("#adminList");
      const adminSummary = $("#adminSummary");
      let adminPw = "", adminGuests = [], adminPhotoTargetId = null;
      const adminPhotoInput = $("#adminPhotoInput");
      // Host uploads/replaces a guest's photo via this one shared file input.
      if (adminPhotoInput) adminPhotoInput.addEventListener("change", function () {
        const f = adminPhotoInput.files && adminPhotoInput.files[0];
        const id = adminPhotoTargetId;
        if (!f || !id) return;
        adminSummary.textContent = "Adding photo…";
        fileToAvatar(f).then(function (url) { return api.adminUpdate(adminPw, id, { photo: url }); })
          .then(function (res) { adminGuests = res.guests || adminGuests; renderAdmin(); loadGuestList(); })
          .catch(function () { adminSummary.textContent = "That image didn’t work — please try another."; });
      });

      // The Hosts panel is its own page (/hosts/), so it is simply the content —
      // no overlay to open, nothing to hide behind, and no focus trap to get
      // wrong. (As an overlay it was layered over the opening film, which had
      // already marked it inert, and the password field could not be clicked.)
      admin.hidden = false;
      $("#adminPw").focus();

      adminGate.addEventListener("submit", (e) => {
        e.preventDefault();
        // Trim: a phone keyboard or a paste from a message very often adds a
        // trailing space, and the check is exact.
        const pw = ($("#adminPw").value || "").trim();
        adminErr.textContent = "Checking…";
        api.adminAuth(pw).then((res) => {
          if (res && res.ok) {
            adminPw = pw; adminGuests = res.guests || [];
            adminGate.hidden = true; adminPanel.hidden = false; adminErr.textContent = "";
            renderAdmin();
          } else { adminErr.textContent = "That password didn’t match — it’s all lowercase, and watch for an autocorrected capital."; }
        }).catch(() => { adminErr.textContent = "Couldn’t reach the guest list. Please try again."; });
      });

      /* ----- the guest list -----
         A reading view first: who they are, whether they're coming, and the few
         facts worth scanning. Editing (bio, photo, status, removal) sits behind a
         per-guest "Edit" disclosure. Previously every row carried five link
         buttons and an always-open text field, so the controls outweighed the
         content and the list stopped being readable past a couple of replies. */
      let adminFilter = "all";
      let adminQuery = "";
      const adminExpanded = {};      // id → true, so saving doesn't collapse the card
      let adminConfirmRemove = null; // id awaiting an inline confirm

      const whenLabel = (iso) => {
        const d = new Date(iso || "");
        return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      };

      function adminMatches(g) {
        if (adminFilter !== "all" && g.attending !== adminFilter) return false;
        if (!adminQuery) return true;
        return ((g.name || "") + " " + (g.email || "")).toLowerCase().indexOf(adminQuery) > -1;
      }

      const fact = (label, value, cls) => value
        ? '<div class="fact"><dt>' + label + '</dt><dd' + (cls ? ' class="' + cls + '"' : "") + ">" + value + "</dd></div>"
        : "";

      function adminEditHtml(g, photo) {
        if (adminConfirmRemove === g.id) {
          return '<p class="gcard__warn">Remove <strong>' + esc(g.name) + "</strong> and their reply for good? This can’t be undone.</p>" +
            '<div class="gcard__actions">' +
              '<button type="button" class="link-btn link-btn--danger" data-remove-yes="' + g.id + '">Yes, remove</button>' +
              '<button type="button" class="link-btn" data-remove-no="' + g.id + '">Cancel</button>' +
            "</div>";
        }
        return '<label class="gcard__field"><span>Bio — shown publicly on the guest list</span>' +
            '<input type="text" class="admin-bio-input" maxlength="140" placeholder="A line about them…" value="' +
              esc(g.bio || "") + '" data-bio="' + g.id + '" /></label>' +
          '<div class="gcard__actions">' +
            '<button type="button" class="link-btn" data-savebio="' + g.id + '">Save bio</button>' +
            '<button type="button" class="link-btn" data-photo="' + g.id + '">' + (photo ? "Replace photo" : "Add photo") + "</button>" +
            (photo ? '<button type="button" class="link-btn" data-delphoto="' + g.id + '">Remove photo</button>' : "") +
            '<button type="button" class="link-btn" data-toggle="' + g.id + '">' + (g.attending === "yes" ? "Mark declined" : "Mark coming") + "</button>" +
            '<button type="button" class="link-btn link-btn--danger" data-remove="' + g.id + '">Remove guest</button>' +
          "</div>";
      }

      function renderAdmin() {
        const yes = adminGuests.filter((g) => g.attending === "yes");
        const no = adminGuests.filter((g) => g.attending === "no");
        const heads = yes.reduce((s, g) => s + (Number(g.party) || 1), 0);
        $("#statComing").textContent = yes.length;
        $("#statHeads").textContent = heads;
        $("#statDeclined").textContent = no.length;
        $("#statRooms").textContent = yes.filter((g) => g.roomBooked === "yes").length;

        const shown = adminGuests.slice()
          .sort((a, b) => (b.updated || "").localeCompare(a.updated || ""))
          .filter(adminMatches);

        adminSummary.textContent = !adminGuests.length ? ""
          : shown.length === adminGuests.length
            ? adminGuests.length + (adminGuests.length === 1 ? " reply" : " replies")
            : "Showing " + shown.length + " of " + adminGuests.length;

        adminList.innerHTML = "";
        if (!shown.length) {
          const empty = document.createElement("p");
          empty.className = "admin__empty";
          empty.textContent = adminGuests.length ? "No one matches that." : "Replies will appear here as they come in.";
          adminList.appendChild(empty);
          return;
        }

        shown.forEach((g) => {
          const card = document.createElement("article");
          card.className = "gcard" + (g.attending === "yes" ? "" : " is-declined");
          const photo = safePhoto(g.photo);
          const avatar = photo
            ? '<span class="admin-avatar"><img src="' + photo + '" alt="" /></span>'
            : '<span class="admin-avatar admin-avatar--ph" aria-hidden="true">' + esc(initialsOf(g.name)) + "</span>";
          const withWhom = (g.companions && g.companions.length)
            ? ' <span class="fact__sub">with ' + esc(g.companions.join(", ")) + "</span>" : "";
          const open = !!adminExpanded[g.id];

          card.innerHTML =
            '<header class="gcard__head">' + avatar +
              '<div class="gcard__who">' +
                '<h3 class="gcard__name">' + esc(g.name) + "</h3>" +
                '<a class="gcard__email" href="mailto:' + esc(g.email) + '">' + esc(g.email) + "</a>" +
              "</div>" +
              '<span class="pill ' + (g.attending === "yes" ? "pill--yes" : "pill--no") + '">' +
                (g.attending === "yes" ? "Coming" : "Declined") + "</span>" +
            "</header>" +
            '<dl class="gcard__facts">' +
              (g.attending === "yes" ? fact("Party", esc(String(g.party || 1)) + withWhom) : "") +
              fact("Room", g.roomBooked ? (g.roomBooked === "yes" ? "Booked" : "Not yet") : "") +
              fact("Song", g.song ? esc(g.song) : "", "fact--song") +
              fact("Bio", g.bio ? esc(g.bio) : "") +
              fact("Note", g.note ? "“" + esc(g.note) + "”" : "", "fact--note") +
            "</dl>" +
            '<div class="gcard__foot">' +
              '<button type="button" class="gcard__editbtn" data-edit="' + g.id + '" aria-expanded="' + open + '">' +
                (open ? "Done" : "Edit") + "</button>" +
              (g.updated ? '<span class="gcard__when">Replied ' + esc(whenLabel(g.updated)) + "</span>" : "") +
            "</div>" +
            '<div class="gcard__edit"' + (open ? "" : " hidden") + ">" + adminEditHtml(g, photo) + "</div>";
          adminList.appendChild(card);
        });

        const reload = (res) => { adminGuests = res.guests || adminGuests; renderAdmin(); loadGuestList(); };
        $$("[data-edit]", adminList).forEach((b) => b.addEventListener("click", () => {
          const id = b.getAttribute("data-edit");
          if (adminExpanded[id]) { delete adminExpanded[id]; adminConfirmRemove = null; }
          else adminExpanded[id] = true;
          renderAdmin();
        }));
        $$("[data-toggle]", adminList).forEach((b) => b.addEventListener("click", () => {
          const id = b.getAttribute("data-toggle"), g = adminGuests.find((x) => x.id === id);
          const next = g.attending === "yes" ? "no" : "yes";
          // Don't touch `party`. Zeroing it on decline meant that changing your mind
          // came back as a party of 1 — a party of 3 silently lost two heads even
          // though their companions were still on record. Counts already ignore
          // anyone declined, so the stored number is safe to leave alone.
          const restored = (g.companions && g.companions.length) ? 1 + g.companions.length : (g.party || 1);
          b.textContent = "Saving…"; b.disabled = true;
          api.adminUpdate(adminPw, id, next === "yes" ? { attending: next, party: restored } : { attending: next }).then(reload);
        }));
        $$("[data-remove]", adminList).forEach((b) => b.addEventListener("click", () => {
          adminConfirmRemove = b.getAttribute("data-remove"); renderAdmin();
        }));
        $$("[data-remove-no]", adminList).forEach((b) => b.addEventListener("click", () => {
          adminConfirmRemove = null; renderAdmin();
        }));
        $$("[data-remove-yes]", adminList).forEach((b) => b.addEventListener("click", () => {
          const id = b.getAttribute("data-remove-yes");
          b.textContent = "Removing…"; b.disabled = true;
          adminConfirmRemove = null; delete adminExpanded[id];
          api.adminRemove(adminPw, id).then(reload);
        }));
        $$("[data-savebio]", adminList).forEach((b) => b.addEventListener("click", () => {
          const id = b.getAttribute("data-savebio");
          const input = adminList.querySelector('[data-bio="' + id + '"]');
          b.textContent = "Saving…"; b.disabled = true;
          api.adminUpdate(adminPw, id, { bio: input ? input.value.trim() : "" }).then(reload);
        }));
        $$("[data-photo]", adminList).forEach((b) => b.addEventListener("click", () => {
          adminPhotoTargetId = b.getAttribute("data-photo");
          if (adminPhotoInput) { adminPhotoInput.value = ""; adminPhotoInput.click(); }
        }));
        $$("[data-delphoto]", adminList).forEach((b) => b.addEventListener("click", () => {
          api.adminUpdate(adminPw, b.getAttribute("data-delphoto"), { photo: "" }).then(reload);
        }));
      }

      // Search + filter are wired once; they only change what renderAdmin shows.
      const adminSearch = $("#adminSearch");
      if (adminSearch) adminSearch.addEventListener("input", () => {
        adminQuery = adminSearch.value.trim().toLowerCase(); renderAdmin();
      });
      $$(".segmented [data-filter]").forEach((b) => b.addEventListener("click", () => {
        adminFilter = b.getAttribute("data-filter");
        $$(".segmented [data-filter]").forEach((x) => x.classList.toggle("is-on", x === b));
        renderAdmin();
      }));

      const csvBtn = $("#downloadCsv");
      const csvCell = (v) => { v = String(v == null ? "" : v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      if (csvBtn) csvBtn.addEventListener("click", () => {
        const rows = [["Name", "Email", "Attending", "Party", "Companions", "Wedding song", "Room booked", "Bio", "Photo (paste in browser)", "Note", "Updated"]];
        adminGuests.forEach((g) => rows.push([g.name, g.email, g.attending, g.party || "", (g.companions || []).join("; "), g.song || "", g.roomBooked || "", g.bio || "", safePhoto(g.photo) || "", g.note || "", g.updated || ""]));
        const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
        a.download = "ashford-rsvps.csv";
        document.body.appendChild(a); a.click(); a.remove();
      });
    }
  })();

  /* ---------- GALLERY: fade images in on load + lightbox ---------- */
  const galleryImgs = $$(".duo");
  galleryImgs.forEach((img) => {
    if (img.complete && img.naturalWidth > 0) img.classList.add("loaded");
    else img.addEventListener("load", () => img.classList.add("loaded"), { once: true });
  });

  (function lightbox() {
    const box = $("#lightbox"), bimg = $("#lightboxImg"), count = $("#lightboxCount");
    // Any .tile on the page, not just the gallery grid — the dress-code
    // inspiration boards on /details/ reuse this same viewer.
    const tiles = $$(".tile");
    if (!box || !tiles.length) return;
    const items = tiles.map((t) => { const im = t.querySelector("img"); return { src: im.src, alt: im.alt }; });
    let idx = 0, lastFocus = null;

    function show(i) {
      idx = (i + items.length) % items.length;
      bimg.src = items[idx].src;
      bimg.alt = items[idx].alt;
      count.textContent = (idx + 1) + " / " + items.length;
    }
    function open(i) {
      lastFocus = document.activeElement;
      show(i);
      box.classList.add("is-open");
      body.classList.add("menu-open"); // hides the audio toggle too
      lockBackground(box);
      $("#lightboxClose").focus();
    }
    function close() {
      box.classList.remove("is-open");
      body.classList.remove("menu-open");
      unlockBackground();
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    }
    tiles.forEach((t, i) => {
      t.addEventListener("click", () => open(i));
      t.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i); } });
    });
    $("#lightboxClose").addEventListener("click", close);
    $("#lightboxPrev").addEventListener("click", () => show(idx - 1));
    $("#lightboxNext").addEventListener("click", () => show(idx + 1));
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    document.addEventListener("keydown", (e) => {
      if (!box.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") show(idx - 1);
      else if (e.key === "ArrowRight") show(idx + 1);
    });
    // touch swipe
    let sx = 0;
    box.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
    }, { passive: true });
  })();

  /* ---------- Smooth in-page anchors (respect reduced motion) ---------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
    });
  });
})();
