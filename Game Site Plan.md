### Project Overview
The goal is to develop a sleek, modern, dark-themed portfolio/arcade showcase for self-contained, single-file HTML games. All games run inside the browser and live as individual `.html` files in a `./games/` directory.

---

### Architecture & Technical Constraints
1. **Zero-Build Vanilla Stack:**
   - Use only raw HTML5, modern CSS3, and vanilla JavaScript (ES6+).
   - Do NOT introduce any package managers (`npm`, `yarn`), bundlers (`vite`, `webpack`), or framework dependencies.
2. **GitHub Pages Pathing Compatibility:**
   - All asset links, stylesheets, scripts, and iframe targets MUST use strict **relative paths** (e.g., `./style.css`, `./js/app.js`, `./games/game.html`).
   - Never use root-relative paths starting with `/`, as the site will be hosted on a GitHub Pages repository subfolder (`https://<username>.github.io/<repo>/`).
3. **Performance First:**
   - Keep host bundle weight under 50KB total.
   - Zero runtime framework overhead to ensure maximum CPU/GPU allocation for game canvas execution.

---

### Target File & Folder Structure
Create the following structure in the workspace root:
```text
├── index.html
├── style.css
├── js/
│   └── app.js
├── games/
│   ├── snake.html        (functional sample single-file canvas game)
│   └── breakout.html     (functional sample single-file canvas game)
└── README.md
```

---

### UI/UX & Design Specifications
- **Aesthetic:** Sleek, subtle, minimalist dark theme.
- **Design Tokens (CSS Variables):**
  - Backgrounds: Deep obsidian (`#0a0a0c`), card surface (`#121217`), elevated surface (`#1a1a22`).
  - Accents: Subtle borders (`#272732`), muted glow/hover states, high-contrast crisp typography (system font stack with fallbacks like Inter/system-ui).
  - Micro-interactions: Smooth transitions (150-200ms ease), clean hover card elevations, and subtle border highlights.
- **Layout Sections:**
  1. **Header / Hero:** Minimalist brand title, subtitle, and an integrated search bar + category tag filter bar (e.g., "All", "Arcade", "Puzzle", "Action").
  2. **Game Grid:** Fluid CSS Grid (`grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`) rendering game cards.
  3. **Game Cards:** Display game thumbnail/icon, title, short description, category tags, and a prominent "Play" trigger.
  4. **Footer:** Subtle attribution and GitHub repository link.

---

### Functional Requirements

#### 1. Dynamic Game Registry & Filtering (`js/app.js`)
- Store game metadata in a lightweight structured array/JSON format in `app.js` (Title, Description, File Path, Tags, Controls hint).
- Render game cards dynamically to the DOM.
- Implement real-time client-side search (by title/description) and tag filtering.

#### 2. Game Player Modal / Theater View
- Clicking a card opens a focus-managed theater overlay modal.
- The modal must dynamically inject an `<iframe>` targeting the selected relative game path:
  ```html
  <iframe
    src="./games/<game-name>.html"
    sandbox="allow-scripts allow-same-origin allow-pointer-lock"
    allow="fullscreen; gamepad; autoplay"
    tabindex="0"
    loading="lazy">
  </iframe>
  ```
- **Modal Toolbar Controls:**
  - **Fullscreen Toggle:** Request browser fullscreen on the iframe container via Fullscreen API.
  - **Reload / Restart:** Reload the iframe DOM without closing the modal.
  - **Close Button:** Remove the iframe from the DOM (to halt audio/animation loops) and restore body scroll.
  - **Keyboard Bindings:** Pressing `Esc` closes the modal.
  - **Focus Management:** Automatically set focus to the iframe upon opening so keyboard controls (WASD, Arrow Keys, Spacebar) register immediately without page scrolling.

#### 3. Sample Games (`./games/`)
- Create at least two lightweight, self-contained single-file HTML games (e.g., `snake.html` and `breakout.html`) with inline CSS/JS to verify iframe loading, key focus handling, and responsiveness.

---

### Step-by-Step Implementation Instructions
1. **Write `style.css`:** Set up the CSS variable system, reset, typography, responsive grid, sleek card components, search/filter inputs, and modal overlay animations.
2. **Write `index.html`:** Set up accessible HTML5 markup, meta tags for responsive mobile/desktop viewports, and structural containers for the grid and modal.
3. **Write `js/app.js`:** Implement data rendering, search/filter logic, modal open/close lifecycle, focus trapping, and iframe event handlers.
4. **Create sample games in `./games/`:** Ensure they are fully playable standalone canvas games.
5. **Write `README.md`:** Document how to add new single-file games to the `/games/` folder, how to register them in `app.js`, and step-by-step instructions on enabling GitHub Pages from repository settings (`Settings > Pages > Source: Deploy from branch > /root`).

Inspect and verify all relative file references before completing. Ensure no external CDN dependencies are used so the site works completely offline and instantly on GitHub Pages.