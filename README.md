# QuoteStream

The streaming archive for every movie and series watched together on **The Quote Library** Discord.

> [**Join the Discord →**](https://discord.gg/aWwPNapb5x)

QuoteStream is a lightweight, Netflix-style front end. It **auto-scans a single JSON file** (`data/library.json`) to know every title in the archive, formats each one as a **movie** or a **series**, and lets people browse, search, and stream them.

No build step, no framework — just static HTML, CSS, and vanilla JavaScript. Drop it on GitHub Pages (or any static host) and it works.

---

## Live / hosting

Any static host works. For **GitHub Pages**: repo **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `root`**.

To run locally, serve the folder (fetching JSON needs http, not `file://`):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## Adding a title

Everything lives in [`data/library.json`](data/library.json). Add an object to the `library` array — the site picks it up on the next load. Posters are **optional**: leave `poster`/`backdrop` out and QuoteStream auto-generates a gradient poster from the title.

### A movie

```json
{
  "id": "interstellar",
  "title": "Interstellar",
  "type": "movie",
  "year": 2014,
  "rating": "PG-13",
  "duration": "2h 49m",
  "genre": ["Sci-Fi", "Drama"],
  "description": "A team travels through a wormhole in search of a new home for humanity.",
  "poster": "https://example.com/interstellar.jpg",
  "src": "movies/interstellar.mp4",
  "subs": [
    { "label": "English", "lang": "en", "src": "movies/interstellar.en.vtt", "default": true },
    { "label": "Spanish", "lang": "es", "src": "movies/interstellar.es.vtt" }
  ]
}
```

### A series

```json
{
  "id": "some-show",
  "title": "Some Show",
  "type": "series",
  "year": 2020,
  "rating": "TV-MA",
  "genre": ["Drama"],
  "description": "What the show is about.",
  "seasons": [
    {
      "season": 1,
      "episodes": [
        { "episode": 1, "title": "Pilot", "duration": "48m", "src": "shows/some-show/s01e01.mp4", "description": "…" },
        { "episode": 2, "title": "The Next One", "duration": "45m", "src": "shows/some-show/s01e02.mp4" }
      ]
    }
  ]
}
```

### Field reference

| Field | Applies to | Notes |
|-------|-----------|-------|
| `id` | all | Optional. Auto-derived from the title if omitted. |
| `title` | all | **Required.** |
| `type` | all | `"movie"` or `"series"`. Defaults to `movie`. |
| `year`, `rating`, `duration` | all | Optional metadata shown on cards / detail view. |
| `genre` | all | String or array of strings. Genres become browse rows. |
| `description` | all | Optional blurb. |
| `poster` | all | Optional image URL (portrait). Auto-generated if omitted. |
| `backdrop` | all | Optional wide image for the hero/detail banner. Falls back to `poster`. |
| `featured` | all | `true` to make it eligible for the big hero banner. |
| `src` | movie | Path or URL to the video file. |
| `subs` | movie / episode | Optional subtitle list — see below. Also valid at series level as a fallback for episodes without their own. |
| `seasons[].episodes[].src` | series | Path or URL to each episode's video file. |
| `seasons[].episodes[].subs` | series | Optional per-episode subtitle list. |

### Subtitles

Browsers only render **WebVTT** (`.vtt`) subtitles loaded as sidecar files — they ignore subs embedded inside an MP4. Each `subs` entry is:

```json
{ "label": "English", "lang": "en", "src": "path/to/file.en.vtt", "default": true }
```

| Field | Notes |
|-------|-------|
| `label` | Name shown in the player's CC menu. |
| `lang` | 2-letter language code (`srclang`). |
| `src` | Path/URL to the `.vtt` file (same-origin recommended). |
| `default` | `true` to show this track automatically. |

Got MKVs with embedded subtitles? Use the companion **QuoteConvert** app — it remuxes to MP4 and extracts each subtitle track to `.vtt`, then hands you a ready-made entry (with `subs` filled in) to paste here.

The `src` can be a full URL or a path relative to the site (e.g. `movies/interstellar.mp4`). Whatever the browser can play in a `<video>` tag (MP4/H.264 is safest) will stream.

---

## Features

- 📼 **JSON-driven** — the whole catalog is one file.
- 🎬 **Movies & series** — series get season/episode pickers automatically.
- 🔎 **Search** across titles, genres, and years.
- 🗂️ **Filters** — All / Movies / Series, plus per-genre rows.
- ▶️ **Built-in player** — full-screen HTML5 video, `Esc` to close.
- 📱 **Responsive** and keyboard-friendly, with a reduced-motion mode.
- 💬 **Join Discord** button wired to the community invite.

---

## Structure

```
quotestream/
├── index.html            # markup + layout
├── assets/
│   ├── css/styles.css     # dark, Netflix-style theme
│   └── js/app.js          # loads JSON, renders rows, modal, player
├── data/library.json      # ← the archive lives here
└── README.md
```

---

*QuoteStream is a fan-run archive. Titles link to the community's own hosted copies.*
