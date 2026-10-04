# Vidéo « nouveau format » (40 s, 1080×1920)

Animation de bonhommes minimaliste, générée en code.

- `nouveau_format_40s.mp4` : la vidéo finale (avec musique).
- `index.html` + `anim.js` : l'animation (ouvrir `index.html` dans un navigateur pour la prévisualiser, `?t=12` pour démarrer à 12 s).
- `music.cjs` : génère la musique et les effets sonores (`music.wav`).
- `render.cjs` : rend les images avec Playwright et les encode avec ffmpeg.

Re-générer :

```sh
node music.cjs
node render.cjs video
ffmpeg -i video_silent.mp4 -i music.wav -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart nouveau_format_40s.mp4
```

Les textes se modifient dans `anim.js` (fonction `draw`, appels `caption(...)`) ; `*mot*` met un mot en couleur.
