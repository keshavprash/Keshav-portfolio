# Keshav Prashar — Developer Portfolio

Live site: **https://keshavprash.github.io/Keshav-portfolio/**

A static, dependency-free portfolio for Keshav Prashar — Full Stack Developer (React.js / MERN stack).

## Stack

Plain HTML, CSS and JavaScript. No build step, no framework, no runtime dependencies.

| File | Purpose |
|---|---|
| `index.html` | The entire page |
| `css/site.css` | Design system, components, responsive rules, reduced-motion rules |
| `js/site.js` | Nav, scrollspy, reveals, typing, parallax, petal canvas, tabs, copy-email |
| `robots.txt`, `sitemap.xml` | SEO |
| `.github/workflows/static.yml` | GitHub Pages deployment — **do not modify** |

## The hero animation

The night-rooftop scene and the seated developer figure are original SVG artwork
authored for this site. Nothing is traced from or derived from any existing
character, artwork or franchise.

Layers are moved on pointer and scroll via `transform: translate3d` only.
Drifting petals are drawn on a `<canvas>` that pauses when the hero scrolls out of
view or the tab is hidden. All of it is disabled under `prefers-reduced-motion: reduce`.

## Adding project links later

No repository or live-demo URLs have been verified, so no link buttons are rendered.
Search `index.html` for `ADDING LINKS LATER` — the comment there contains the exact
block to paste into a project card. Styling is already in place.

## Legacy files

The previous theme's assets (`css/style.css`, `js/main.js`, jQuery, Bootstrap, AOS,
Owl, Stellar, Scrollax, Magnific, particles.js, icomoon and flaticon fonts) are kept
in the repository but are no longer referenced by `index.html`. They are retained so
the original design can be restored. Branch `backup/original-main` and tag
`backup-pre-upgrade-2026-11-06` hold the pre-upgrade site.

## Local preview

```bash
python3 -m http.server 8080
# then open http://localhost:8080/
```
