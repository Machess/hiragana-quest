# Dev tools

These aren't part of the app (the service worker skips this folder). The scripts use paths from the original
build machine (`/home/claude/...`), so adjust those before running.

- `make_content.py` → `content.json`: hiragana list, picture words, rows and Mochi's lines
- `gen_audio.py`: hiragana, picture-word and Mochi audio via VOICEVOX Core 0.16 (`kana-only` regenerates just the hiragana)
- `vocab.py` → `js/vocab.js` + `vocab.json`; `gen_vocab_audio.py` makes `audio/vocab/*`
- `normalize.py`, then `even_out.py`: level all speech clips (run after generating any audio)
- `build.py`: rewrites `sw.js` with every file and a content-hash version (run after ANY change); `build.py icons` also renders the app icons
- `tests/`: Playwright scripts for full adventures, every game, the tracing checker on all 46 hiragana, frame timing with the CPU slowed 4× and offline mode. Serve the app on http://localhost:8765 first.
