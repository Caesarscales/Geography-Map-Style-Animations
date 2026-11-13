# Geo Map-Explainer Style — Frame-by-Frame Study Database

The master reference for this format. Every video we make gets checked against this file.
Built from 9 reference videos (Geo All Day), each studied in two passes:

- **Pass 1** — whole video at 2.5–5 fps with timestamps: every beat, asset, text and transition logged.
- **Pass 2** — every frame (30/60 fps) on each transition and signature device, plus code measurements on every single frame (camera motion via image alignment, change per frame, caption timing vs. voice, loudness, layout positions).

Per-video notes, raw numbers and contact sheets live in `studies/<video>/`. This file is the summary and the rules derived from them.

---

## 0. The 9 videos and which ones define the house style

| Video | Length | Era | Use as reference? |
|---|---|---|---|
| Why Did Colombia Fight in the Korean War? | 61.0 s | current | **yes — primary recreation target** |
| Why Is Oman Split Into Two? | 83.7 s | current | yes |
| How the Atlantic Slave Trade Began and Ended | 80.1 s | current | yes (dialogue variant) |
| Why Is The Gambia Shaped Like This? | 69.2 s | current | yes |
| Why German U-Boats Hunted Ships Near America | 78.5 s | current | yes (no captions!) |
| Why Do So Many Countries End in -stan? | 63.8 s | current | yes |
| Why Does Italy Have This Strange Panhandle? | 83.7 s | current | yes |
| Why Planes Follow This Invisible Highway | 59.9 s | early | devices only |
| Top Safest Countries for World War 3 | 54.0 s | early | **no** — listicle, stock footage, 3D globe, like-bait CTA |

The **house style** = the 7 "current" videos.

> **LOCKED: the chibi map style is the recreation target. Stock footage is banned** — no real video clips, drone shots or photo cutaways, in any video. Every frame is built from the map, chibis, stickers, text and generated painted scenes. The early-era devices (stock footage, 3D globe in space, ALL-CAPS tiny captions, listicle format, like/subscribe bait) are documented in `studies/ww3` and `studies/planes` only so we know what NOT to do.

---

## 1. Measured numbers (all 9, normalised to 30 fps)

| Video | fps (real) | words | words/s | LUFS | camera moving | still frames | change/frame (median) | cam px/f median · p95 | zoom %/f p95 | zoom in/out % | hard cuts |
|---|---|---|---|---|---|---|---|---|---|---|---|
| colombia | 30 | 172 | 2.83 | -17.2 | 98.6% | 0.1% | 11.9 | 10.1 · 56 | 2.5 | 43/44 | 2 |
| oman | 60 native | 220 | 2.67 | -16.1 | 97.3% | 0.8% | 11.8 | 9.4 · 53 | 3.9 | 42/50 | 4 |
| slavetrade | 60 (doubled → 30) | 194 | 2.44 | -18.0 | 89.6% | 7.4% | 9.0 | 9.7 · 52 | 2.3 | 37/45 | 1 |
| gambia | 60 (doubled → 30) | 182 | 2.65 | -16.3 | 98.6% | 0.6% | 6.8 | 11.1 · 54 | 3.7 | 45/46 | 1 |
| uboats | 30 | 217 | 2.78 | -15.3 | 97.4% | 0.1% | 7.6 | 11.7 · 70 | 4.6 | 44/47 | 0 |
| stan | 60 native | 158 | 2.52 | -19.0 | 93.9% | 2.4% | 5.8 | 4.2 · 36 | 2.0 | 45/35 | 4 |
| italy | 60 (doubled → 30) | 209 | 2.52 | -17.5 | 98.5% | 0.2% | 10.7 | 13.9 · 65 | 3.9 | 49/42 | 1 |
| planes *(early)* | 60 native | 186 | 3.13 | -17.7 | 97.7% | 0.0% | 8.3 | 8.3 · 40 | 2.2 | 38/44 | 5 |
| ww3 *(early)* | 30 | 173 | 3.24 | -17.6 | 92.9% | 5.2% | 4.2 | 6.0 · 53 | 1.1 | 50/27 | 3 |

**House-style targets (7 current videos):**
- Length **60–85 s**, **~2.5–2.8 words/s** (calm documentary pace, not rushed).
- Camera moving **≥ 97% of frames** (Slave Trade dips to 90% only because of its static dialogue scenes).
- Still frames **< 1%** (no run of 4+ identical frames, except inside a dialogue scene).
- Camera speed median **~10 px/frame**, peaks **~55–70 px/frame** on flights; zoom up to **~4%/frame** on dives.
- Zoom in and out are **balanced** (~45/45) — the camera breathes in and out constantly; it never just pushes one way.
- Rotation is small: p95 **≤ 1°/frame** — slight tilts during flights, never spins.
- **0–4 hard cuts per video.** Everything else is a camera move, mask reveal or crossfade.
- Loudness **-15 to -19 LUFS** (they master quieter than -14).
- Animated at **30 fps** (even when exported at 60, 3 of the videos are 30 fps doubled). Author at 30.

**Captions (measured on 7 videos with captions):**
- Centre at **~77–78% of frame height** (y ≈ 1475–1500 of 1920), one line, centred.
- **3–4.4 words per caption** (Gambia/Italy ~3, Colombia/Stan ~4.4), on screen **~1.0–1.3 s** median.
- Caption switch lands **on the word onset: median lag 0.00–0.04 s**, 80% within ±0.15 s.
- First caption appears at **~0.17–0.4 s**, not at frame 0.
- Watermark bottom-left, box ≈ x 22–369, y 1838–1898 (≈ 2% left margin, 3% bottom margin).

---

## 2. Story / script formula

Hooks (first sentence of each video):
- "Did you know Colombia once sent troops halfway across the world…" (Colombia)
- "This is Oman. And strangely, this is Oman too." (Oman)
- "This is Senegal. In this tiny strip cutting into it, that's a completely different country, the Gambia." (Gambia)
- "Most people don't know why Italy has this strange panhandle…" (Italy)
- "Why do so many countries in Asia end in Stan? Look at…" (-stan)
- "These ships crossed the Atlantic carrying people as cargo…" (Slave Trade)
- "Do you know German U-boats once hunted American oil tankers inside the Gulf of Mexico?" (U-boats)

Formula:
1. **Hook = point at the map + a surprising fact or shape.** "This is X." / "Did you know X once…" / "Most people don't know why…". The map visual IS the hook — the thing is highlighted within 1 s.
2. **Turn to the question** in sentence 2–3: "So who put it there?", "But how did Oman end up…", "So how did selling people become a business?"
3. **"You see," / "Well," / "It started with…"** opens the backstory.
4. **Chronological story with dates as chapter markers** (1600s → 1889 → 1965; WWI → 1915 → 1947 → 1954 → 1975). Each date gets its own big date slam.
5. **Twist beat** in the last third: "But here's the twist." / "That was the catch." / "Not quite."
6. **Optional character dialogue** — 1–3 short lines voiced in character, shown as normal captions ("We need more workers." "Are we paying them?" / "You're in the middle of my colony.").
7. **End on the answer restated as a map image** ("…leaving a colonial rivalry drawn across the map."). Last word ≈ end of video. Ends mid camera move.
8. CTA: none in 5 of 7; a small globe-logo + red "Subscribe" pill in the last ~1.5 s in Oman and -stan. Never a spoken CTA in the current style.

---

## 3. The world: one camera, one map, many skins

**One continuous camera** flies over **one world map**. Changing "scene" = flying somewhere else, or changing the map's *skin* under the camera.

### Skins seen (all on the same geography)
| Skin | Look | Used for |
|---|---|---|
| **Satellite** | photoreal relief, deep teal oceans, natural land | intros, outros, "real world" moments (all videos) |
| **Clouds layer** | 3D white clouds above satellite | intro dive (Colombia, Gambia, U-boats, -stan, Italy) |
| **Flat atlas** | light-blue sea w/ faint bathymetry, cream/green land | main storytelling (Colombia, Gambia, U-boats) |
| **Halftone paper** | atlas + printed dot texture | close-ups (Colombia) |
| **Old atlas / vintage** | beige land, dusty steel-blue sea, curved black SERIF italic labels | history segments (Oman, Italy) |
| **Blueprint** | flat royal blue + thin diagonal or square grid; only key land shown as floating satellite cutouts with soft shadow | "focus on this piece" (Oman, Italy, -stan teal variant) |
| **Teal grid** | dark teal + faint grid | political division beat (Colombia), explainer beats (-stan) |
| **Dark war map** | painted relief, navy sea, glowing borders, fire + smoke + embers, biplanes | WWI / WWII chapters (Italy, Oman "Outside powers") |
| **Grey/desaturated** | B&W or grey map with only the subject in colour | focus pulls (Gambia river, U-boats, Pearl Harbor) |
| **Minimal light** | white land, pale cyan sea, no texture | data beats (WW3, -stan Persian spread) |

### Skin-change transitions (measured)
- **Diagonal soft wipe** ~20 f (0.33 s), any corner (Oman ×3).
- **Ink-blob / metaball reveal**: separate round blobs appear, merge and fill frame in ~11 f; reverse = blob shrinks back to the coastline (Colombia).
- **Circular iris/lens**: soft-edged circle of the new skin grows from the subject ~30 f (Italy, Oman).
- **Colour drain**: map desaturates over ~10 f + vignette, only subject stays coloured (Gambia).
- **Cross-dissolve with light-leak sweep** ~12 f (Colombia satellite → atlas).
- **Hard swap at same framing + instant zoom-out** for war skins (Italy WWI).

---

## 4. Camera grammar

- **Never stops.** Between beats it drifts at 2–5 px/frame or zooms ±0.2–0.5%/frame.
- **Flights**: ease-in ~8 f → cruise 40–70 px/f → ease-out ~10 f. The camera locks onto a moving object (arrow head, plane, line tip) so it stays near frame centre while the map scrolls.
- **Counter-motion**: when a big date/title flies in toward the camera, the map zooms OUT at the same time. Common for every date slam.
- **Dives**: push in until coastlines go blocky, then a 1-frame radial zoom-blur cut into a painted scene (Colombia) — or a whip pan.
- **Whip pan**: ~10 f of heavy directional motion blur, then ~8 f blur decay into the destination (Colombia, U-boats). A title often starts typing during the blur.
- **Slight tilt** (≤ 10°) when following a line (Gambia river), and a perspective tilt of the map plane in grid skins (U-boats supplies).
- **Intro**: dive through clouds onto the region (5 of 7 current videos). Clouds gone by ~0.7 s.
- **Outro**: slow zoom-out that is still moving when the video ends.

---

## 5. Country fills & map marks

- **Flat, saturated fills** with a thin white or dark rim; often a **fine diagonal or vertical hatch** (Oman, Gambia, Italy, Slovenia).
- Palette examples: Colombia #F2F21C yellow; N. Korea #D8111C red; S. Korea #2D7DD2 blue; Oman lime #7EE06A with neon-green rim; UAE coral #E45B5B; Gambia maroon #6E1F23; French Senegal navy #2D3567; Senegal green #3EA35A; Italy crimson #B5141F; Austria-Hungary mustard with glowing orange outline; Senegambia gold #D9A733.
- **The identity-change recolour (signature device)**: border trace in yellow/white (~0.25 s) → fill goes **pale → pure WHITE (holds ~4 f)** → pale target colour → final colour. ~14 f total. Flag + label type in during the white stage; old tokens shrink out during the white. Used every time a territory changes owner (Gambia, -stan, U-boats, Italy, Colombia's green-flash).
- **Paint spread**: new owner floods in with an organic noisy edge from one point (Colombia N. Korea red; Oman; Gambia French navy "smoky" edge; Slovenia wavy edge from the north).
- **Front line** between two fills is a soft gradient, not a hard border, and it moves.
- **Water highlight**: seas/straits/rivers get a cyan inner glow + text lying on the water (Strait of Hormuz, Gulf of Mexico, Adriatic, Gambia River).
- **Lines**: rivers, pipelines, routes draw on as glowing strokes (white/orange/cyan/yellow) with a ring at the moving tip; camera follows the tip.
- **Arrows**: thick white curved arrows, head-first draw-on with a comet tail + soft drop shadow; pincer arrows for invasions; 3D red chunky arrow for pointing (Gambia).
- **Pins**: red teardrop pin drops from above (~6 f, tiny bounce) + white/red expanding rings (2–3 staggered). 3D pushpin variant (Gambia). Blue rings allowed.
- **Lens/magnifier**: white disc with red glow grows on the spot while map zooms out (Oman, Italy).
- **Scribble ellipse**: yellow hand-drawn double ellipse circling a spot (Oman, Italy, -stan).
- **Selection box**: four white chevron corners push outward and a dashed-outline zone grows (Oman fort).

---

## 6. Text system

| Element | Look | Motion |
|---|---|---|
| **Country label** | white heavy rounded sans (single-storey 'a'), dark outline/shadow, small waving 3D flag above | types in ~1 letter per 3 f, each letter born ~40% size and grows in 3 f; whole label slowly grows |
| **Date slam** | huge, coloured by mood: neon pink-red (Colombia), gold glow (Oman), white heavy (Slave Trade), cream serif w/ shadow (Gambia, Italy), "Dec 7, **1941**" white+red (U-boats) | digits arrive one by one from close to the lens and shrink into place; map counter-zooms out; exits by growing + tilting past the camera (~1 s). Never a plain fade |
| **Chapter title** | two-tone heavy words stacked: one word red, one white ("Competing / To Access", "Here's The / Twist", "The Pipeline / Remained"), slight 3D perspective tilt | letters type in; exit = letters scatter/fly apart to one side (reverse type-on) |
| **Fiery era title** | "WORLD WAR I/II", "Outside Powers": cream serif, orange flame glow, burnt edges | drops in from above frame huge, settles top-centre; embers + smoke at bottom |
| **Neon phrase** | "Strangely…", "This is Oman too", "The Shihuh": white core + cyan/green outer glow | letters arrive every ~2 f, word slowly rotates −5→−10° |
| **Name/info tag** | small flat box: yellow/black (names, years, colonies), red/white (units), green (army), wooden plank (old names) | empty bar wipes out first (~5 f), then text types in ~1 char/frame |
| **Kerning-expand label** | "“Musandam Peninsula”", "“Trieste Panhandle”" in quotes with leader line | letters start bunched and the spacing relaxes (~10 f) |
| **Serif map labels** | italic serif following the curve of seas/regions (vintage & war skins) | type in along the curve |
| **Captions** | white bold rounded sans (Poppins/Montserrat style), thin dark shadow, ~40–50 px tall, lowercase as spoken, centred at ~77.5% height | hard switch on word onset, no animation |
| **Watermark** | channel handle, white semi-bold, bottom-left | static, visible from ~0.2 s |

---

## 7. Characters & stickers

- **Chibi tokens on the map**: small soft-3D clay-style figures, huge head (~45–50% of height), tiny body, warm rim light, drop shadow. Era/nation costumes: UN mascot, Colombian/US soldiers, Gómez in armchair, Arab tribesmen, Portuguese/British/French nobles, African kings, German admiral, Italian generals, Rahmat Ali.
- Size: **3–5% of frame height** when on the map; larger only in scenes and mascot beats.
- **Always moving**: bob, sway, blink, lean toward the other speaker, pupils jitter.
- Entrances: pop with overshoot (scale 0 → ~115% → 100% in 6–8 f), or slide in huge from a frame edge and shrink into place (from the lens), or drop from above.
- Exits: shrink to 0 (~4 f) or fly past the camera.
- **Countries as characters**: googly eyes on countries (Oman Europe), flag-characters with noodle arms and white cartoon gloves (Gambia).
- **Banner tokens**: heraldic hanging banners stand in for a power (Gambia).
- **Props**: planes with altitude shadows, ships with wakes, galleons, U-boats with torpedo dash trails, explosions (spark → white puff → orange/brown smoke over ~40 f, staggered, never all at once), fire sprites, gravestones with count tags ("50", "+100"), money bags + flying banknotes, calendars (tear-off, page flips), parchment documents (slide in rotating, or curl-unroll from a corner), red BANNED stamp (slams from 2.5× in 4 f), question marks, speech bubbles (white, text drops in letter by letter), thought bubbles (white-outlined cloud masking a map).
- **Painted scenes** (used sparingly, 1–2 per video max): snowy battlefield (Colombia), plantation (Slave Trade), council room (Italy). Entered by dive, mask (thought bubble) or crossfade with a **bridge object** that survives the transition (Slave Trade's spinning "$").
- **Stat badges**: dark circles with white border + icon, numbers count up digit by digit (Colombia casualties).
- **Infographic card**: a whole-frame chart (-stan "How Muslim are the stan countries?") — rare, only for data.

---

## 8. Motion constants (copy these exactly)

| Thing | Frames @30 fps |
|---|---|
| Sticker pop-in | 6–8 (overshoot ~115%) |
| Sticker pop-out | ~4 |
| Label letter interval | ~3 (country), ~1–2 (neon/titles), ~1 (tags) |
| Letter grow-in | ~3 |
| Recolour white-flash | ~14 total, white hold ~4 |
| Border trace before recolour | ~7 |
| Date digit interval | ~3; full date ~10–12 in, ~30 hold, ~10 out |
| Skin wipe | ~10 (=20 @60) |
| Blob reveal | ~11 |
| Iris/lens reveal | ~15 |
| Whip pan | ~10 blur + ~8 decay |
| Pin drop | ~6 |
| Pulse ring | grows 30 → 140 px over ~20, fades |
| Name-tag bar wipe | ~5, then 1 char/frame |
| Camera ease in / out | ~8 / ~10 |
| Something new appears | every ~0.5–1.5 s (captions ~1.0–1.3 s, map events in between) |

---

## 9. Audio

- Calm AI-style documentary narrator, ~2.5–2.8 words/s; pause trimming is fine, but never clip words.
- Character dialogue lines use different voices.
- Music bed under the narration; SFX on pops, whooshes on camera flights, booms on explosions, typing ticks on labels.
- Integrated loudness -15 to -19 LUFS (we can master at ~-16 to match, or -14 for platform norm).

---

## 10. Per-video beat maps

Full timestamped beat logs, with every pop, label, transition and caption:
- `studies/colombia/notes_p1.md` + `notes_p2.md` — **the recreation target**
- `studies/oman/…`, `studies/slavetrade/…`, `studies/gambia/…`, `studies/uboats/…`, `studies/stan/…`, `studies/italy/…`
- `studies/planes/notes_p1.md`, `studies/ww3/notes_p1.md` (early era)
- Raw data: `words.json` (word timestamps), `perframe.json` (camera/motion every frame), `audio.txt`, `allstats.json`.

---

## 11. QA gate — a new video passes only if

1. Camera moving ≥ 97% of frames; still frames < 1%; no 4+ frame still run outside a dialogue scene.
2. Median change/frame 6–12; camera p95 40–70 px/f; zoom in/out balanced within 15 points.
3. Hard cuts ≤ 4.
4. Captions: centre 76–79% height, 3–4.5 words, median lag to word onset within ±0.05 s.
5. 2.4–2.9 words/s; 60–85 s.
6. Every territory change uses the white-flash recolour; every date uses a date slam; every named place gets a typed label with a flag.
7. Something new appears at least every 1.5 s.
8. Side-by-side vs. the reference at the same timestamps for every second of a recreation.
9. Loudness -14 to -19 LUFS.
10. Zero stock footage; every person on screen is a chibi in the house style.

`tools/` holds the scripts that measure all of this (`study.py`, `summarize.py`, `captions.py`, `allstats.py`) — run them on our render the same way.
