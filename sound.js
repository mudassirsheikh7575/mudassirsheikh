/*
  Hover sound: a tiny synthesized "tick" (filtered noise click + short
  falling sine chirp, with a touch of reverb). Built with Web Audio, no files.
  Plays when the mouse moves onto anything clickable: links, buttons, form chips,
  project rows in the panels, and the project cards in the 3D view (via window.uiTick). Browsers keep audio
  locked until the visitor's first click or key press, so the sound starts after that.
*/
(function () {
  "use strict";
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  const CLICKABLE = 'a[href], button:not([disabled]), summary, [role="button"], input[type="submit"], input[type="button"]';
  let ctx = null, out = null, noise = null, verb = null, last = 0;

  function setup() {
    if (ctx) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3;
    out = ctx.createGain(); out.gain.value = 0.9;
    out.connect(comp).connect(ctx.destination);

    // One second of white noise, reused for every click
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const n = noise.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;

    // Short, soft room reverb
    const len = Math.floor(ctx.sampleRate * 1.2);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4);
    }
    verb = ctx.createConvolver(); verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.32;
    verb.connect(wet).connect(out);
  }

  function env(g, t, attack, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function send(node) { node.connect(out); node.connect(verb); }

  function tick() {
    if (!ctx || ctx.state !== "running") return;
    const now = performance.now();
    if (now - last < 45) return; // no machine-gun when sweeping across links
    last = now;
    const t = ctx.currentTime;

    // Noise click, band-passed high
    const src = ctx.createBufferSource(); src.buffer = noise;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 6200; bp.Q.value = 4;
    const g1 = ctx.createGain(); src.connect(bp).connect(g1); send(g1);
    env(g1, t, 0.002, 0.04, 0.018);
    src.start(t, Math.random() * 0.5); src.stop(t + 0.07);

    // Tiny falling sine chirp
    const osc = ctx.createOscillator(); osc.type = "sine";
    osc.frequency.setValueAtTime(2637, t);
    osc.frequency.exponentialRampToValueAtTime(2349, t + 0.04);
    const g2 = ctx.createGain(); osc.connect(g2); send(g2);
    env(g2, t, 0.004, 0.012, 0.04);
    osc.start(t); osc.stop(t + 0.1);
  }

  // Build the audio graph immediately at load, and try to start it straight away.
  // Browsers that allow it play from the first hover; the rest unlock on the very
  // first click, tap or key press anywhere on the page.
  setup();
  let unlocked = false;
  function primeSilent() {
    // Playing one silent sample inside the gesture fully unlocks Safari / iOS
    try {
      const b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
    } catch (e) {}
  }
  function unlock() {
    if (unlocked && ctx.state === "running") return;
    if (ctx.state === "closed") { ctx = null; setup(); }
    primeSilent();
    const p = ctx.resume ? ctx.resume() : null;
    const check = () => {
      if (ctx.state === "running") { unlocked = true; return; }
      // Some browsers refuse to wake a context created before the gesture:
      // rebuild it inside this gesture, which they always allow.
      try { ctx.close(); } catch (e) {}
      ctx = null; setup(); primeSilent();
      if (ctx.resume) ctx.resume().then(() => { unlocked = ctx.state === "running"; }).catch(() => {});
    };
    if (p && p.then) p.then(check, check); else check();
  }
  try { if (ctx.resume) ctx.resume().then(() => { unlocked = ctx.state === "running"; }).catch(() => {}); } catch (e) {}
  ["pointerdown", "mousedown", "touchstart", "touchend", "keydown", "click"].forEach((ev) =>
    addEventListener(ev, unlock, { capture: true, passive: true }));
  window.soundUnlock = unlock;
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    (document.hidden ? ctx.suspend() : ctx.resume()).catch(() => {});
  });

  // Project cards drawn in the WebGL view call this when the pointer lands on one
  window.uiTick = tick;

  // Hover on any clickable element (mouse/pen, not touch)
  let current = null;
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    const el = e.target.closest ? e.target.closest(CLICKABLE) : null;
    if (el === current || (el && el.getAttribute("aria-disabled") === "true")) return;
    current = el;
    if (el) tick();
  }, { passive: true });
})();
