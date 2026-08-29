# Arcade — Instant Browser Games

A sleek, dark-themed arcade showcase for **self-contained HTML games**. Each game
is a single `.html` file, or a folder with an `index.html` plus any assets, inside
`./games/`. No build step, no dependencies, no CDN — deployable to **GitHub Pages**.

## Structure

```text
├── index.html        Landing page (hero, search, filter, grid)
├── style.css         Dark theme, tokens, grid, cards, modal
├── js/
│   └── app.js        Game auto-discovery, rendering, filtering, theater modal
├── games/
│   ├── Delve.html    Single-file HTML game (auto-detected)
│   ├── Delve.webp    Card artwork (image matching the game name)
│   ├── FolderGame/   Multi-file game: index.html + any number of assets
│   └── ...           Any file or folder you drop in appears automatically
└── README.md
```

## Adding a new game

1. **Drop it in** — two ways:

   Single file — everything (CSS/JS/assets) inline in one HTML file:
   ```
   games/
   └── mygame.html
   ```
   Whole folder — when a game needs multiple files, use a folder:
   ```
   games/
   └── mygame/
       ├── index.html         ← the entry point
       ├── sprites/           ← any assets, however you like
       └── sound.mp3
   ```
   Inside the folder, relative paths are normal — the game is served from its own
   folder (`./assets/sprite.png` just works) and the iframe loads
   `games/mygame/index.html`.

2. **Push to GitHub** (or reload the page on a local server). That's it.

   The site scans `./games/` automatically at load:
   - **GitHub Pages:** the site derives `owner/repo` from its own URL and lists the
     repository via the GitHub Trees API (2 requests per load, whatever the game
     count). Requires a **public** repository (rate limit: ~60 requests/hour/IP).
     Note: newly pushed files need one normal deploy — the API lists the current
     state of the repo.
   - **Local servers:** any server with directory listing enabled
     (`python -m http.server`, `npx serve`) — the page reads the listing directly.

3. **Naming & metadata (all optional):**
   - The card **title** is the name of the file/folder, prettified
     (`my_game` → `My Game`).
   - The card **description, tags, and controls hint** are read from `<meta>` tags
     in the entry file's `<head>`:
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
   - **Card artwork:** an image named like the game becomes the card's artwork:
     ```
     games/
     ├── mygame.html      ──OR──  games/
     └── mygame.png               └── mygame/
                                     ├── index.html
                                     └── mygame.webp   ← inside the folder works too
     ```
     Accepted formats: `png, jpg, jpeg, webp, gif, svg, avif`. If several formats
     exist for one game, `png → jpg → jpeg → webp → gif → svg → avif` wins.
     Matching is case-insensitive (`MYGAME.PNG` works for `mygame.html`). Images
     without a matching game are ignored. **Use WebP if possible** — it's the
     smallest format by far (a raw game screenshot saved as PNG can be several MB
     and slows down the first paint of the card).
   - Thumbnails: games without artwork get a procedurally drawn canvas thumb —
     see the `THUMBS` painters in `app.js` for `id → drawer` mapping; anything
     without a painter gets a monogram tile with an accent color chosen from
     the game name.

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
