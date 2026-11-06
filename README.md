# Keshav Prashar — Developer Portfolio

Live site: **https://keshavprash.github.io/Keshav-portfolio/**

A cinematic 2D + 3D portfolio. A real Three.js world sits behind the page, and an original anime-inspired character painted in 2D stands inside it. Each section of the page is a camera shot.

## Stack

Plain HTML, CSS and JavaScript modules, with no framework and no build step. Three.js is the only library, and it only downloads on devices that will use it.

| Path | Purpose |
|---|---|
| `index.html`, `css/site.css` | The page and its design |
| `js/site.js` | Entry point |
| `js/ui/` | Navigation, scroll interactions, copy-email |
| `js/3d/capability.js` | Chooses a quality tier, before any 3D code loads |
| `js/3d/stage.js` | Lazy-loads the scene, crossfades, handles fallback |
| `js/3d/scene.js` | Renderer and world setup, resize, disposal |
| `js/3d/loop.js` | Animation loop, pausing, frame-rate governor |
| `js/3d/camera-rig.js` | Camera shots, scroll and pointer control |
| `js/3d/post.js` | HDR pipeline and bloom |
| `js/3d/world/` | Sky, city, signs, rooftop, workstation, character, weather |
| `js/fallback/parallax-2d.js` | 2D parallax and rain |
| `.github/workflows/static.yml` | GitHub Pages deployment |
| `CREDITS.md` | Asset and licence record |

## How it adapts

| Device | Experience |
|---|---|
| Dedicated GPU | Full 3D: live reflections, MSAA, bloom |
| Integrated GPU, capable phone | 3D at reduced resolution and effects |
| Weak phone | Simple 3D: no post-processing or reflections |
| Reduced motion (includes Windows "Adjust for best performance") | The real 3D scene held still: no loop, no camera travel, cuts between shots. A **Play scene** button opts in to motion |
| No WebGL2, software rendering, data saver | The 2D layered scene. Three.js is never downloaded |
| No JavaScript | The 2D scene and all content |

If a device really cannot hold its frame rate, the scene steps its own quality down, and finally hands over to the 2D scene. A low frame rate alone does not trigger this, because browsers throttle a window covered by another one: the real GPU cost of a frame is measured first. Rendering stops while the tab is hidden and slows while reading below the hero.

Add `?quality=high`, `medium`, `low` or `2d` to the URL to view a specific path. Add `&lockquality` to stop the scene adjusting itself.

## Editing content

All text is in `index.html`. Project links go in each `.project` card, and only verified links should be added. To restore a résumé link, make the Google Drive file viewable by "Anyone with the link" first, then add it to the nav in `index.html`.

## Updating Three.js

`js/vendor/three.custom.min.js` is a tree-shaken build that exports only what the site uses. To rebuild it, create an entry file that re-exports those names from `three` (plus `Reflector` from `three/addons/objects/Reflector.js`), then run:

```bash
npx esbuild entry.js --bundle --minify --format=esm --target=es2020 --legal-comments=none --outfile=js/vendor/three.custom.min.js
```

## Local preview

JavaScript modules need a web server, so opening `index.html` directly will not run them.

```bash
npx serve .
```

## Older files

The previous theme's assets (`css/style.css`, `js/main.js`, jQuery, Bootstrap and others) remain in the repository but are not loaded by the page. Recovery points: branch `backup/original-main`, tags `backup-pre-upgrade-2026-11-06` and `backup-pre-3d-2026-11-06`.
