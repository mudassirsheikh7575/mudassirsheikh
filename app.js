/*
  Portfolio engine.
  - Hero: the portrait is made of thousands of small artwork tiles (WebGL2 instancing).
  - Scroll / drag / keys: the portrait breaks apart and the camera flies through the work.
  - Panels: Selected, Work, About, Contact, and a project view.
  - Respects prefers-reduced-motion.
*/
(function () {
  "use strict";
  const C = window.CONTENT;
  const $ = (s, el = document) => el.querySelector(s);
  const body = document.body;
  const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduce = mqReduce.matches;
  mqReduce.addEventListener?.("change", (e) => { reduce = e.matches; });

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const pad3 = (n) => String(n).padStart(3, "0");

  /* ------------------------------------------------------------------ */
  /* Static content                                                      */
  /* ------------------------------------------------------------------ */
  $("#t-role").textContent = `${C.role}, ${C.roleSuffix}`;
  $("#t-city").textContent = C.city;
  $("#m-city").textContent = C.city;
  $("#intro").textContent = C.intro;
  $("#social").innerHTML = C.links.map((l) => `<a class="link-u" href="${l.href}" target="${l.href.startsWith("http") ? "_blank" : "_self"}" rel="noopener">${l.label}</a>`).join(", ");
  const bigname = $("#bigname");
  bigname.setAttribute("aria-label", C.name);
  bigname.innerHTML = [...C.name].map((ch, i) => `<span class="ch" aria-hidden="true" style="transition-delay:${0.25 + i * 0.035}s">${ch === " " ? "&nbsp;" : ch}</span>`).join("");

  function fitName() {
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.font = 'italic 400 100px "Instrument Serif", serif';
    const w = ctx.measureText(C.name).width * (1 - 0.035) || 600;
    const size = (window.innerWidth * 0.965) / w * 100;
    document.documentElement.style.setProperty("--name-size", size + "px");
    document.documentElement.style.setProperty("--name-h", size * 0.8 + "px");
  }

  function tick() {
    const t = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: C.timeZone }).format(new Date());
    $("#clock").textContent = t; $("#m-clock").textContent = t;
  }
  tick(); setInterval(tick, 15000);

  /* ------------------------------------------------------------------ */
  /* WebGL                                                               */
  /* ------------------------------------------------------------------ */
  const canvas = $("#gl");
  const gl = canvas.getContext("webgl2", { antialias: true, alpha: false, powerPreference: "high-performance" });
  const FOV = (50 * Math.PI) / 180;
  const TANH = Math.tan(FOV / 2);
  const BG = [10 / 255, 10 / 255, 11 / 255];
  const projects = C.projects.slice(0, 16);
  const NP = projects.length;

  const VS = `#version 300 es
  precision highp float;
  layout(location=0) in vec2 aCorner;
  layout(location=1) in vec3 aP0;
  layout(location=2) in vec3 aP1;
  layout(location=3) in vec4 aSize;   // xy: hero size, zw: cosmos size
  layout(location=4) in vec4 aMeta;   // cell, luminance, random, featured
  uniform mat4 uProj; uniform vec3 uCam; uniform float uMorph, uTime, uMotion, uIntro, uMouseOn, uHover;
  uniform vec2 uMouse;
  out vec2 vUv; out vec2 vSize; out float vLum, vFog, vMorph; flat out float vCell, vFeat, vRand;
  void main(){
    float d = aMeta.z;
    float m = clamp(uMorph * 1.4 - d * 0.4, 0., 1.);
    m = m * m * (3. - 2. * m);
    float intro = clamp(uIntro * 1.6 - (1. - d) * 0.6, 0., 1.);
    intro = intro * intro;
    m = max(m, intro);
    vec3 p0 = aP0;
    p0.z += sin(uTime * 0.9 + d * 40.) * 0.012 * uMotion;
    vec2 dm = p0.xy - uMouse;
    float f = exp(-dot(dm, dm) * 22.) * uMouseOn * uMotion;
    p0.xy += normalize(dm + 1e-5) * f * 0.08;
    p0.z += f * 0.45;
    vec3 p = mix(p0, aP1, m);
    p.xy += vec2(sin(d * 31.), cos(d * 23.)) * sin(m * 3.14159) * 0.5;
    vec2 size = mix(aSize.xy * (1. + f * 0.9), aSize.zw, m);
    vec3 v = p - uCam;
    float depth = -v.z;
    size *= smoothstep(0.35, 1.3, depth);
    gl_Position = uProj * vec4(v + vec3(aCorner * size, 0.), 1.);
    vUv = vec2(aCorner.x + .5, .5 - aCorner.y);
    vSize = size;
    vLum = aMeta.y; vMorph = m; vCell = aMeta.x; vFeat = aMeta.w; vRand = d;
    vFog = smoothstep(9., 26., depth) * mix(1., .55, aMeta.w);
  }`;

  const FS = `#version 300 es
  precision highp float;
  in vec2 vUv; in vec2 vSize; in float vLum, vFog, vMorph; flat in float vCell, vFeat, vRand;
  uniform sampler2D uTiles, uCovers; uniform vec3 uBg; uniform float uTime, uMotion, uHoverId;
  out vec4 o;
  void main(){
    vec2 q = (vUv - .5) * vSize;
    float r = min(vSize.x, vSize.y) * mix(.1, .045, vFeat);
    vec2 e = abs(q) - (vSize * .5 - r);
    if (length(max(e, 0.)) > r) discard;
    vec3 tex;
    if (vFeat > .5) {
      vec2 cell = vec2(mod(vCell, 4.), floor(vCell / 4.));
      tex = texture(uCovers, (cell + vec2(vUv.x, vUv.y * .75)) / 4.).rgb;
    } else {
      vec2 cell = vec2(mod(vCell, 16.), floor(vCell / 16.));
      tex = texture(uTiles, (cell + vUv) / 16.).rgb;
    }
    float g = dot(tex, vec3(.299, .587, .114));
    float l = pow(vLum, 1.35);
    float tw = .9 + .1 * sin(uTime * 2.2 + vRand * 60.) * uMotion;
    vec3 hero = mix(vec3(g), tex, .62) * (.05 + 1.45 * l) * tw + vec3(.9, .92, 1.) * pow(l, 3.) * .25;
    vec3 col = mix(hero, tex * mix(.68, 1., vFeat), smoothstep(.15, .9, vMorph));
    if (vFeat > .5 && abs(vCell - uHoverId) < .5) col = mix(col, vec3(1.), .08);
    col = mix(col, uBg, vFog);
    o = vec4(col, 1.);
  }`;

  let prog, U = {}, vao, instBuf, count = 0, featIndex = [], heroH = 2, camZ0 = 3, layout = {};

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function texFrom(canvasEl, unit) {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasEl);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const ext = gl.getExtension("EXT_texture_filter_anisotropic");
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    return t;
  }

  function rand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  /* Layout depends on aspect ratio: camera distance, card placement. */
  function computeLayout() {
    const W = window.innerWidth, H = window.innerHeight, aspect = W / H, mobile = W < 820;
    heroH = 2;
    const fitH = heroH / (0.86 * 2 * TANH);
    const fitW = heroH / ((mobile ? 1.05 : 0.9) * 2 * TANH * aspect);
    camZ0 = Math.max(fitH, fitW);
    const view = 2.4; // distance from which a card is read
    const halfW = view * TANH * aspect, halfH = view * TANH;
    const cardW = mobile ? halfW * 1.55 : Math.min(halfW * 0.82, halfH * 1.5);
    const spacing = 3.4;
    const cards = projects.map((p, k) => {
      const side = k % 2 ? 1 : -1;
      const x = mobile ? 0 : side * halfW * 0.34;
      const y = mobile ? (k % 2 ? -0.12 : 0.12) * halfH : (k % 3 - 1) * 0.12 * halfH;
      const z = -3 - k * spacing;
      return { x, y, z, w: cardW, h: cardW * 0.75, t: camZ0 - (z + view) + 0.6 };
    });
    layout = { mobile, aspect, view, cards, tMax: cards[NP - 1].t + 3, zEnd: cards[NP - 1].z - 14 };
  }

  /* Keep the space between the camera and each project card empty. */
  function clearCorridor(d, o) {
    for (const c of layout.cards) {
      const mx = c.w * 0.62 + 0.08, my = c.h * 0.62 + 0.08;
      if (d[o + 5] > c.z - 0.3 && d[o + 5] < c.z + layout.view + 0.6 && Math.abs(d[o + 3] - c.x) < mx && Math.abs(d[o + 4] - c.y) < my) {
        const dx = d[o + 3] - c.x || 0.01, dy = d[o + 4] - c.y || 0.01;
        const k = Math.max(mx / Math.abs(dx), my / Math.abs(dy)) > 0 ? Math.min(mx / Math.abs(dx), my / Math.abs(dy)) : 1;
        const kk = Math.min(k, 40) * (1.05 + Math.random() * 0.4);
        d[o + 3] = c.x + dx * kk; d[o + 4] = c.y + dy * kk;
      }
    }
  }

  function buildInstances() {
    const P = window.PORTRAIT, R = rand(7);
    const step = heroH / 120, hs = step * 0.8;
    const extra = 900; // free-floating tiles that only exist in the cosmos
    count = P.length + extra;
    const STRIDE = 14; // p0(3) p1(3) size(4) meta(4)
    const data = new Float32Array(count * STRIDE);
    const yOff = layout.mobile ? 0.18 : 0.04;
    featIndex = [];
    // choose which portrait tiles become project cards: bright ones near the face
    const bright = P.map((p, i) => [i, p[2]]).filter((a) => a[1] > 0.55).sort(() => R() - 0.5).slice(0, NP).map((a) => a[0]);
    const featMap = new Map(bright.map((idx, k) => [idx, k]));
    for (let i = 0; i < count; i++) {
      const o = i * STRIDE;
      const fromPortrait = i < P.length;
      const [px, py, lum] = fromPortrait ? P[i] : [0, 0, 0];
      // hero position
      if (fromPortrait) { data[o] = px * heroH; data[o + 1] = py * heroH + yOff; data[o + 2] = 0; }
      else { const a = R() * 6.283, rr = 1.6 + R() * 3; data[o] = Math.cos(a) * rr; data[o + 1] = Math.sin(a) * rr; data[o + 2] = -2 - R() * 10; }
      // cosmos position: a long tunnel with a clear corridor for the camera
      const a = R() * 6.283, rad = 0.45 + Math.pow(R(), 0.7) * 3.4;
      data[o + 3] = Math.cos(a) * rad * (layout.mobile ? 0.7 : 1.25);
      data[o + 4] = Math.sin(a) * rad * 0.8;
      data[o + 5] = lerp(1.2, layout.zEnd, R());
      clearCorridor(data, o);
      const s = 0.05 + Math.pow(R(), 3) * 0.2, asp = [1, 1.333, 0.75, 1.6][Math.floor(R() * 4)];
      data[o + 6] = fromPortrait ? hs : 0.0001; data[o + 7] = fromPortrait ? hs : 0.0001;
      data[o + 8] = s * Math.sqrt(asp); data[o + 9] = s / Math.sqrt(asp);
      data[o + 10] = Math.floor(R() * 256); data[o + 11] = fromPortrait ? lum : 0; data[o + 12] = R(); data[o + 13] = 0;
      const k = featMap.get(i);
      if (k !== undefined) {
        const c = layout.cards[k];
        data[o + 3] = c.x; data[o + 4] = c.y; data[o + 5] = c.z;
        data[o + 8] = c.w; data[o + 9] = c.h;
        data[o + 10] = k; data[o + 13] = 1; data[o + 12] = R() * 0.3;
        featIndex[k] = i;
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }

  function initGL() {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    ["uProj", "uCam", "uMorph", "uTime", "uMotion", "uIntro", "uMouse", "uMouseOn", "uTiles", "uCovers", "uBg", "uHover", "uHoverId"].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));
    vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    instBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    const F = 4, S = 14 * F;
    [[1, 3, 0], [2, 3, 3], [3, 4, 6], [4, 4, 10]].forEach(([loc, n, off]) => {
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, S, off * F); gl.vertexAttribDivisor(loc, 1);
    });
    texFrom(ART.buildTileAtlas(), 0);
    texFrom(ART.buildCoverAtlas(projects), 1);
    gl.uniform1i(U.uTiles, 0); gl.uniform1i(U.uCovers, 1);
    gl.uniform3fv(U.uBg, BG);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(BG[0], BG[1], BG[2], 1);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr); canvas.height = Math.round(window.innerHeight * dpr);
    fitName();
    computeLayout();
    if (!gl) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    buildInstances();
    const a = window.innerWidth / window.innerHeight, n = 0.05, f = 80, fy = 1 / TANH;
    gl.uniformMatrix4fv(U.uProj, false, new Float32Array([fy / a, 0, 0, 0, 0, fy, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]));
    T = clamp(T, 0, layout.tMax);
  }

  /* ------------------------------------------------------------------ */
  /* Flight state & input                                                */
  /* ------------------------------------------------------------------ */
  let T = 0, t = 0, intro = 1, panelK = 0, mouse = { x: 0, y: 0, sx: 0, sy: 0, on: 0, in: false }, hoverId = -1, current = -1;
  const camOf = (tt) => camZ0 - Math.max(0, tt - 0.6);
  const morphOf = (tt) => clamp(tt / 1.6, 0, 1);
  let lastInput = 0;
  const flyTo = (target) => { T = clamp(target, 0, layout.tMax); lastInput = performance.now(); if (reduce) t = T; };
  const isUI = (el) => el && el.closest && el.closest(".box, .mnav, .top, button, a, input, textarea");

  window.addEventListener("wheel", (e) => {
    if (e.target.closest && e.target.closest(".box, .mnav")) return;
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    flyTo(T + clamp(d, -120, 120) * 0.0045);
  }, { passive: false });

  let drag = null;
  window.addEventListener("pointerdown", (e) => {
    if (isUI(e.target)) return;
    drag = { y: e.clientY, x: e.clientX, y0: e.clientY, x0: e.clientX, v: 0, time: performance.now(), moved: false };
  });
  window.addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = -((e.clientY / window.innerHeight) * 2 - 1); mouse.in = e.pointerType === "mouse";
    if (!drag) { updateHover(e.clientX, e.clientY); return; }
    const dy = drag.y - e.clientY, now = performance.now();
    if (Math.abs(e.clientY - drag.y0) + Math.abs(e.clientX - drag.x0) > 6) drag.moved = true;
    flyTo(T + dy * 0.012);
    drag.v = dy / Math.max(1, now - drag.time); drag.y = e.clientY; drag.time = now;
  });
  window.addEventListener("pointerup", (e) => {
    if (!drag) return;
    if (!drag.moved) { const k = pickCard(e.clientX, e.clientY); if (k >= 0) openProject(k); }
    else if (!reduce) flyTo(T + drag.v * 6);
    drag = null;
  });
  document.addEventListener("pointerleave", () => { mouse.in = false; });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closePanel(); closeMenu(); return; }
    if (e.target.closest && e.target.closest("input, textarea")) return;
    if (body.classList.contains("is-panel")) return;
    const nextIdx = () => layout.cards.findIndex((c) => c.t > t + 0.05);
    if (["ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); const k = nextIdx(); flyTo(k < 0 ? layout.tMax : layout.cards[k].t); }
    if (["ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); let k = -1; layout.cards.forEach((c, i) => { if (c.t < t - 0.05) k = i; }); flyTo(k < 0 ? 0 : layout.cards[k].t); }
    if (e.key === "Home") flyTo(0);
    if (e.key === "End") flyTo(layout.tMax);
  });

  /* Card picking: project the 3D card rects to screen space. */
  function cardRect(k) {
    const c = layout.cards[k], cam = camState();
    const depth = cam.z - c.z; if (depth < 0.4 || morphOf(t) < 0.95) return null;
    const sy = window.innerHeight / (2 * depth * TANH), cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    return { x: cx + (c.x - cam.x) * sy - (c.w * sy) / 2, y: cy - (c.y - cam.y) * sy - (c.h * sy) / 2, w: c.w * sy, h: c.h * sy, depth };
  }
  function pickCard(x, y) {
    let best = -1, bd = 1e9;
    for (let k = 0; k < NP; k++) { const r = cardRect(k); if (r && x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h && r.depth < bd) { bd = r.depth; best = k; } }
    return best;
  }
  function updateHover(x, y) {
    const id = pickCard(x, y);
    if (id !== hoverId && id >= 0 && window.uiTick) window.uiTick();
    hoverId = id; canvas.style.cursor = hoverId >= 0 ? "pointer" : "";
  }

  function camState() {
    const k = reduce ? 0 : 1, fly = morphOf(t);
    let shift = 0;
    if (panelK > 0.001 && !layout.mobile && current >= 0) {
      const W = window.innerWidth, edge = (box.getBoundingClientRect().right || W * 0.35) / W;
      const ndc = edge; // centre of the free area, in NDC: ((edge + 1) / 2) * 2 - 1
      shift = panelK * (layout.cards[current].x - ndc * layout.view * TANH * layout.aspect);
    }
    return { x: mouse.sx * (0.05 + fly * 0.25) * k + shift, y: mouse.sy * (0.04 + fly * 0.18) * k + (layout.mobile ? 0.25 * (1 - fly) : 0), z: camOf(t) };
  }

  /* ------------------------------------------------------------------ */
  /* HUD                                                                 */
  /* ------------------------------------------------------------------ */
  const hudNow = $("#now"), nowI = $("#now-i"), nowT = $("#now-t"), nowS = $("#now-s"), seen = $("#seen"), hint = $("#hint");
  function updateHUD() {
    const flying = t > 0.35;
    body.classList.toggle("is-flying", flying);
    let k = 0, bd = 1e9;
    layout.cards.forEach((c, i) => { const d = Math.abs(c.t - t); if (d < bd) { bd = d; k = i; } });
    if (k !== current) {
      current = k; const p = projects[k];
      nowI.textContent = pad3(k + 1); nowT.textContent = p.title;
      nowS.textContent = p.type; seen.textContent = `Project ${k + 1} of ${NP}`;
      hudNow.classList.remove("swap"); void hudNow.offsetWidth; hudNow.classList.add("swap");
      hudNow.setAttribute("aria-label", `Open ${p.title}`);
    }
    hint.classList.toggle("show", t < layout.cards[0].t + 0.6 && !body.classList.contains("is-panel"));
  }
  hudNow.addEventListener("click", () => openProject(current));
  $("#back").addEventListener("click", () => { closePanel(); flyTo(0); });
  $("#explore").addEventListener("click", () => flyTo(layout.cards[0].t));
  $("#home").addEventListener("click", (e) => { e.preventDefault(); closePanel(); flyTo(0); });

  /* ------------------------------------------------------------------ */
  /* Panels                                                              */
  /* ------------------------------------------------------------------ */
  const box = $("#box"), boxBody = $("#box-body"), boxTag = $("#box-tag");
  const covers = projects.map((p, i) => ART.coverURL(p, i));
  let lastFocus = null;

  const views = {
    selected: () => ["Selected work", `<section>
      <h2 id="box-h">A few to start with.</h2>
      <p>Websites and products where the design and the build came from the same hands. Pick one and the flight takes you straight to it.</p>
      <ul class="list">${projects.slice(0, 6).map((p, i) => `<li><button data-project="${i}"><img src="${covers[i]}" alt="" /><span><span class="t">${p.title}</span><span class="s">${p.type}</span></span><span class="n">${pad3(i + 1)}</span></button></li>`).join("")}</ul>
    </section>`],
    work: () => ["All work", `<section>
      <h2 id="box-h">Everything, in order.</h2>
      <p class="muted">${NP} projects, newest first. Or close this and scroll to fly through them.</p>
      <ul class="list list--compact">${projects.map((p, i) => `<li><button data-project="${i}"><img src="${covers[i]}" alt="" /><span><span class="t">${p.title}</span> <span class="s">${p.type}</span></span><span class="n">${p.year}</span></button></li>`).join("")}</ul>
    </section>`],
    about: () => ["About", `<section>
      <h2 id="box-h">${C.about.heading}</h2>
      ${C.about.paragraphs.map((p) => `<p>${p}</p>`).join("")}
      <div class="grid2">
        <div><span class="label">What I do</span>${C.about.services.join("<br>")}</div>
        <div>${C.about.facts.map(([a, b]) => `<span class="label">${a}</span><div style="margin-bottom:10px">${b}</div>`).join("")}</div>
        <div><span class="label">Elsewhere</span>${C.links.map((l) => `<a class="link-u" href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`).join(", ")}</div>
        <div><span class="label">Contact</span><button class="link-u" data-open="contact">Send me a message</button></div>
      </div>
      ${ctaHTML()}
    </section>`],
    contact: () => ["Start a project", `<section>
      <h2 id="box-h">Tell me what you're building.</h2>
      <p class="muted">A few lines are enough. I read every message myself and reply within a day.</p>
      <form class="form" id="brief" novalidate>
        <div class="row"><label>Name<input name="name" autocomplete="name" required /></label><label>Email<input name="email" type="email" autocomplete="email" required /></label></div>
        <label>Company or website<input name="company" autocomplete="organization" /></label>
        <div><span class="label" style="font-size:12px;margin-bottom:6px">What do you need?</span><div class="chips" data-group="needs" data-multi="1">${["Website", "Product design", "Brand identity", "Design + build", "Something else"].map((x) => `<button type="button" aria-pressed="false">${x}</button>`).join("")}</div></div>
        <div><span class="label" style="font-size:12px;margin-bottom:6px">Budget</span><div class="chips" data-group="budget">${["Under $5k", "$5k to $15k", "$15k to $40k", "$40k+", "Not sure yet"].map((x) => `<button type="button" aria-pressed="false">${x}</button>`).join("")}</div></div>
        <label>About the project<textarea name="about" placeholder="What the company does, what you need and when."></textarea></label>
        <button class="pill pill--light send" type="submit">Send the brief</button>
        <p class="muted" style="font-size:13px">Or write to <a class="link-u" href="mailto:${C.email}">${C.email}</a></p>
      </form>
    </section>`],
  };
  function ctaHTML() {
    return `<div class="cta"><span class="label">Have something in mind?</span><strong>Let's make the next one yours.</strong>
      <div class="cta__row"><button class="pill pill--light" data-open="contact">Start a project</button><button class="link-u" data-copy="${C.email}">Copy email</button></div></div>`;
  }
  function projectView(k) {
    const p = projects[k], prev = (k - 1 + NP) % NP, next = (k + 1) % NP;
    return [`${pad3(k + 1)} / ${pad3(NP)}`, `<section>
      <img class="cover" src="${covers[k]}" alt="Cover for ${p.title}" />
      <h2 id="box-h">${p.title}</h2>
      <p class="muted">${p.type} · ${p.year}</p>
      <p>${p.summary}</p>
      <div class="tags">${p.tags.map((x) => `<span>${x}</span>`).join("")}</div>
      ${ctaHTML()}
      <div class="pnav"><button class="link-u" data-project="${prev}">← ${projects[prev].title}</button><button class="link-u" data-project="${next}">${projects[next].title} →</button></div>
    </section>`];
  }

  function show([tag, html], navKey) {
    boxTag.textContent = tag; boxBody.innerHTML = html; boxBody.scrollTop = 0;
    if (!body.classList.contains("is-panel")) lastFocus = document.activeElement;
    body.classList.add("is-panel"); box.setAttribute("aria-hidden", "false");
    document.querySelectorAll(".nav-links button").forEach((b) => b.setAttribute("aria-current", String(b.dataset.open === navKey)));
    setTimeout(() => $("#close").focus({ preventScroll: true }), 50);
    bindForm();
  }
  function openPanel(name) {
    closeMenu();
    if (t < layout.cards[0].t - 1) flyTo(layout.cards[0].t - 0.9);
    show(views[name](), name);
  }
  function openProject(k) { closeMenu(); flyTo(layout.cards[k].t); show(projectView(k), ""); }
  function closePanel() {
    if (!body.classList.contains("is-panel")) return;
    body.classList.remove("is-panel"); box.setAttribute("aria-hidden", "true");
    document.querySelectorAll(".nav-links button").forEach((b) => b.setAttribute("aria-current", "false"));
    lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  }
  $("#close").addEventListener("click", closePanel);

  document.addEventListener("click", (e) => {
    const o = e.target.closest("[data-open]"); if (o) { openPanel(o.dataset.open); return; }
    const p = e.target.closest("[data-project]"); if (p) { openProject(+p.dataset.project); return; }
    const c = e.target.closest("[data-copy]");
    if (c) { navigator.clipboard?.writeText(c.dataset.copy).then(() => { c.textContent = "Copied"; setTimeout(() => (c.textContent = "Copy email"), 1600); }).catch(() => { c.textContent = C.email; }); }
    const chip = e.target.closest(".chips button");
    if (chip) {
      const g = chip.parentElement, on = chip.getAttribute("aria-pressed") !== "true";
      if (!g.dataset.multi) g.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
      chip.setAttribute("aria-pressed", String(on));
    }
  });

  function bindForm() {
    const f = $("#brief"); if (!f) return;
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(f), get = (g) => [...f.querySelectorAll(`[data-group="${g}"] [aria-pressed="true"]`)].map((b) => b.textContent).join(", ") || "-";
      if (!fd.get("name") || !String(fd.get("email")).includes("@")) { f.querySelector(fd.get("name") ? "[name=email]" : "[name=name]").focus(); return; }
      const lines = [`Name: ${fd.get("name")}`, `Email: ${fd.get("email")}`, `Company: ${fd.get("company") || "-"}`, `Needs: ${get("needs")}`, `Budget: ${get("budget")}`, "", fd.get("about") || ""];
      window.location.href = `mailto:${C.email}?subject=${encodeURIComponent("New project brief from " + fd.get("name"))}&body=${encodeURIComponent(lines.join("\n"))}`;
      const ok = document.createElement("p"); ok.className = "ok"; ok.textContent = "Your email app should open with the brief ready to send."; f.append(ok);
    });
  }

  /* Mobile menu */
  const menuBtn = $("#menu-btn"), mnav = $("#mnav");
  function closeMenu() { mnav.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); menuBtn.textContent = "Menu"; }
  menuBtn.addEventListener("click", () => {
    const open = mnav.hidden; mnav.hidden = !open; menuBtn.setAttribute("aria-expanded", String(open)); menuBtn.textContent = open ? "Close" : "Menu";
  });

  /* ------------------------------------------------------------------ */
  /* Loop                                                                */
  /* ------------------------------------------------------------------ */
  let last = performance.now(), start = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!drag && now - lastInput > 650 && morphOf(T) >= 1) {
      let best = null; layout.cards.forEach((c) => { if (Math.abs(c.t - T) < 1.1 && (!best || Math.abs(c.t - T) < Math.abs(best.t - T))) best = c; });
      if (best) T = reduce ? best.t : lerp(T, best.t, 1 - Math.exp(-dt * 3));
    }
    t = reduce ? T : lerp(t, T, 1 - Math.exp(-dt * 4.2));
    if (Math.abs(t - T) < 1e-4) t = T;
    intro = reduce ? 0 : Math.max(0, 1 - (now - start) / 2200);
    const ease = 1 - Math.pow(1 - Math.min(1, mouse.in ? 1 : 0), 2);
    mouse.sx = lerp(mouse.sx, mouse.x, 1 - Math.exp(-dt * 3)); mouse.sy = lerp(mouse.sy, mouse.y, 1 - Math.exp(-dt * 3));
    mouse.on = lerp(mouse.on, ease * (1 - morphOf(t)), 1 - Math.exp(-dt * 5));
    const pk = body.classList.contains("is-panel") ? 1 : 0;
    panelK = reduce ? pk : lerp(panelK, pk, 1 - Math.exp(-dt * 3.5));
    const cam = camState();
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform3f(U.uCam, cam.x, cam.y, cam.z);
    gl.uniform1f(U.uMorph, morphOf(t));
    gl.uniform1f(U.uTime, reduce ? 0 : now / 1000);
    gl.uniform1f(U.uMotion, reduce ? 0 : 1);
    gl.uniform1f(U.uIntro, intro);
    gl.uniform1f(U.uMouseOn, mouse.on);
    gl.uniform1f(U.uHover, 0);
    gl.uniform1f(U.uHoverId, hoverId);
    const half = cam.z * TANH; // mouse onto the portrait plane (z = 0)
    gl.uniform2f(U.uMouse, cam.x + mouse.sx * half * (window.innerWidth / window.innerHeight), cam.y + mouse.sy * half);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    updateHUD();
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  const counter = $("#loader-count");
  let shown = 0; const countUp = setInterval(() => { shown = Math.min(99, shown + 3 + Math.random() * 9); counter.textContent = pad3(Math.floor(shown)); }, 60);
  const fontsReady = Promise.race([document.fonts ? document.fonts.load('italic 40px "Instrument Serif"').then(() => document.fonts.ready) : Promise.resolve(), new Promise((r) => setTimeout(r, 2500))]);

  fontsReady.then(() => {
    if (!gl) { body.classList.add("no-gl"); canvas.style.background = "center 38% / auto 72vh no-repeat url(assets/portrait-tiles.png)"; }
    else {
      try { initGL(); } catch (err) { console.error(err); }
    }
    resize();
    clearInterval(countUp); counter.textContent = "100";
    setTimeout(() => {
      body.classList.remove("is-loading");
      start = performance.now();
      requestAnimationFrame(() => body.classList.add("is-ready"));
      if (gl) requestAnimationFrame(frame);
    }, reduce ? 0 : 350);
  });
  let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(resize, 120); });
})();
