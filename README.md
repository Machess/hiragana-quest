# Hiragana Quest — ひらがな クエスト

A calm, audio-first hiragana learning game for kids aged 6–12, built as an offline Progressive Web App (PWA).
Plain HTML/CSS/JavaScript modules, no build step, no frameworks.

## What's in this version

- **Profiles:** one per child, each with an animal avatar and its own progress, trophies and stamp card. Settings and deleting a player sit behind a "hold for 2–3 seconds" grown-up gate.
- **Adventure (8–10 min):** meet 1–2 new hiragana, then a set of games picked and paced automatically. At the end you get trophies and a hanko stamp.
- **Games**
  - **Meet:** animated stroke order, the sound, and a picture word, then trace it 3 times with fading help.
  - **Trace:** four help levels (full guide with arrows → faded guide → start dot only → from memory). It checks stroke shape, start point, direction and order.
  - **Listen & Pick:** hear a sound, tap the right character. Choices grow from 2 to 4, and look-alikes (あ/お, き/さ…) are used once the child is ready.
  - **Picture Write:** see a picture, hear the word (🐜 あり), and write the missing first character.
  - **Goldfish Scoop (金魚すくい):** scoop the fish carrying the sound you heard.
  - **Memory Match:** pair characters with the same character, with pictures, or with sounds.
  - **Sound Detective (🔍):** see a character, listen to 2–3 sound buttons, pick the right one. It practises reading: seeing a character and knowing its sound.
  - **Spot the Different One (👀):** a grid of one character with one look-alike hidden in it (あ/お, き/さ, ね/れ…). The grid grows from 3×3 to 6×3. Afterwards both sounds are played.
  - **Sushi Train (回転寿司):** a customer orders a word (🦑 いか). Grab the right plates from the conveyor belt in order to build it.
  - **Stepping Stones (川渡り):** hear a sound and hop Mochi onto the right stone. Crossing the river spells a word, and its picture appears on the far bank.
  - **Karuta (かるた):** solo against Mochi (her speed adapts to the child) or two players on one tablet, facing each other.
- **Celebrations:** a soft chime for each correct answer. Every 5 in a row, a paper lantern lights, petals fall for about 2 seconds and Mochi hops. No buzzers, no lives, no "streak lost" messages.
- **Trophy room:** bronze = met it, silver = more than 50% mastery, gold = the whole row mastered. A lit lantern appears for each finished row.

## How learning progresses

- Each character tracks two skills, **hear** (recognise by sound) and **write**. Mastery is their average.
- **Spacing rule:** a skill can reach 45% on its first day of practice, 65% after two days and 85% after three. This stops cramming from faking mastery.
- New characters arrive only when the known ones are healthy.
- The next row unlocks when the current row averages 70% and every character in it is at least 50%.
- Practice picks weak and not-recently-seen characters more often.
- Adventures rotate their games: a hearing game (Listen & Pick or Sound Detective), Trace, a moving game (Goldfish or Stepping Stones), Picture Write, then 1–2 bonus games (Memory, Spot the Different One, Sound Detective, Karuta, Sushi Train).
- **Word bank** (`js/vocab.js`, audio in `audio/vocab/`): 80 words that use only the 46 basic hiragana. Sushi Train and Stepping Stones only ever use words made entirely of characters the child already knows. From あいうえ onwards a few words are available (いえ, あお, うえ, あい), and the list grows with every row.
- Rows: あ か さ た な は ま や ら わ(を ん). All 46 characters already have audio, stroke data and picture words, so later rows work with no extra content.

## Built for the 10" Lenovo tablet

- **Fixed 1280 × 800 landscape design (16:10)**, scaled evenly to the screen. On the tablet's 1920 × 1200 display everything is drawn at 1.5×. Other screen shapes get soft paper-coloured bars at the sides. In portrait, a "turn the tablet sideways" prompt appears.
- **Size rules:** touch targets are at least 56 px and kids' text is at least 18 px (body text 22 px), both at design size.
- **Smooth on mid-range tablet GPUs:** only `transform` and `opacity` are animated. There's no blur, no filter and no animated shadows. Memory cards flip in 2D instead of 3D. Tested at 60 fps with the CPU slowed 4×.
- **Touch:** very large touch contacts (a resting palm) are ignored while tracing, and a stylus works too. Long-press menus and text selection are off. The screen stays awake during play.

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
index.html, manifest.webmanifest, sw.js   PWA shell + offline cache (sw.js lists every file)
css/style.css                             all styling (washi paper / indigo / vermilion theme)
js/main.js        screens: profiles, home, adventure runner, free play, trophies, stamps, parent area
js/session.js     game shell, streaks + celebrations, adventure planner
js/learn.js       mastery model, spacing rule, unlocks, trophies, look-alike distractors
js/trace.js       tracing engine (KanjiVG stroke templates, checking, demos)
js/audio.js       Web Audio playback + soft synthesized chimes
js/ui.js          helpers, Mochi mascot SVG, trophy/lantern SVGs, petals, grown-up gate
js/games/core.js  Meet, Trace, Listen & Pick, Picture Write
js/games/extra.js Goldfish Scoop, Memory Match, Karuta
js/data.js        46 kana, picture words, rows, stroke paths (generated)
audio/kana|words|voice/   pre-generated Japanese speech (mp3)
fonts/            Klee One (textbook-style kana), M PLUS Rounded 1c (UI) — subsetted woff2
```

If you change files, update the precache list and version in `sw.js` (every file must be listed). Otherwise installed copies keep serving the old cached version.

## Changing picture words

Words live in `js/data.js` (`word`, `emoji`, `meaning`). The matching audio is `audio/words/<romaji>.mp3`. If you change a word, regenerate or re-record that file. You can drop in your own recordings with the same file names at any time.

## Credits & licences

- Voices: **VOICEVOX:四国めたん** (kana and words), **VOICEVOX:春日部つむぎ** (Mochi's voice). Generated with VOICEVOX Core. Keep these credits visible if you publish the app (they are shown in the grown-ups screen), and check each character's terms of use before any commercial release.
- Stroke order data: **KanjiVG** © Ulrich Apel, CC BY-SA 3.0 (https://kanjivg.tagaini.net).
- Fonts: **Klee One** (Fontworks) and **M PLUS Rounded 1c**, both SIL Open Font License.
- Mochi the mascot, trophies, lanterns and all other art are original SVG drawn in code. Picture words use the device's emoji font as placeholders.
