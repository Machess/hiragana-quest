# Hiragana Quest — ひらがな クエスト

A calm, audio-first hiragana learning game for kids aged 6–12, built as an offline Progressive Web App (PWA).
Plain HTML/CSS/JavaScript modules, no build step, no frameworks.

## What's in this version

- **Profiles:** one per child, each with an animal avatar and its own progress, trophies and stamp card. Settings and deleting a player sit behind a "hold for 2–3 seconds" grown-up gate.
- **Home:** **Adventure** (shows what's coming: "New: か き · Practice: あ い"), **Dojo**, **My Hiragana**, **Trophies**, **Stamps**.
- **Adventure (8–10 min):** each character gets the practice its path step needs. Afterwards: "Steps you climbed today", trophies, then a hanko stamp.
- **Dojo (道場):** pick any hiragana on the chart (one, several, a whole row by tapping its column letter, "My tricky ones" or "Everything I know"), then a game or **Mixed**. The game list only enables games that work with the selection. Afterwards: **Again** or **Back**.
- **My Hiragana:** the 50-sound chart as a collection. Each cell shows its path progress (⭐ when mastered). Tapping one opens its **character card**: stroke animation, sound, picture word, trophy, the path with progress dots, and **Practise あ** (a 2-minute mix for just that character).

## The path (how learning progresses)

Every hiragana walks its own path:

**👀 Meet → ✍️ Trace → 🖍️ Copy → 👂 Hear it → 🔍 Read it → ✏️ Write it → 🍣 Use it → ⭐ Master**

| Step | Passed when | Practised in |
|---|---|---|
| Meet | Seen, heard and traced twice | Meet |
| Trace | 3 clean traces over the guide | Write it (trace mode) |
| Copy | 2 good freehand copies with the model beside the pad | Write it (copy mode) |
| Hear it | 5 right first try | Listen & Pick, Goldfish, Karuta, Memory, Stepping Stones, Sushi Train |
| Read it | 5 right first try | Sound Detective, Spot the Different One, Read & Match |
| Write it | 3 good ones from memory | Picture Write, Dictation, Write it (memory mode) |
| Use it | 4 words built or read with it | Sushi Train, Stepping Stones, Read & Match |
| ⭐ Master | Right first try on 3 separate days | Anything |

Why this order:
- Tracing is a short bridge only. Forming letters by hand (copying) builds letter recognition; tracing alone doesn't (James & Engelhardt, 2012).
- Recognition by sound, then by sight, comes before writing from memory, because recall is harder than recognition. Quizzing with a prompt and instant feedback works for young children once the basics are in.
- ⭐ needs separate days, because spaced practice is what makes it stick.

**Rules**
- First-try answers are **banked** per skill. Practice done "early" counts as soon as a character reaches that step, so children can climb several stones at once. The order of the path is always kept.
- Wrong answers never take progress away.
- New characters arrive 1–2 at a time, only while at most 3 known characters are still before 👂 Hear it.
- The **next row opens** when every character in the row before has passed 👂 Hear it.
- **Trophies:** bronze = passed Copy, silver = passed Read it, gold = the whole row passed Use it. A lit lantern marks each finished row. Earned trophies are never taken away.
- Older saves are placed on the path automatically.
- A grown-up setting **Open all hiragana in the Dojo** lets kids who already know some practise any character. Unmet ones get a Meet first.

## Games
- **Meet:** animated stroke order, the sound and a picture word, then two traces.
- **Write it:** one pad, three ways (trace over a guide / copy with the model beside it / from memory). It checks stroke shape, start point, direction and order. Bulb = show me, undo for memory mode.
- **Listen & Pick**, **Goldfish Scoop (金魚すくい)**, **Memory Match**, **Karuta (かるた)** (solo vs Mochi or two players facing each other).
- **Sound Detective** (see → pick the sound) and **Spot the Different One** (find the look-alike in a grid).
- **Picture Write** (🐜 ?り → write あ) and **Dictation** (hear a sound, write it, no picture).
- **Read & Match** (read a word with no sound, tap its picture), **Sushi Train (回転寿司)** and **Stepping Stones (川渡り)**.
- **Word bank** (`js/vocab.js`, audio in `audio/vocab/`): 80 words using only the 46 basic hiragana. Word games only use words made entirely of characters the child knows.

## Mochi's Dressing Room and koban (こばん)
Children earn **koban** (old Japanese gold coins) by learning, then spend them on anything they like for Mochi. There are no random boxes, nothing to buy with real money, and nothing that expires. Trying things on is always free.

| Earn | Koban |
|---|---|
| Every 5 right-first-try answers (adventures and Dojo) | 1 |
| Finishing an adventure | 3 |
| A character climbs a stone on its path | 1 |
| A character reaches ⭐ | 5 |
| A whole row turns gold | 10 |

A koban counter sits in every game's top bar and gives a small bump and a soft clink when a coin is earned. The stamp screen shows what was earned that day.

**The shop** has 29 items, priced 20–90. A perfect player earns about 10 koban per adventure, so a typical item takes 4–6 adventures of saving.
- **Colours**, named after Japanese sweets: さくらもち, くさもち, きなこ, あずき, ごま, ゆず.
- **Hats:** はちまき, a sakura hairpin, a flower crown, a straw hat, a knitted hat, a fox mask, a detective hat, a paper samurai helmet.
- **Items to hold:** おにぎり, a paper fan, a brush, an umbrella, a paper lantern.
- **Reactions** (what Mochi does when the child gets it right): big jump, wobble, spin, bow, wink, sparkly eyes.
- **Celebrations** (what falls from the sky): stars, snow, maple leaves, paper cranes.

**How the shop works**
- Item names are written in hiragana. Characters the child hasn't met yet are dimmed, and the speaker button reads the name aloud.
- **Save for this** sets a goal, shown with a progress bar on the home screen.
- Each child has their own Mochi, which wears its look everywhere: home, games, the players screen and the Karuta opponent.
- Prices and earning rates are one line each in `js/wardrobe.js`.

## Calm by design
- **Speech never overlaps or rushes.** Every clip waits for the one before it, plus a natural pause (about 0.65 s). Meet goes "あたらしい ひらがなだよ!" … あ … あり with longer pauses. Taps on a speaker button answer immediately.
- **Celebrations:** a soft chime for a right answer. Every 5 in a row, a lantern lights, a few petals fall and Mochi hops. A character climbing a stone gets a small "あ → 🔍 Read it" moment. No buzzers, no lives, no "streak lost".

## Built for the 10" Lenovo tablet

- **Fixed 1280 × 800 landscape design (16:10)**, scaled evenly to the screen. On the tablet's 1920 × 1200 display everything is drawn at 1.5×. Other screen shapes get soft paper-coloured bars at the sides. In portrait, a "turn the tablet sideways" prompt appears.
- **Size rules:** touch targets are at least 56 px and kids' text is at least 18 px (body text 22 px), both at design size.
- **Smooth on mid-range tablet GPUs:** only `transform` and `opacity` are animated. There's no blur, no filter and no animated shadows. Memory cards flip in 2D instead of 3D. Tested at 60 fps with the CPU slowed 4×.
- **Touch:** very large touch contacts (a resting palm) are ignored while tracing, and a stylus works too. Long-press menus and text selection are off. The screen stays awake during play.

## Updates (GitHub Pages)

The installed app keeps itself up to date from GitHub Pages:
- **Every start:** it asks Pages for the newest version. If there is one, Mochi shows "Getting new things…" with the release note while only the **changed** files download. Then the app restarts into the new version before the child begins, and shows "✨ New: …" once. Already up to date: the check takes a fraction of a second. No internet: it starts with the version it has.
- **Already open** (Android keeps installed apps in memory): it checks again when the app comes back to the front, if the last check was over 30 minutes ago. A new version installs only on the players or home screen, **never in the middle of a game**.
- **Safe:** every file has a fingerprint, and downloads skip all caches, so a stale copy can't sneak in. An update is all or nothing: if any file fails, it's dropped and the current version keeps running. Progress (stored on the device) is never touched.
- **Grown-ups screen:** shows the version, build date and release note, plus a **Check for updates** button.
- GitHub Pages can serve files up to ~10 minutes old after a push, so a new version reaches the tablet within about 10 minutes.

**Releasing a new version**
1. Write a one-line note in `tools/release-notes.txt` (shown to the child as "New: …").
2. Run `python3 tools/build.py`. It writes `sw.js` (file list + fingerprints) and `version.json`. Run it after **every** change, otherwise devices won't see the update.
3. Commit and push to `main`. Pages publishes it, and tablets pick it up on their next start.

Everything pushed to `main` reaches the tablets. If you'd rather test first, publish Pages from a separate `release` branch and merge into it when ready.

## Run it locally

Service workers and ES modules need a web server (opening `index.html` as a file won't work):

```bash
cd hiragana-quest
python3 -m http.server 8080
# open http://localhost:8080 (or http://<your-computer-ip>:8080 from the tablet on the same Wi-Fi)
```

Note: installing as an app and offline mode need **https** or **localhost**. For testing on the tablet over plain http, use the published link, or use Chrome's `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.

## Turning it into an APK for the Lenovo tablet

**Option A: Capacitor (recommended, works fully offline, no hosting)**

```bash
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Hiragana Quest" com.yourname.hiraganaquest --web-dir=www
mkdir www && cp -r index.html manifest.webmanifest sw.js css js audio fonts icons www/
npx cap add android
npx cap open android      # build the APK in Android Studio (Build → Build APK)
```

Capacitor serves the files from `https://localhost`, so modules and audio work as-is. Lock orientation in `android/app/src/main/AndroidManifest.xml` if you want landscape only.

**Option B: Bubblewrap / TWA.** Host the folder on any https host (GitHub Pages, Netlify), then run `npx @bubblewrap/cli init --manifest https://your-host/manifest.webmanifest`.

## Project layout

```
index.html, manifest.webmanifest, sw.js   PWA shell + offline cache + updates (sw.js is generated)
version.json                              current version, build date, release note (generated)
css/style.css                             all styling (washi paper / indigo / vermilion theme)
js/main.js        screens: profiles, home, adventure runner, chart, character card, Dojo, trophies, stamps, parent area
js/session.js     game shell, streaks, step-up moments, adventure planner (by path step)
js/learn.js       the path model (steps, banked answers, ⭐ days), unlocks, trophies, look-alike distractors
js/trace.js       tracing engine (KanjiVG stroke templates, checking, demos)
js/audio.js       Web Audio speech queue (calm pacing) + soft synthesized chimes
js/update.js      start-up update check, Mochi's update screen, apply only on calm screens
js/wardrobe.js    koban earning, the shop catalogue and prices, Mochi's colours, hats and held items (SVG layers)
js/ui.js          helpers, Mochi mascot SVG, trophy/lantern SVGs, petals, grown-up gate
js/games/core.js  Meet, the writing pad (trace/copy/memory), Listen & Pick, Picture Write, Dictation
js/games/extra.js Goldfish Scoop, Memory Match, Karuta
js/games/more.js  Sound Detective, Spot the Different One, Sushi Train, Stepping Stones, Read & Match
js/vocab.js       80-word bank (generated)
js/data.js        46 kana, picture words, rows, stroke paths (generated)
audio/kana|words|voice/   pre-generated Japanese speech (mp3)
fonts/            Klee One (textbook-style kana), M PLUS Rounded 1c (UI) — subsetted woff2
```


## Changing picture words

Words live in `js/data.js` (`word`, `emoji`, `meaning`). The matching audio is `audio/words/<romaji>.mp3`. If you change a word, regenerate or re-record that file. You can drop in your own recordings with the same file names at any time.

## Credits & licences

- Voices: **VOICEVOX:四国めたん** (kana and words), **VOICEVOX:春日部つむぎ** (Mochi's voice). Generated with VOICEVOX Core. Keep these credits visible if you publish the app (they are shown in the grown-ups screen), and check each character's terms of use before any commercial release.
- Stroke order data: **KanjiVG** © Ulrich Apel, CC BY-SA 3.0 (https://kanjivg.tagaini.net).
- Fonts: **Klee One** (Fontworks) and **M PLUS Rounded 1c**, both SIL Open Font License.
- Mochi the mascot, the wardrobe, trophies, lanterns and all other art are original SVG drawn in code. Picture words use the device's emoji font as placeholders.
