# Dev tools

These aren't part of the app (the service worker skips this folder). The scripts use paths from the original
build machine (`/home/claude/...`), so adjust those before running.

- `make_content.py` → `content.json`: hiragana list, picture words, rows and Mochi's lines
- `gen_kana_voice.py`: the 46 single-hiragana sounds (春日部つむぎ, natural length, clean volume; needs voice_compare.py for the engine setup)
- `gen_audio.py`: picture-word and Mochi audio via VOICEVOX Core 0.16
- `vocab.py` → `js/vocab.js` + `vocab.json`; `gen_vocab_audio.py` makes `audio/vocab/*`
- `gen_wardrobe_audio.py`: Mochi saying each wardrobe item name (audio/wardrobe/*)
- `normalize.py`, then `even_out.py`: level all speech clips (run after generating any audio)
- `build.py`: writes `sw.js` (every file + fingerprint) and `version.json` with the note from `release-notes.txt`. Run after ANY change; `HQ_ROOT=/path` builds another folder; `build.py icons` also renders the app icons
- `sw.template.js`: the service worker source (offline cache + updates)
- `tests/`: Playwright scripts for full adventures, every game, the tracing checker on all 46 hiragana, frame timing with the CPU slowed 4×, offline mode, and updates (`update_test.py`: start-up update, mid-game deferral, offline start, broken deploy; `legacy_test.py`: hand-over from the pre-update version). Serve the app on http://localhost:8765 first.
