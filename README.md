# Mudassir Sheikh — portfolio

A dark, single-screen portfolio: the hero portrait is built from thousands of small
artwork tiles (WebGL2). Scrolling breaks the portrait apart and flies the camera through
your projects. Selected, Work, About and Contact open as glass side panels.

No framework and no build step: plain HTML, CSS and JavaScript.

## Run it

Option A: double-click `index.html` (works offline except the Google Fonts).

Option B (recommended, closer to a real server):

    cd portfolio
    python3 -m http.server 8080
    # open http://localhost:8080

or `npx serve .`

## Edit content

- `content.js` — your name, intro, about text, links and projects.
  The 12 projects are PLACEHOLDERS with invented names; replace them with real work.
- `portrait-data.js` — generated from your photo (tile positions + brightness).
- `art.js` — generates the tile artwork and project covers. To use real project images
  instead, draw them into the cover atlas in `buildCoverAtlas`.
- `assets/portrait.jpg` — your photo (used for the social share image).

## Controls

Scroll / trackpad, touch drag, or ↑ ↓ / Space / Home / End. Click a project card to open it.
Reduced-motion users get instant transitions and no idle animation.

## Sound

`sound.js` plays a short synthesized tick when the mouse moves onto anything clickable:
navbar, buttons, links, form chips, project rows and the project cards in the 3D view. Browsers unlock audio only
after the visitor's first click or key press. To change which elements tick, edit `CLICKABLE`.

## Deploy

Upload the folder to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages).
