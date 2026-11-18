/*
  Procedural artwork. Draws hundreds of small, original "work" thumbnails
  (logos, posters, UI screens, patterns) into a texture atlas, plus a larger
  cover for each project in content.js. No external images needed.
*/
(function () {
  const PALETTES = [
    ["#0f1530", "#7c8cff", "#e8ecff"], ["#f1f1ee", "#141414", "#3b5bff"], ["#ff3d2e", "#fff3ee", "#1a0d0b"],
    ["#0d2a24", "#59e3b1", "#f2fff9"], ["#f4b23a", "#2b1407", "#fff4e0"], ["#121212", "#f5f544", "#ffffff"],
    ["#e7f0ec", "#24443a", "#9ccbb5"], ["#163a5f", "#f6efe4", "#d99a3d"], ["#ffd8d0", "#2a1b3d", "#ff6f59"],
    ["#1b1b1f", "#ff7ad9", "#f3f3f3"], ["#e9d8b8", "#1d1a16", "#c4622d"], ["#d7dcc7", "#2e3524", "#a14f2b"],
    ["#0b0b0c", "#4dd2ff", "#ffffff"], ["#f6f3ff", "#5b3df5", "#17112e"], ["#203325", "#d5f56b", "#f7f7ef"],
    ["#fafafa", "#ff5a1f", "#111111"], ["#2c0f3d", "#ffb84d", "#fbe9ff"], ["#e8eef2", "#0b2239", "#ff5a1f"],
    ["#101820", "#fee715", "#f4f4f4"], ["#c9e4ff", "#0a2a66", "#ffffff"], ["#ffefe1", "#d63a2f", "#2a2a2a"],
    ["#141a2e", "#a8ffcf", "#e0e6ff"]
  ];
  const WORDS = ["nuvo", "orbit", "Halo", "kiln", "Vela", "mosa", "Tern", "plume", "Arc", "zest", "Lyra", "fold", "Oro", "brisk", "Ember", "nook", "Sora", "quill", "Rift", "loom", "Juno", "pith", "Moss", "Echo"];

  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const pick = (r, a) => a[Math.floor(r() * a.length)];

  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

  function logoShape(ctx, cx, cy, s, r, col) {
    ctx.fillStyle = col; const k = Math.floor(r() * 6);
    ctx.save(); ctx.translate(cx, cy);
    if (k === 0) { for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.ellipse(s * 0.28, 0, s * 0.26, s * 0.12, 0, 0, 7); ctx.fill(); } }
    else if (k === 1) { ctx.beginPath(); ctx.arc(-s * 0.15, 0, s * 0.3, 0, 7); ctx.fill(); ctx.globalCompositeOperation = "xor"; ctx.beginPath(); ctx.arc(s * 0.15, 0, s * 0.3, 0, 7); ctx.fill(); }
    else if (k === 2) { ctx.beginPath(); ctx.moveTo(0, -s * 0.4); ctx.lineTo(s * 0.4, s * 0.32); ctx.lineTo(-s * 0.4, s * 0.32); ctx.closePath(); ctx.fill(); }
    else if (k === 3) { for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); rr(ctx, s * 0.05, s * 0.05, s * 0.3, s * 0.3, s * 0.15 * (i % 2)); ctx.fill(); } }
    else if (k === 4) { ctx.lineWidth = s * 0.1; ctx.strokeStyle = col; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, s * 0.12 * i, Math.PI * 0.2 * i, Math.PI * (1.5 + 0.1 * i)); ctx.stroke(); } }
    else { ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; ctx.quadraticCurveTo(Math.cos(a + 0.8) * s * 0.05, Math.sin(a + 0.8) * s * 0.05, Math.cos(a) * s * 0.42, Math.sin(a) * s * 0.42); } ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }

  function uiScreen(ctx, x, y, w, h, r, p, dark) {
    ctx.fillStyle = dark ? "#16161a" : "#ffffff"; rr(ctx, x, y, w, h, w * 0.05); ctx.fill();
    const fg = dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)";
    ctx.fillStyle = fg; rr(ctx, x + w * 0.06, y + h * 0.07, w * 0.3, h * 0.05, 3); ctx.fill();
    ctx.fillStyle = p[1]; rr(ctx, x + w * 0.7, y + h * 0.06, w * 0.24, h * 0.08, h * 0.04); ctx.fill();
    ctx.fillStyle = p[2] === "#ffffff" ? p[1] : p[2];
    ctx.font = `500 ${Math.round(h * 0.13)}px "Inter Tight", sans-serif`; ctx.fillText(pick(r, WORDS) + " " + pick(r, WORDS), x + w * 0.06, y + h * 0.32);
    ctx.strokeStyle = p[1]; ctx.lineWidth = Math.max(1.5, w * 0.012); ctx.beginPath();
    for (let i = 0; i <= 10; i++) { const px = x + w * (0.06 + i * 0.088), py = y + h * (0.72 - 0.25 * Math.sin(i * 0.7 + r() * 0.6) * (0.4 + i / 14)); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
    ctx.fillStyle = fg; for (let i = 0; i < 3; i++) { rr(ctx, x + w * (0.06 + i * 0.31), y + h * 0.82, w * 0.26, h * 0.1, 4); ctx.fill(); }
  }

  function tile(ctx, x, y, w, h, seed) {
    const r = rng(seed * 9301 + 49297); const p = pick(r, PALETTES); const kind = Math.floor(r() * 7);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = p[0]; ctx.fillRect(x, y, w, h);
    if (kind === 0) { logoShape(ctx, x + w / 2, y + h / 2, w * 0.62, r, p[1]); }
    else if (kind === 1) { // poster
      ctx.fillStyle = p[1]; ctx.font = `italic 400 ${Math.round(h * 0.62)}px "Instrument Serif", serif`;
      ctx.fillText(pick(r, WORDS).slice(0, 2), x + w * 0.06, y + h * 0.68);
      ctx.fillStyle = p[2]; ctx.fillRect(x + w * 0.06, y + h * 0.82, w * 0.5, h * 0.03); ctx.fillRect(x + w * 0.06, y + h * 0.88, w * 0.3, h * 0.03);
    } else if (kind === 2) { uiScreen(ctx, x + w * 0.08, y + h * 0.12, w * 0.84, h * 0.76, r, p, r() > 0.5); }
    else if (kind === 3) { // orb
      const g = ctx.createRadialGradient(x + w * 0.4, y + h * 0.35, 2, x + w / 2, y + h / 2, w * 0.6);
      g.addColorStop(0, p[2]); g.addColorStop(0.45, p[1]); g.addColorStop(1, p[0]); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    } else if (kind === 4) { // wordmark
      ctx.fillStyle = p[1]; ctx.font = `500 ${Math.round(h * 0.26)}px "Inter Tight", sans-serif`; ctx.textAlign = "center";
      ctx.fillText(pick(r, WORDS), x + w / 2, y + h * 0.6); ctx.textAlign = "start";
    } else if (kind === 5) { // pattern
      ctx.fillStyle = p[1]; const n = 3 + Math.floor(r() * 4), cs = w / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2 === 0) { ctx.beginPath(); ctx.arc(x + cs * (i + 0.5), y + cs * (j + 0.5), cs * 0.36, 0, 7); ctx.fill(); }
    } else { // phone
      ctx.fillStyle = p[2]; ctx.fillRect(x, y, w, h);
      uiScreen(ctx, x + w * 0.3, y + h * 0.08, w * 0.4, h * 0.84, r, p, true);
    }
    ctx.restore();
  }

  function cover(ctx, x, y, w, h, proj, idx) {
    const p = proj.palette, r = rng(idx * 7919 + 17);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = p[0]; ctx.fillRect(x, y, w, h);
    const layout = idx % 4;
    if (layout === 0) {
      logoShape(ctx, x + w * 0.5, y + h * 0.42, h * 0.5, r, p[2]);
      ctx.fillStyle = p[1]; ctx.font = `italic 400 ${Math.round(h * 0.16)}px "Instrument Serif", serif`; ctx.textAlign = "center";
      ctx.fillText(proj.title, x + w / 2, y + h * 0.86); ctx.textAlign = "start";
    } else if (layout === 1) {
      const g = ctx.createRadialGradient(x + w * 0.8, y + h * 0.1, 4, x + w * 0.7, y + h * 0.3, w * 0.9);
      g.addColorStop(0, p[1]); g.addColorStop(1, p[0]); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      uiScreen(ctx, x + w * 0.1, y + h * 0.18, w * 0.8, h * 0.9, r, p, true);
      ctx.fillStyle = p[2]; ctx.font = `500 ${Math.round(h * 0.07)}px "Inter Tight", sans-serif`; ctx.fillText(proj.title, x + w * 0.1, y + h * 0.12);
    } else if (layout === 2) {
      ctx.fillStyle = p[1]; ctx.font = `500 ${Math.round(h * 0.2)}px "Inter Tight", sans-serif`; ctx.letterSpacing = "-4px";
      ctx.fillText(proj.title.toLowerCase(), x + w * 0.06, y + h * 0.3);
      ctx.fillStyle = p[2]; for (let i = 0; i < 3; i++) { rr(ctx, x + w * (0.06 + i * 0.31), y + h * 0.44, w * 0.27, h * 0.48, 10); ctx.fill(); }
      for (let i = 0; i < 3; i++) logoShape(ctx, x + w * (0.195 + i * 0.31), y + h * 0.68, h * 0.24, r, p[0]);
    } else {
      ctx.fillStyle = p[2]; ctx.fillRect(x, y + h * 0.62, w, h * 0.38);
      ctx.fillStyle = p[1]; ctx.font = `italic 400 ${Math.round(h * 0.34)}px "Instrument Serif", serif`;
      ctx.fillText(proj.title.split(" ")[0], x + w * 0.05, y + h * 0.5);
      ctx.fillStyle = p[0]; ctx.font = `500 ${Math.round(h * 0.05)}px "Inter Tight", sans-serif`;
      ctx.fillText(proj.type.toUpperCase(), x + w * 0.05, y + h * 0.8); ctx.fillText(proj.year, x + w * 0.85, y + h * 0.8);
    }
    ctx.restore();
  }

  window.ART = {
    TILE_GRID: 16, // 16 x 16 cells of 128px
    COVER_GRID: 4, // 4 x 4 cells of 512px (cover uses 512 x 384)
    buildTileAtlas(size = 2048) {
      const c = document.createElement("canvas"); c.width = c.height = size; const ctx = c.getContext("2d");
      const n = this.TILE_GRID, cs = size / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) tile(ctx, i * cs + 2, j * cs + 2, cs - 4, cs - 4, j * n + i + 1);
      return c;
    },
    buildCoverAtlas(projects, size = 2048) {
      const c = document.createElement("canvas"); c.width = c.height = size; const ctx = c.getContext("2d");
      const n = this.COVER_GRID, cs = size / n;
      projects.slice(0, n * n).forEach((p, k) => cover(ctx, (k % n) * cs, Math.floor(k / n) * cs, cs, cs * 0.75, p, k));
      return c;
    },
    coverURL(project, idx, w = 480) {
      const c = document.createElement("canvas"); c.width = w; c.height = w * 0.75;
      cover(c.getContext("2d"), 0, 0, w, w * 0.75, project, idx); return c.toDataURL("image/jpeg", 0.86);
    }
  };
})();
