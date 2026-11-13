# beats.json — the video, as a list of beats

Each video is one file: `projects/<name>/beats.json`. The engine reads it and draws every frame.

```json
{
  "meta":   { "title": "...", "words": "words.json", "watermark": "@handle", "regions": ["korea"],
              "region_defs": { "korea": [118, 136, 28, 46] } },
  "camera": [ { "t": 0, "at": "COL", "zoom": 12 }, { "t": "w12", "at": "Korea", "zoom": 100 } ],
  "beats":  [ { "t": "w3", "type": "label", "text": "Colombia", "at": "COL", "flag": "COL" } ]
}
```

## Time (`t`, `until`)
- seconds: `2.4`
- a word in the voiceover: `"w12"` = start of word 12 in words.json, `"w12e"` = its end, `"w12+0.3"` = 0.3 s after its start.
- `dur` (seconds) or `until` (time) ends a beat. Map things (fills, labels, flags, pins, lines, chibis, props) last until the end unless given `until`.
- Tie every beat to a word. That is what makes it feel edited to the voice.

## Places (`at`, `from`, `to`, `points`, `path`)
- country ISO3 (`"COL"`, `"PRK"`) or any country name (`"North Korea"`), state `"USA:Texas"`, city (`"Busan"`), sea (`"Gulf of Oman"`), union `"PRK+KOR"`, aliases (`"Korea"`, `"Europe"`).
- coordinates `[lon, lat]`.
- offsets `{ "place": "COL", "dx": 90, "dy": -120 }` (pixels) or `"dlon"/"dlat"` (degrees).
- fixed screen position `{ "screen": [540, 900] }`.
- follow a moving prop `{ "follow": "<beat id>" }`.

## Camera
List of keys `{ t, at, zoom | fit, rot }`. `zoom` = pixels per degree (≈ 10 world, 40 a country, 100 Korea, 250+ close-up). Without `zoom`, it fits the place's bounding box. The camera passes smoothly through the keys with constant drift and gentle zoom breathing, so it never stops. Follow a prop: `{ "t": 30.5, "follow": "plane1", "until": 33.5, "zoom": 20 }`.
Their camera numbers (STUDY.md §1): moving ≥97% of frames, ~10 px/frame median, flights 40–70 px/frame, zoom in and out about equally, 0–2 hard cuts.

## Beat types

| type | what it is | main params |
|---|---|---|
| `skin` | map look | `kind`: sat, atlas, old, blueprint, teal, war, grey, minimal, paperwhite · `transition`: fade, wipe (`angle`), blob (`origin`), iris, shrink, cut · `trans_dur` |
| `clouds` | intro dive through clouds | `dur` |
| `fill` | colour a country / state / list | `target`, `color`, `style`: flash (white-flash recolour, their signature), fade, spread (`origin`, `radius`, `in`), wipe (`angle`), pulse (`color2`) · `hatch`: diag/vert/horiz · `glow`, `stroke`, `alpha` |
| `front` | colour bleeding across a country (moving front line) | `target`, `color`, `from`, `to`, `progress`: [[t, 0..1], ...] |
| `cutout` | land lifted as a satellite cutout (blueprint scenes) | `target`, `color`, `lift` |
| `focus` | everything grey except targets + vignette | `target` |
| `label` | country label: flag + typed white text | `text`, `at`, `flag`, `per` (frames per letter, 3.4), `fontSize`, `kern` |
| `maplabel` | sea/region name on the map (serif italic) | `text`, `at`, `curve` (radius), `color`, `rot` |
| `flag` | waving flag | `flag` (ISO3/iso2 or USSR, UN, UK_OLD, AUSTRIA_HUNGARY), `at`, `size` |
| `pin` | red pin drop + rings + label | `at`, `label`, `color` |
| `ring` | expanding pulse rings | `at`, `color`, `count`, `radius` |
| `arrow` | curved white arrow, head first, comet tail | `from`, `to`, `bend`, `tail`, `width`, `in` |
| `line` | glowing route/river/pipeline drawing on | `points` or `river`, `color`, `width`, `in`, `dash` |
| `sprite` | prop (plane, ship, gun...) at a place or along a path | `sprite`, `at` or `path`, `size`, `rot`, `altitude` (shadow), `travel`, `arc`, `exit`: fly |
| `chibi` | chibi character(s) popping in | `chibi`, `at`, `count`, `gap`, `size`, `entrance`: pop/slide, `flip` |
| `tag` | name/year box (bar wipes, text types) | `text`, `at`, `side`, `bg`, `fg` |
| `bubble` | speech bubble | `text` (string or lines), `at`, `tail` |
| `emblem` | UN emblem or any icon image | `icon`: un or file, `at`, `size` |
| `badge` | stat badge with counting number | `icon`: skull, medic, missing, people, money · `number`, `label`, `at` |
| `explosions` | staggered explosion chain | `at`, `radius`, `count`, `size`, `stagger` |
| `fire` | flames at points + embers (+ `smoke`) | `points` or `at`, `size`, `smoke` |
| `lens` | white magnifier disc with red glow | `at`, `radius` |
| `scribble` | yellow hand-drawn ellipse | `at`, `size`, `color` |
| `reticle` | targeting crosshair | `at` |
| `googly` | googly eyes (countries as characters) | `at`, `size`, `look` [x,y] |
| `question` | 3 bouncing red question marks | `at` |
| `date` | big date slam (digits zoom from the lens, fly past camera) | `text`, `style`: neon, gold, white, cream, fire · `y`, `fontSize` |
| `title` | two-tone chapter title, typed, letters scatter out | `lines`: [["Here's The","#ffffff"],["Twist","#E42D2D"]], `y`, `tilt` |
| `firetitle` | "WORLD WAR I" style title dropping in | `text` |
| `neon` | glowing phrase ("Strangely...") | `text`, `color`, `y` |
| `document` | old paper document sliding in / unrolling, highlight line | `title`, `lines`, `style`: slide/unroll, `highlight` (line index) |
| `calendar` | tear-off calendar, pages flip | `text`: ["1982","1989"], `flipEvery` |
| `stamp` | red rubber stamp slam | `text` |
| `vignette` / `flash` / `whip` | dark edges / white bloom / whip-pan blur | `strength`, `at`, `full` |
| `scene` | painted scene replaces the map (zoom-blur in/out) | `image` (file in the project) or `code`, `push`, `guns` (sprite name) · beats with `"inScene": "<scene id>"` draw inside it |
| `endcard` | globe + red Subscribe pill | `text` |

Common params: `id`, `layer` (draw order), `sfx` (override sound list, or `false`), `scaleWithZoom`, `zoomRef`, `out` (exit frames).

## Sound
Every beat type triggers matching sound effects automatically (pops, whooshes on fast camera moves, booms, typing, riser + impact on dates...). `tools/mix.py` places them under the voice and adds a music bed that hasn't been used before.

## Characters and props
Put character/prop specs in `projects/<name>/cast.json` (same format as `chibi/library_specs.json`). `make_video.py build` renders them into `projects/<name>/sprites/`. Anything already in `chibi/library/` can be used by name without rendering.
