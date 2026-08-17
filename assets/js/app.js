/* ===================================================================
   QuoteStream — app.js
   Scans data/library.json and renders a Netflix-style archive.
   =================================================================== */
"use strict";

const DATA_URL = "data/library.json";

const state = {
  items: [],       // normalized library items
  filter: "all",   // all | movie | series
  query: "",       // search string
};

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", init);

async function init() {
  wireChrome();
  try {
    const raw = await fetchLibrary();
    state.items = raw.map(normalize).filter(Boolean);
  } catch (err) {
    showError(err);
    return;
  }
  renderHero(pickFeatured(state.items));
  render();
}

async function fetchLibrary() {
  const res = await fetch(DATA_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${DATA_URL} (HTTP ${res.status})`);
  const json = await res.json();
  // Accept either a bare array or { library: [...] }
  const list = Array.isArray(json) ? json : json.library;
  if (!Array.isArray(list)) throw new Error("library.json must be an array or have a `library` array.");
  return list;
}

/* ---------- Normalize one entry ---------- */
function normalize(raw, i) {
  if (!raw || !raw.title) return null;
  const type = (raw.type || "movie").toLowerCase() === "series" ? "series" : "movie";
  const item = {
    id: raw.id || slug(raw.title) || "item-" + i,
    title: raw.title,
    type,
    year: raw.year || "",
    genres: Array.isArray(raw.genre) ? raw.genre : (raw.genre ? [raw.genre] : []),
    rating: raw.rating || "",
    duration: raw.duration || "",
    description: raw.description || "",
    poster: raw.poster || "",
    backdrop: raw.backdrop || raw.poster || "",
    featured: !!raw.featured,
  };

  if (type === "series") {
    // Support either `seasons: [{season, episodes:[...]}]` or flat `episodes: [...]`
    let seasons = raw.seasons;
    if (!Array.isArray(seasons)) {
      if (Array.isArray(raw.episodes)) seasons = [{ season: 1, episodes: raw.episodes }];
      else seasons = [];
    }
    item.seasons = seasons.map((s, si) => ({
      season: s.season != null ? s.season : si + 1,
      episodes: (Array.isArray(s.episodes) ? s.episodes : []).map((e, ei) => ({
        episode: e.episode != null ? e.episode : ei + 1,
        title: e.title || `Episode ${ei + 1}`,
        src: e.src || "",
        duration: e.duration || "",
        description: e.description || "",
        thumb: e.thumb || "",
        subs: normSubs(e.subs),
      })),
    }));
    const first = item.seasons[0] && item.seasons[0].episodes[0];
    item.src = first ? first.src : "";
    item.episodeCount = item.seasons.reduce((n, s) => n + s.episodes.length, 0);
  } else {
    item.src = raw.src || raw.url || "";
  }
  item.subs = normSubs(raw.subs); // movie subs, or series-level fallback used when an episode has none
  return item;
}

/* Normalize a subtitle list: [{ label, lang, src, default }] */
function normSubs(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => ({
    label: s.label || s.language || s.lang || "Subtitles",
    lang: s.lang || s.srclang || s.code || "",
    src: s.src || s.url || "",
    default: !!s.default,
  })).filter((s) => s.src);
}

/* ---------- Featured pick ---------- */
function pickFeatured(items) {
  if (!items.length) return null;
  const flagged = items.filter((x) => x.featured);
  const pool = flagged.length ? flagged : items;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ---------- Hero ---------- */
function renderHero(item) {
  const hero = document.getElementById("hero");
  if (!item) { hero.style.display = "none"; return; }
  document.getElementById("hero-backdrop").style.background = posterBg(item, true);

  const meta = [
    item.type === "series" ? "Series" : "Movie",
    item.year,
    item.rating,
    item.type === "series" ? `${item.episodeCount} episodes` : item.duration,
  ].filter(Boolean);

  document.getElementById("hero-content").innerHTML = `
    <div class="hero__badge"><b>&#9632;</b> Featured on The Quote Library</div>
    <h1 class="hero__title">${esc(item.title)}</h1>
    <div class="hero__meta">${meta.map((m, i) => `${i ? '<span class="dot"></span>' : ""}<span>${esc(m)}</span>`).join("")}</div>
    <p class="hero__desc">${esc(item.description || "Streamed together in The Quote Library. Hit play to watch it in the archive.")}</p>
    <div class="hero__actions">
      <button class="btn btn--play" data-play="${item.id}">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg> Play
      </button>
      <button class="btn btn--info" data-open="${item.id}">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/></svg> More Info
      </button>
    </div>`;
}

/* ---------- Main render (rows) ---------- */
function render() {
  const rowsEl = document.getElementById("rows");
  const emptyEl = document.getElementById("empty");
  const loading = document.getElementById("loading");
  if (loading) loading.remove();

  const filtered = state.items.filter(matchesFilter);
  rowsEl.innerHTML = "";

  if (!filtered.length) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  const groups = buildRows(filtered);
  for (const g of groups) {
    if (!g.items.length) continue;
    rowsEl.appendChild(renderRow(g.title, g.items));
  }
}

function matchesFilter(item) {
  if (state.filter !== "all" && item.type !== state.filter) return false;
  if (state.query) {
    const hay = `${item.title} ${item.genres.join(" ")} ${item.year} ${item.description}`.toLowerCase();
    if (!hay.includes(state.query)) return false;
  }
  return true;
}

/* Build the list of rows to display. When searching, one flat "Results" row. */
function buildRows(items) {
  if (state.query) return [{ title: `Results for “${state.query}”`, items }];

  const rows = [];
  // Series / Movies overview rows (only in "all" view)
  if (state.filter === "all") {
    const series = items.filter((x) => x.type === "series");
    const movies = items.filter((x) => x.type === "movie");
    if (series.length) rows.push({ title: "Series", items: series });
    if (movies.length) rows.push({ title: "Movies", items: movies });
  }

  // Genre rows
  const byGenre = new Map();
  for (const item of items) {
    const gs = item.genres.length ? item.genres : ["Uncategorized"];
    for (const g of gs) {
      if (!byGenre.has(g)) byGenre.set(g, []);
      byGenre.get(g).push(item);
    }
  }
  [...byGenre.keys()].sort().forEach((g) => rows.push({ title: g, items: byGenre.get(g) }));
  return rows;
}

function renderRow(title, items) {
  const row = el("section", "row");
  row.innerHTML = `
    <div class="row__head">
      <h2 class="row__title">${esc(title)}</h2>
      <span class="row__count">${items.length} title${items.length === 1 ? "" : "s"}</span>
    </div>
    <div class="row__track"></div>`;
  const track = row.querySelector(".row__track");
  items.forEach((item) => track.appendChild(renderCard(item)));
  return row;
}

function renderCard(item) {
  const card = el("article", "card");
  card.dataset.open = item.id;
  const sub = item.type === "series"
    ? `${item.seasons.length} season${item.seasons.length === 1 ? "" : "s"} · ${item.episodeCount} ep`
    : [item.year, item.duration].filter(Boolean).join(" · ");

  card.innerHTML = `
    <span class="card__badge badge--${item.type}">${item.type === "series" ? "Series" : "Movie"}</span>
    ${item.poster
      ? `<img class="card__img" src="${esc(item.poster)}" alt="${esc(item.title)} poster" loading="lazy" />`
      : `<div class="card__poster" style="background:${posterBg(item)}"><span class="card__poster-title">${esc(item.title)}</span></div>`}
    <div class="card__overlay">
      <h4>${esc(item.title)}</h4>
      <p>${esc(sub)}</p>
    </div>`;
  return card;
}

/* ---------- Detail modal ---------- */
function openModal(id) {
  const item = state.items.find((x) => x.id === id);
  if (!item) return;

  document.getElementById("modal-hero").style.background = posterBg(item, true);
  document.getElementById("modal-title").textContent = item.title;
  document.getElementById("modal-desc").textContent =
    item.description || "No description on file yet — press play and enjoy.";

  const meta = [
    item.type === "series" ? "Series" : "Movie",
    item.year,
    item.type === "series" ? `${item.episodeCount} episodes` : item.duration,
  ].filter(Boolean);
  const hasSubs = item.type === "movie"
    ? item.subs.length > 0
    : (item.subs.length > 0 || item.seasons.some((s) => s.episodes.some((e) => e.subs.length)));
  document.getElementById("modal-meta").innerHTML =
    (item.rating ? `<span class="pill">${esc(item.rating)}</span>` : "") +
    (hasSubs ? `<span class="pill">CC</span>` : "") +
    meta.map((m) => `<span>${esc(m)}</span>`).join('<span class="dot"></span>');

  document.getElementById("modal-tags").innerHTML =
    item.genres.map((g) => `<span class="tag">${esc(g)}</span>`).join("");

  // Play button (plays movie, or first episode of a series)
  const playBtn = document.getElementById("modal-play");
  playBtn.onclick = () => {
    if (item.type === "series") {
      const first = item.seasons[0] && item.seasons[0].episodes[0];
      if (first) playVideo(first.src, `${item.title} — S${item.seasons[0].season}:E${first.episode} ${first.title}`, epSubs(item, first));
    } else {
      playVideo(item.src, item.title, item.subs);
    }
  };

  // Episodes (series only)
  renderEpisodes(item);

  const modal = document.getElementById("modal");
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function renderEpisodes(item) {
  const wrap = document.getElementById("episodes");
  if (item.type !== "series" || !item.seasons.length) { wrap.innerHTML = ""; return; }

  const drawSeason = (idx) => {
    const season = item.seasons[idx];
    const list = season.episodes.map((ep) => `
      <div class="ep" data-src="${esc(ep.src)}" data-title="${esc(`${item.title} — S${season.season}:E${ep.episode} ${ep.title}`)}">
        <div class="ep__num">${ep.episode}</div>
        <div class="ep__thumb" style="background:${ep.thumb ? `center/cover url('${esc(ep.thumb)}')` : posterBg(item)}">
          <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path fill="#fff" d="M8 5v14l11-7z"/></svg>
        </div>
        <div class="ep__info">
          <h4>${ep.episode}. ${esc(ep.title)}</h4>
          <p>${esc(ep.description || "")}</p>
        </div>
        <div class="ep__dur">${esc(ep.duration || "")}</div>
      </div>`).join("");

    wrap.innerHTML = `
      <div class="episodes__head">
        <h3>Episodes</h3>
        ${item.seasons.length > 1
          ? `<select class="season-select">${item.seasons.map((s, i) =>
              `<option value="${i}" ${i === idx ? "selected" : ""}>Season ${s.season}</option>`).join("")}</select>`
          : ""}
      </div>
      <div class="episodes__list">${list}</div>`;

    const sel = wrap.querySelector(".season-select");
    if (sel) sel.onchange = (e) => drawSeason(+e.target.value);

    wrap.querySelectorAll(".ep").forEach((row, i) => {
      const ep = season.episodes[i];
      row.onclick = () => playVideo(ep.src, row.dataset.title, epSubs(item, ep));
    });
  };

  drawSeason(0);
}

/* Episode's own subs, falling back to series-level subs. */
function epSubs(item, ep) {
  return ep && ep.subs && ep.subs.length ? ep.subs : (item.subs || []);
}

function closeModal() {
  document.getElementById("modal").hidden = true;
  if (document.getElementById("player").hidden) document.body.style.overflow = "";
}

/* ---------- Player ---------- */
function playVideo(src, title, subs) {
  const player = document.getElementById("player");
  const video = document.getElementById("video");
  document.getElementById("player-title").textContent = title || "";

  if (!src) {
    alert("No stream path is set for this title yet.\n\nAdd its file path in data/library.json to make it playable.");
    return;
  }

  // Reset any previous source + subtitle tracks
  while (video.firstChild) video.removeChild(video.firstChild);
  video.removeAttribute("src");
  video.setAttribute("src", src);

  // Add subtitle tracks (WebVTT sidecar files)
  const list = Array.isArray(subs) ? subs.filter((s) => s && s.src) : [];
  const hasDefault = list.some((s) => s.default);
  list.forEach((s, i) => {
    const t = document.createElement("track");
    t.kind = "subtitles";
    t.label = s.label || s.lang || `Subtitles ${i + 1}`;
    if (s.lang) t.srclang = s.lang;
    t.src = s.src;
    if (s.default || (!hasDefault && i === 0)) t.default = true;
    video.appendChild(t);
  });

  video.load();
  player.hidden = false;
  document.body.style.overflow = "hidden";
  // Make sure the default track actually shows (some browsers ignore the attribute after load)
  if (list.length) {
    video.addEventListener("loadedmetadata", () => {
      const tracks = video.textTracks;
      let shown = false;
      for (let i = 0; i < tracks.length; i++) {
        if (list[i] && (list[i].default || (!hasDefault && i === 0))) { tracks[i].mode = "showing"; shown = true; }
        else if (tracks[i].mode === "showing" && shown) tracks[i].mode = "disabled";
      }
    }, { once: true });
  }
  video.play().catch(() => {/* autoplay may be blocked; controls are available */});
}

function closePlayer() {
  const player = document.getElementById("player");
  const video = document.getElementById("video");
  video.pause();
  while (video.firstChild) video.removeChild(video.firstChild);
  video.removeAttribute("src");
  video.load();
  player.hidden = true;
  if (document.getElementById("modal").hidden) document.body.style.overflow = "";
}

/* ---------- Chrome / events ---------- */
function wireChrome() {
  // Scroll shadow on topbar
  const topbar = document.getElementById("topbar");
  const onScroll = () => topbar.classList.toggle("is-scrolled", window.scrollY > 12);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Filters
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      state.filter = chip.dataset.filter;
      render();
    });
  });

  // Search (debounced)
  let t;
  document.getElementById("search").addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => { state.query = e.target.value.trim().toLowerCase(); render(); }, 140);
  });

  // Delegated clicks: open modal / play
  document.body.addEventListener("click", (e) => {
    const open = e.target.closest("[data-open]");
    if (open) { openModal(open.dataset.open); return; }
    const play = e.target.closest("[data-play]");
    if (play) {
      const item = state.items.find((x) => x.id === play.dataset.play);
      if (item) {
        if (item.type === "series") {
          const first = item.seasons[0] && item.seasons[0].episodes[0];
          if (first) playVideo(first.src, item.title, epSubs(item, first));
        } else {
          playVideo(item.src, item.title, item.subs);
        }
      }
      return;
    }
    if (e.target.closest("[data-close]")) closeModal();
  });

  // Player + modal close controls
  document.getElementById("player-close").addEventListener("click", closePlayer);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!document.getElementById("player").hidden) closePlayer();
    else if (!document.getElementById("modal").hidden) closeModal();
  });
}

/* ---------- Error ---------- */
function showError(err) {
  const loading = document.getElementById("loading");
  const rows = document.getElementById("rows");
  if (loading) loading.remove();
  rows.innerHTML = `
    <div class="empty">
      <h2>Couldn't load the archive</h2>
      <p>${esc(err.message)}</p>
      <p style="margin-top:10px">Check that <code>data/library.json</code> exists and is valid JSON.</p>
    </div>`;
  console.error(err);
}

/* ---------- Helpers ---------- */
function el(tag, cls) { const n = document.createElement(tag); if (cls) n.className = cls; return n; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

/* Deterministic gradient poster/backdrop from the title (no external images needed). */
function hashHue(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360; return h; }
function posterBg(item, wide) {
  if (item.backdrop && wide) return `center/cover no-repeat url('${item.backdrop}')`;
  if (item.poster && !wide) return `center/cover no-repeat url('${item.poster}')`;
  const h = hashHue(item.title);
  const h2 = (h + 40) % 360;
  return `linear-gradient(135deg, hsl(${h} 55% 28%) 0%, hsl(${h2} 60% 16%) 100%)`;
}
