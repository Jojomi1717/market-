# Vidéo « nouveau format » (1080×1920)

Animation de bonhommes minimaliste, générée en code.

- `nouveau_format_voix.mp4` : la version finale de 32 s, synchronisée sur la voix off.
- `nouveau_format_40s_sans_voix.mp4` : la première version de 40 s, sans voix.
- `stt.mjs` / `mots_voix.json` : transcription de la voix avec le temps de chaque mot (Whisper base), utilisée pour caler les sous-titres et les scènes.
- `index.html` + `anim.js` : l'animation (ouvrir `index.html` dans un navigateur pour la prévisualiser, `?t=12` pour démarrer à 12 s).
- `music.cjs` : génère la musique et les effets sonores (`music.wav`).
- `render.cjs` : rend les images avec Playwright et les encode avec ffmpeg.

Re-générer :

```sh
node music.cjs
node render.cjs video
# voix.m4a = l'enregistrement de la voix off ; la musique baisse automatiquement quand la voix parle
ffmpeg -i video_silent.mp4 -i music.wav -i voix.m4a -filter_complex "[2:a]aresample=44100,aformat=channel_layouts=stereo,highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=3,loudnorm=I=-15:TP=-1.5:LRA=9,apad=whole_dur=32[vo];[vo]asplit=2[vo1][vo2];[1:a]volume=0.55[mu];[mu][vo1]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck];[duck][vo2]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -t 32 -movflags +faststart nouveau_format_voix.mp4
```

Les textes se modifient dans `anim.js` (fonction `draw`, appels `caption(...)`) ; `*mot*` met un mot en couleur.
