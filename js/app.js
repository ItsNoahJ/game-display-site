/* ============================================================
   Arcade Showcase — App Logic
   Game registry, card rendering, search/filter, theater modal.
   Zero dependencies. Relative paths only (GitHub Pages safe).
   ============================================================ */

(() => {
  "use strict";

  /* ------------------------------------------------------------
   * Game Discovery (auto)
   * Games are read from the ./games/ folder at boot — nothing to
   * register manually. The card title comes from the file name.
   *
   * How it works:
   *   1. On GitHub Pages the site derives owner/repo from its own
   *      URL and lists the folder via the GitHub Contents API
   *      (requires a PUBLIC repository, ~60 req/hr rate limit).
   *   2. Otherwise it fetches "./games/" and parses the directory
   *      listing (works with `python -m http.server`, `npx serve`,
   *      and other listing-enabled servers).
   *
   * Optional per-game metadata is read from <meta> tags inside the
   * game file itself:
   *   <meta name="description" content="Short hook.">
   *   <meta name="keywords" content="Arcade, Puzzle">
   *   <meta name="controls" content="Arrow keys to move">
   *   <meta name="aspect-ratio" content="16:9 | auto">
   * Missing tags fall back to sensible defaults.
   * ------------------------------------------------------------ */
  const DISCOVERY = {
    // Optional overrides when the repo can't be derived from the URL
    // (e.g. a custom domain). Leave null to auto-detect.
    owner: null,
    repo: null,
  };

  let GAMES = [];

  function isGitHubPagesHost() {
    return location.hostname.replace(/\.$/, "").endsWith(".github.io");
  }

  async function listViaGitHubAPI() {
    const host = location.hostname.replace(/\.$/, "");
    const owner = DISCOVERY.owner || (host.endsWith(".github.io") ? host.replace(/\.github\.io$/, "") : null);
    const repo = DISCOVERY.repo || location.pathname.split("/").filter(Boolean)[0];
    if (!owner || !repo) return [null, "Cannot determine the GitHub repository from the page URL."];
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/games`);
      if (res.status === 403) return [null, "GitHub API rate limit reached (60 requests per hour per IP)."];
      if (res.status === 404) return [null, "No `games` folder was found in the repository."];
      if (!res.ok) return [null, `GitHub API error (HTTP ${res.status}).`];
      const data = await res.json();
      if (!Array.isArray(data)) return [null, "The `games` path in the repository is not a folder."];
      const names = data
        .filter((e) => e.type === "file" && /\.html?$/i.test(e.name))
        .map((e) => e.name)
        .sort(compareNames);
      return [names, null];
    } catch (_) {
      return [null, "Network error while reaching the GitHub API."];
    }
  }

  async function listViaDirectory() {
    try {
      const res = await fetch("./games/");
      if (!res.ok) return [null, `The games folder could not be listed (HTTP ${res.status}).`];
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const seen = new Set();
      doc.querySelectorAll("a[href]").forEach((a) => {
        let href = a.getAttribute("href") || "";
        href = href.split("#")[0].split("?")[0];
        if (!href) return;
        try {
          if (/^https?:/i.test(href)) href = new URL(href).pathname;
        } catch (_) {}
        if (href.startsWith("/")) href = href.slice(1);
        const base = href.split("/").pop();
        if (!base || base === ".." || base === "." || !/\.html?$/i.test(base)) return;
        let name;
        try {
          name = decodeURIComponent(base);
        } catch (_) {
          name = base;
        }
        seen.add(name);
      });
      return [[...seen].sort(compareNames), null];
    } catch (_) {
      return [null, "The games folder could not be listed."];
    }
  }

  function compareNames(a, b) {
    return a.localeCompare(b, undefined, { numeric: true });
  }

  function prettify(id) {
    return id
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  }

  function decodeEntities(str) {
    const el = document.createElement("textarea");
    el.innerHTML = str;
    return el.value;
  }

  async function fetchGameMeta(file) {
    const out = { description: null, keywords: [], controls: null, aspect: null };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      // Range keeps the download small on servers that honor it
      // (GitHub Pages does); servers without Range return the full doc.
      const res = await fetch(file, { headers: { Range: "bytes=0-16383" }, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return out;
      const text = await res.text();
      const grab = (name) => {
        const m = text.match(new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']`, "i"));
        return m ? decodeEntities(m[1]).trim() : null;
      };
      const desc = grab("description");
      if (desc) out.description = desc;
      const kw = grab("keywords");
      if (kw) out.keywords = kw.split(",").map((s) => s.trim()).filter(Boolean);
      const ctl = grab("controls");
      if (ctl) out.controls = ctl;
      const ar = grab("aspect-ratio");
      if (ar) out.aspect = ar;
    } catch (_) {
      /* timeout or network failure — fall back to defaults */
    }
    return out;
  }

  async function buildGame(name) {
    const id = name.replace(/\.(html?)$/i, "");
    const file = "./games/" + encodeURIComponent(name);
    const meta = await fetchGameMeta(file);
    const accent = PALETTES[hashStr(id) % PALETTES.length];
    return {
      id,
      title: prettify(id),
      description: meta.description || "A self-contained single-file HTML game. Click to play.",
      file,
      tags: meta.keywords.length ? meta.keywords : ["Arcade"],
      controls: meta.controls || "Use keyboard or mouse inside the game",
      aspect: meta.aspect || "16:9",
      accent1: accent[0],
      accent2: accent[1],
      thumb: THUMBS[id] ? id : "auto",
    };
  }

  function hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  async function discoverGames() {
    let names = null;
    let error = null;
    if (isGitHubPagesHost()) {
      [names, error] = await listViaGitHubAPI();
      if (names === null && DISCOVERY.owner) {
        // custom-domain override: try the generic listing too
        const fb = await listViaDirectory();
        if (fb[0] !== null) {
          names = fb[0];
          error = null;
        }
      }
    } else {
      [names, error] = await listViaDirectory();
    }
    if (names === null) return { games: [], error };
    return { games: await Promise.all(names.map(buildGame)), error: null };
  }

  function updateHeaderCount() {
    const el = document.getElementById("header-count");
    if (!el) return;
    const n = GAMES.length;
    el.textContent = `${n} ${n === 1 ? "game" : "games"}`;
  }

  /* ------------------------------------------------------------
   * Thumbnail accent palettes (per-game, picked by filename hash)
   * ------------------------------------------------------------ */
  const PALETTES = [
    ["#ef4444", "#7f1d1d"],
    ["#3b82f6", "#1e3a8a"],
    ["#22c55e", "#14532d"],
    ["#f59e0b", "#78350f"],
    ["#a855f7", "#581c87"],
    ["#14b8a6", "#134e4a"],
    ["#f43f5e", "#881337"],
    ["#eab308", "#422006"],
  ];

  /* ------------------------------------------------------------
   * DOM References
   * ------------------------------------------------------------ */
  const grid = document.getElementById("game-grid");
  const countEl = document.getElementById("game-count");
  const statsEl = document.getElementById("grid-stats");
  const clearFiltersBtn = document.getElementById("clear-filters");
  const searchBox = document.getElementById("search-box");
  const searchInput = document.getElementById("search-input");
  const searchClear = document.getElementById("search-clear");
  const tagFilter = document.getElementById("tag-filter");
  const overlay = document.getElementById("modal-overlay");
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modal-title");
  const modalStage = document.getElementById("modal-stage");
  const btnFullscreen = document.getElementById("btn-fullscreen");
  const btnReload = document.getElementById("btn-reload");
  const btnClose = document.getElementById("btn-close");
  const controlsHint = document.getElementById("modal-controls-hint");
  const modalHeader = document.querySelector(".modal-header");
  const modalFooter = document.querySelector(".modal-footer");

  const state = {
    query: "",
    tag: "All",
    openGame: null,
    lastTrigger: null,
    iframe: null,
    loadTimer: null,
    focusTimer: null,
    loading: true,
    discoveryError: null,
  };

  /* ------------------------------------------------------------
   * Procedural Canvas Thumbnails (no external assets)
   * ------------------------------------------------------------ */
  const THUMBS = {
    snake(ctx, w, h) {
      const cell = Math.floor(Math.min(w, h) / 8);
      const pad = (w % 2) / 2;
      ctx.fillStyle = "#191919";
      ctx.fillRect(0, 0, w, h);
      // grid
      ctx.strokeStyle = "rgba(220, 38, 38, 0.07)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += cell) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += cell) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      // food
      const fx = pad + cell * 6 + cell / 2;
      const fy = cell * 2 + cell / 2;
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.arc(fx, fy, cell * 0.32, 0, Math.PI * 2);
      ctx.fill();
      // snake body
      const body = [
        [3, 6],
        [3, 5],
        [3, 4],
        [3, 3],
        [4, 3],
        [5, 3],
      ];
      body.forEach(([gx, gy], i) => {
        const size = i === 0 ? 0.42 : 0.34;
        ctx.fillStyle = i === 0 ? "#f2f2f2" : `rgba(220, 38, 38, ${0.92 - i * 0.12})`;
        roundCell(ctx, pad + gx * cell, gy * cell, cell, size);
      });
      // eyes on head
      const hx = pad + body[0][0] * cell + cell / 2;
      const hy = body[0][1] * cell + cell / 2;
      ctx.fillStyle = "#141414";
      ctx.beginPath();
      ctx.arc(hx - cell * 0.14, hy - cell * 0.12, cell * 0.06, 0, Math.PI * 2);
      ctx.arc(hx + cell * 0.14, hy - cell * 0.12, cell * 0.06, 0, Math.PI * 2);
      ctx.fill();
      // border glow
      ctx.strokeStyle = "rgba(220, 38, 38, 0.22)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    },

    breakout(ctx, w, h) {
      ctx.fillStyle = "#191919";
      ctx.fillRect(0, 0, w, h);
      const bricksTop = h * 0.16;
      const cols = 8;
      const rows = 4;
      const bw = w / cols;
      const bh = h * 0.055;
      const colors = ["#ef4444", "#dc2626", "#991b1b", "#525252"];
      for (let r = 0; r < rows; r++) {
        ctx.fillStyle = colors[Math.min(r, colors.length - 1)];
        const alpha = r === 3 ? 0.95 : 1 - r * 0.08;
        ctx.globalAlpha = alpha;
        for (let c = 0; c < cols; c++) {
          roundRect(ctx, c * bw + bw * 0.08, bricksTop + r * (bh + 6), bw * 0.84, bh, 4);
        }
      }
      ctx.globalAlpha = 1;
      // paddle
      const pw = w * 0.24;
      const ph = h * 0.03;
      roundRect(ctx, (w - pw) / 2, h * 0.78, pw, ph, ph / 2);
      ctx.fillStyle = "#f2f2f2";
      ctx.fill();
      // ball with trailing glow
      const bx = w * 0.5 + w * 0.09;
      const by = h * 0.62;
      const grad = ctx.createRadialGradient(bx, by, 1, bx, by, 9);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(220, 38, 38, 0.24)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    },

    // Generic tile for any auto-discovered game: monogram + corner brackets.
    auto(ctx, w, h, game) {
      ctx.fillStyle = "#191919";
      ctx.fillRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, game.accent1 + "33");
      grad.addColorStop(1, game.accent2 + "4d");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      const letter = ((game.title || "?").trim().charAt(0) || "?").toUpperCase();
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.font = `700 ${Math.min(w, h) * 0.36}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(letter, w / 2, h / 2 + 2);
      ctx.strokeStyle = game.accent1;
      ctx.lineWidth = 3;
      const c = 18;
      ctx.beginPath();
      ctx.moveTo(c, 5); ctx.lineTo(5, 5); ctx.lineTo(5, c);
      ctx.moveTo(w - c, 5); ctx.lineTo(w - 5, 5); ctx.lineTo(w - 5, c);
      ctx.moveTo(c, h - 5); ctx.lineTo(5, h - 5); ctx.lineTo(5, h - c);
      ctx.moveTo(w - c, h - 5); ctx.lineTo(w - 5, h - 5); ctx.lineTo(w - 5, h - c);
      ctx.stroke();
    },
  };

  function roundCell(ctx, x, y, size, radiusFactor) {
    const inset = size * (0.5 - radiusFactor);
    const r = size * radiusFactor;
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(x + inset, y + inset, size - inset * 2, size - inset * 2, r)
      : ctx.rect(x + inset, y + inset, size - inset * 2, size - inset * 2);
    ctx.fill();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
    ctx.fill();
  }

  function drawThumb(game, canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = 320;
    const h = 180;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    (THUMBS[game.thumb] || THUMBS.auto)(ctx, w, h, game);
  }

  /* ------------------------------------------------------------
   * Card rendering
   * ------------------------------------------------------------ */
  function visibleGames() {
    const q = state.query.trim().toLowerCase();
    return GAMES.filter((game) => {
      const matchesTag = state.tag === "All" || game.tags.includes(state.tag);
      if (!matchesTag) return false;
      if (!q) return true;
      const hay = `${game.title} ${game.description}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function renderTags() {
    const tags = ["All"];
    GAMES.forEach((g) => {
      g.tags.forEach((t) => {
        if (!tags.includes(t)) tags.push(t);
      });
    });
    tagFilter.innerHTML = "";
    tags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag-btn" + (tag === state.tag ? " active" : "");
      btn.textContent = tag;
      btn.dataset.tag = tag;
      btn.setAttribute("aria-pressed", String(tag === state.tag));
      btn.addEventListener("click", () => {
        state.tag = tag;
        renderTags();
        renderGrid();
      });
      tagFilter.appendChild(btn);
    });
  }

  function renderGrid() {
    grid.innerHTML = "";

    if (state.loading) {
      countEl.innerHTML = "Scanning…";
      clearFiltersBtn.hidden = true;
      const scanning = document.createElement("div");
      scanning.className = "empty-state";
      scanning.innerHTML = `
        <div class="empty-icon" aria-hidden="true">🔍</div>
        <p>Scanning the games folder…</p>`;
      grid.appendChild(scanning);
      return;
    }

    if (state.discoveryError) {
      countEl.innerHTML = "Unavailable";
      clearFiltersBtn.hidden = true;
      const error = document.createElement("div");
      error.className = "empty-state";
      error.innerHTML = `
        <div class="empty-icon" aria-hidden="true">⚠️</div>
        <p>Couldn't read the games folder.</p>
        <p>${state.discoveryError}</p>
        <p>On GitHub Pages the repository must be public. Locally, serve this folder
        with directory listing enabled (e.g. <code>python -m http.server</code>).</p>`;
      grid.appendChild(error);
      return;
    }

    if (!GAMES.length) {
      countEl.innerHTML = "No games yet";
      clearFiltersBtn.hidden = true;
      const emptyFolder = document.createElement("div");
      emptyFolder.className = "empty-state";
      emptyFolder.innerHTML = `
        <div class="empty-icon" aria-hidden="true">🕹️</div>
        <p>The games folder is empty.</p>
        <p>Drop a single-file HTML game into <code>./games/</code> and reload — it appears here automatically.</p>`;
      grid.appendChild(emptyFolder);
      return;
    }

    const games = visibleGames();

    countEl.innerHTML = `Showing <b>${games.length}</b> of <b>${GAMES.length}</b> games`;
    clearFiltersBtn.hidden = !(state.query.trim() || state.tag !== "All");

    if (!games.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `
        <div class="empty-icon" aria-hidden="true">🕹️</div>
        <p>No games match your search.</p>
        <p>Try a different keyword or category.</p>`;
      grid.appendChild(empty);
      return;
    }

    games.forEach((game, i) => {
      const card = document.createElement("article");
      card.className = "game-card";
      card.tabIndex = 0;
      card.dataset.id = game.id;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `Play ${game.title}: ${game.description}`);
      card.style.animationDelay = `${Math.min(i * 45, 400)}ms`;
      card.innerHTML = `
        <div class="game-thumb">
          <canvas width="320" height="180" aria-hidden="true"></canvas>
        </div>
        <div class="card-body">
          <h3 class="game-title">${game.title}</h3>
          <p class="game-desc">${game.description}</p>
          <div class="game-card-foot">
            <div class="game-tags">
              ${game.tags.map((t) => `<span class="game-tag">${t}</span>`).join("")}
            </div>
            <span class="play-btn"><span class="play-icon" aria-hidden="true">→</span> Play</span>
          </div>
          <div class="kbd-hint">
            <kbd>Enter</kbd> <span>to play</span>
          </div>
        </div>`;

      card.addEventListener("click", () => openModal(game, card));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal(game, card);
        }
      });
      grid.appendChild(card);
      drawThumb(game, card.querySelector("canvas"));
    });
  }

  function updateSearchUI() {
    searchBox.classList.toggle("has-text", searchInput.value.length > 0);
  }

  /* ------------------------------------------------------------
   * Theater Modal
   * ------------------------------------------------------------ */

  // Games are shown in a fixed-aspect frame (16:9 by default) that
  // letterboxes inside the stage, so a game's internal render buffer
  // never gets stretched by an arbitrary window shape. "auto" opts
  // a game out and lets it fill the stage freely.
  function aspectValue(game) {
    const raw = String((game && game.aspect) || "16:9");
    if (/^(auto|free|any)$/i.test(raw)) return 0;
    const m = raw.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
    if (!m) return 16 / 9;
    const a = parseFloat(m[1]) / parseFloat(m[2]);
    return a > 0 && isFinite(a) ? a : 16 / 9;
  }

  function fitGameFrame() {
    const iframe = state.iframe;
    if (!iframe || !state.openGame || !overlay.classList.contains("open")) return;
    const ar = aspectValue(state.openGame);
    if (!ar) {
      iframe.style.width = "";
      iframe.style.height = "";
      return;
    }
    const pad = parseFloat(getComputedStyle(modalStage).paddingLeft) || 0;
    const availW = Math.max(1, modalStage.clientWidth - pad * 2);
    const availH = Math.max(1, modalStage.clientHeight - pad * 2);
    let w = availW;
    let h = availW / ar;
    if (h > availH) {
      h = availH;
      w = availH * ar;
    }
    iframe.style.width = Math.floor(w) + "px";
    iframe.style.height = Math.floor(h) + "px";
  }

  // Size the modal so the STAGE content area is exactly the game's aspect
  // (16:9 by default) — otherwise the stage ends up wider than the game and
  // the frame letterboxes with side bars. The CSS 16:9 rule remains the
  // fallback for "auto" games, mobile, and fullscreen.
  const MOBILE_QUERY = matchMedia("(max-width: 760px)");

  function sizeModal() {
    if (!state.openGame || MOBILE_QUERY.matches || document.fullscreenElement) return;
    const ar = aspectValue(state.openGame);
    if (!ar) {
      modal.style.width = "";
      modal.style.height = "";
      return;
    }
    const stagePad = parseFloat(getComputedStyle(modalStage).paddingLeft) || 0;
    const chromeH = (modalHeader ? modalHeader.offsetHeight : 0) + (modalFooter ? modalFooter.offsetHeight : 0);
    const ovlPad = parseFloat(getComputedStyle(overlay).paddingLeft) || 0;
    const availW = Math.max(1, overlay.clientWidth - ovlPad * 2);
    const availH = Math.max(1, overlay.clientHeight - ovlPad * 2);
    let stageH = Math.min(availH - chromeH - stagePad * 2, (availW - stagePad * 2) / ar);
    stageH = Math.max(120, stageH);
    modal.style.height = Math.floor(stageH + chromeH + stagePad * 2) + "px";
    modal.style.width = Math.floor(stageH * ar + stagePad * 2) + "px";
  }

  function buildIframe(game) {
    const iframe = document.createElement("iframe");
    iframe.src = game.file;
    iframe.title = game.title;
    iframe.tabIndex = 0;
    iframe.loading = "lazy";
    iframe.sandbox = "allow-scripts allow-same-origin allow-pointer-lock";
    iframe.allow = "fullscreen; gamepad; autoplay";
    iframe.addEventListener("load", () => {
      stopLoadSpinner();
      fitGameFrame();
      focusGame();
      forwardKeys(iframe);
    });
    return iframe;
  }

  // Forward Escape/F/R to the host page even while the game has focus.
  function forwardKeys(iframe) {
    try {
      const win = iframe.contentWindow;
      if (!win) return;
      win.addEventListener("keydown", (e) => {
        if (["Escape", "f", "r"].includes(e.key)) handleGlobalKey(e);
      });
    } catch (_) {
      /* sandbox or cross-origin — ignore */
    }
  }

  function focusGame() {
    clearInterval(state.focusTimer);
    state.focusTimer = setInterval(() => {
      if (!state.iframe) return clearInterval(state.focusTimer);
      try {
        state.iframe.contentWindow && state.iframe.contentWindow.focus();
      } catch (_) {}
      state.iframe.focus();
    }, 150);
  }

  function stopFocusPoll() {
    clearInterval(state.focusTimer);
  }

  function showLoadSpinner() {
    clearTimeout(state.loadTimer);
    const hint = document.createElement("div");
    hint.id = "stage-loading";
    hint.setAttribute("aria-hidden", "true");
    hint.style.cssText =
      "position:absolute;inset:14px;display:grid;place-items:center;color:var(--text-muted);font-size:14px;background:transparent;pointer-events:none;";
    hint.textContent = "Loading game…";
    modalStage.appendChild(hint);
    state.loadTimer = setTimeout(() => hint.remove(), 4000);
  }

  function stopLoadSpinner() {
    const hint = document.getElementById("stage-loading");
    if (hint) hint.remove();
  }

  function openModal(game, trigger) {
    state.openGame = game;
    state.lastTrigger = trigger || null;

    modalTitle.textContent = `${game.title} — ${game.tags.join(" · ")}`;
    controlsHint.textContent = `${game.controls || "Use keyboard or mouse inside the game"}`;

    showLoadSpinner();
    state.iframe = buildIframe(game);
    modalStage.appendChild(state.iframe);

    overlay.classList.add("open");
    document.body.classList.add("modal-open");
    document.documentElement.classList.add("modal-open");

    sizeModal();
    fitGameFrame();

    // focus the iframe so keyboard controls work immediately
    focusGame();
  }

  function reloadGame() {
    if (!state.iframe) return;
    showLoadSpinner();
    try {
      state.iframe.contentWindow.location.reload();
    } catch (_) {
      const game = state.openGame;
      state.iframe.remove();
      state.iframe = buildIframe(game);
      modalStage.appendChild(state.iframe);
      fitGameFrame();
    }
  }

  function closeModal() {
    if (state.iframe) {
      state.iframe.remove();
      state.iframe = null;
    }
    stopFocusPoll();
    stopLoadSpinner();
    overlay.classList.remove("open");
    document.body.classList.remove("modal-open");
    document.documentElement.classList.remove("modal-open");
    state.openGame = null;
    if (document.fullscreenElement === modal) {
      document.exitFullscreen && document.exitFullscreen();
    }
    if (state.lastTrigger) {
      state.lastTrigger.focus();
      state.lastTrigger = null;
    }
  }

  function toggleFullscreen() {
    if (!overlay.classList.contains("open")) return;
    if (document.fullscreenElement) {
      document.exitFullscreen && document.exitFullscreen();
    } else {
      modal.requestFullscreen && modal.requestFullscreen();
    }
  }

  function syncFullscreenLabel() {
    const isFs = !!document.fullscreenElement;
    btnFullscreen.innerHTML = isFs
      ? '<span aria-hidden="true">⤢</span><span class="txt">Exit</span>'
      : '<span aria-hidden="true" class="fs-icon">⛶</span><span class="txt">Fullscreen</span>';
  }

  /* ------------------------------------------------------------
   * Global keys & focus trap
   * ------------------------------------------------------------ */
  function handleGlobalKey(e) {
    if (!overlay.classList.contains("open")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }
    const key = e.key.toLowerCase();
    if (key === "f") {
      e.preventDefault();
      toggleFullscreen();
    } else if (key === "r" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      reloadGame();
    }
  }

  document.addEventListener("keydown", handleGlobalKey);
  document.addEventListener("fullscreenchange", () => {
    syncFullscreenLabel();
    if (document.fullscreenElement) {
      // fullscreen fills the screen — let the CSS/UA sizing take over
      modal.style.width = "";
      modal.style.height = "";
    } else {
      sizeModal();
    }
    fitGameFrame();
  });
  window.addEventListener("resize", () => {
    if (state.openGame) {
      sizeModal();
      fitGameFrame();
    }
  });

  // Lightweight focus trap: keep Tab cycling within the modal toolbar.
  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || !overlay.classList.contains("open")) return;
    const focusables = modal.querySelectorAll("button, [tabindex]:not([tabindex='-1'])");
    const list = Array.from(focusables).filter((el) => !el.disabled && el.offsetParent !== null);
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !modal.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !modal.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  });

  /* ------------------------------------------------------------
   * Search & filter wiring
   * ------------------------------------------------------------ */
  searchInput.addEventListener("input", () => {
    state.query = searchInput.value;
    updateSearchUI();
    renderGrid();
  });

  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    state.query = "";
    updateSearchUI();
    renderGrid();
    searchInput.focus();
  });

  clearFiltersBtn.addEventListener("click", () => {
    state.query = "";
    state.tag = "All";
    searchInput.value = "";
    updateSearchUI();
    renderTags();
    renderGrid();
  });

  btnFullscreen.addEventListener("click", toggleFullscreen);
  btnReload.addEventListener("click", reloadGame);
  btnClose.addEventListener("click", closeModal);

  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) closeModal();
  });

  /* ------------------------------------------------------------
   * Boot
   * ------------------------------------------------------------ */
  document.getElementById("footer-year").textContent = new Date().getFullYear();
  renderGrid();

  async function init() {
    const found = await discoverGames();
    GAMES = found.games;
    state.loading = false;
    state.discoveryError = found.error;
    updateHeaderCount();
    renderTags();
    renderGrid();
  }

  init();
})();
