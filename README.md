# Arcade — Instant Browser Games

A sleek, dark-themed arcade showcase for **self-contained, single-file HTML games**.
Every game is one `.html` file with inline CSS/JS inside `./games/`. No build step,
no dependencies, no CDN — it runs offline and deployable to **GitHub Pages**.

## Structure

```text
├── index.html        Landing page (hero, search, filter, grid)
├── style.css         Dark theme, tokens, grid, cards, modal
├── js/
│   └── app.js        Game auto-discovery, rendering, filtering, theater modal
├── games/
│   ├── Delve.html    Single-file HTML game (auto-detected)
│   └── Delve.webp    Card artwork (image matching the game name)
└── README.md
```

## Adding a new game

1. **Drop the file in** — save your game as a single self-contained HTML file:
   ```
   games/
   └── mygame.html
   ```
   Keep everything (CSS, JS, assets) inside that one file. If you must use external
   files, use relative paths from the game file (e.g. `./assets/sprite.png`) and keep
   them inside the repo.

2. **Push to GitHub** (or reload the page on a local server). That's it.

   The site scans `./games/` automatically at load:
   - **GitHub Pages:** the site derives `owner/repo` from its own URL and lists the
     folder via the GitHub Contents API. Requires a **public** repository
     (rate limit: ~60 requests/hour/IP). Note: newly pushed files need one normal
     deploy — the API lists the current state of the repo.
   - **Local servers:** any server with directory listing enabled
     (`python -m http.server`, `npx serve`) — the page reads the listing directly.

3. **Naming & metadata (all optional):**
   - The card **title** is the file name, prettified (`my_game.html` → `My Game`).
   - The card **description, tags, and controls hint** are read from `<meta>` tags
     in the game file's `<head>`:
     ```html
     <meta name="description" content="Short hook describing the game.">
     <meta name="keywords" content="Arcade, Puzzle">
     <meta name="controls" content="Arrow keys to move · Space to jump">
     ```
   - Missing tags fall back to defaults (description → generic blurb,
     keywords → `Arcade`, controls → generic hint).
   - Games play in a **16:9 frame** that letterboxes inside the modal, so the
     game's viewport never changes shape with the browser window. A game that
     adapts to any window can opt out with
     `<meta name="aspect-ratio" content="auto">`; other ratios are supported too
     (`<meta name="aspect-ratio" content="4:3">`).
   - **Card artwork:** drop an image next to the game file with the same base
     name and it becomes the card's artwork automatically:
     ```
     games/
     ├── mygame.html
     └── mygame.png   ← artwork (png, jpg, jpeg, webp, gif, svg, avif)
     ```
     If several formats exist for one game, the first of
     `png → jpg → jpeg → webp → gif → svg → avif` wins. Matching is
     case-insensitive (`MYGAME.PNG` works for `mygame.html`). Images without a
     matching game are ignored. **Use WebP if possible** — it's the smallest
     format by far (a raw game screenshot saved as PNG can be several MB and
     slows down the first paint of the card).
   - Thumbnails: games without artwork get a procedurally drawn canvas thumb —
     see the `THUMBS` painters in `app.js` for `id → drawer` mapping; anything
     without a painter gets a monogram tile with an accent color chosen from
     the file name.

4. **Search and tag filters pick everything up automatically.**

> **Private repositories** can't be auto-listed (the API needs a token). For a
> private repo, either make it public, or set the `DISCOVERY.owner` / `DISCOVERY.repo`
> overrides in `js/app.js` and open the site through a listing-enabled local server.

## Sample games

| Game | Controls |
|---|---|
| Delve | `←` `→` `↑` `↓` or `WASD` move · `Space` interact · `Enter` confirm |

## Local preview

Any static server with directory listing works — the page needs to be able to
fetch `./games/` and read the listing:

```bash
python -m http.server 8080
# then visit http://localhost:8080
```

Opening `index.html` directly from disk (`file://`) is **not** supported:
browsers block the fetch the page uses to discover games.

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. Go to your repo: **Settings → Pages**.
3. Under *Build and deployment → Source*, select **Deploy from a branch**.
4. Set **Branch** to your main branch and the folder to **/ (root)**.
5. Click **Save**. Wait ~1 minute for the first deploy.
6. Your site is live at `https://<username>.github.io/<repository-name>/`.

> All links use relative paths (`./games/…`), so hosting in a subfolder
> (`/<repo>/`) just works — no config changes needed.

## Keyboard shortcuts (theater modal)

| Key | Action |
|---|---|
| `Esc` | Close the game (stops audio/loops, removes iframe) |
| `F` | Passed through to the game — the site never uses it (Delve needs it) |
| `R` | Reload / restart the game |
| `Tab` | Cycles modal toolbar (focus trap) |

Fullscreen is toggled from the ⛶ button that hovers over the game frame.
Hover the frame when the controls are hidden.
