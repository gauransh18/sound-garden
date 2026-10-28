# Sound Garden

**Play it at [sound-garden.pages.dev](https://sound-garden.pages.dev).**

Plant flowers in a little garden bed. A breeze sweeps across it and plays them as a tune. Send the link and whoever opens it hears your garden.

A painted 3D diorama made with three.js, with the same small pill UI as Doodle Pond. Single player, no backend, no sign-up: the whole garden lives in the URL.

- **Plant**: pick a flower, then tap the soil. Drag to plant a run of them. Tap a flower to pull it up, or drag to pull several.
- **Notes**: the bed is 16 steps by 8 notes. Time runs left to right (top to bottom on a phone). Higher rows sing higher, and the flowers there grow taller. Every row is in C major pentatonic, so anything you plant is in tune.
- **Flowers**: Tulip is a bell, Daisy a plucked string, Lavender a low hum, and Mushroom a drum: kicks on the low rows, toms, then wood blocks and shakers at the top.
- **Breeze**: play or pause, and set the tempo from 60 to 160 bpm. Each step is an eighth note.
- **Surprise me** plants a random garden with a groove, a bass line and a melody. **Clear** empties the bed, with an undo.
- **Share** copies the link, or opens the share sheet on phones. Someone who opens a shared link gets a "Have a listen" card first, because browsers only allow sound after a tap.

Keys: `Space` plays and pauses, `1`–`4` pick a flower.

## Run it

```bash
npm install
npm run dev
```

## Deploy (Cloudflare Pages)

The site is static, so there is nothing to configure beyond the project name in `wrangler.toml`.

```bash
npm run deploy
```

## The link

The hash is `#1.<bpm>.<flowers>`, for example `#1.100.GAGIALCh…`. Each flower is two base64url characters holding `kind * 128 + cell`, where `cell = row * 16 + col`. A full bed of 128 flowers is a 256-character hash. Anything the decoder can't read is skipped. Every edit updates the hash with `replaceState`, so the address bar is always a working share link and Back isn't flooded. The last garden is also kept in `localStorage`, so returning to the bare URL brings it back.

## Sound

Every sound is synthesized with Web Audio, with no audio files. All voices go through one bus with a short generated reverb and a compressor, so a full column doesn't clip. Notes are scheduled on the audio clock with a 140 ms lookahead, and the screen catches up to each step when it's heard, so the breeze band and flower bounces stay in sync with the sound. The breeze pauses when the tab is hidden and picks up again when you come back.

The link preview is `public/og.png` (1200×630). To make a new one, run `npm run dev` and take a 1200×630 screenshot of `http://localhost:5174/?shot`, which hides the controls, shows a title and only works in development:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars --window-size=1200,630 --virtual-time-budget=6000 --screenshot=public/og.png "http://localhost:5174/?shot"
```

## Demo video

`promo/sound-garden-demo.mp4` is a 14-second clip (1920×1080, 30 fps, with sound) of a cursor planting a melody over a drum groove, then sharing the link. `promo/poster.jpg` is a frame from it.

It's recorded frame by frame, not screen-captured. With `npm run dev` running, `promo/capture.mjs` opens `/?rec` in headless Chrome. In that mode, which only works in development, the page runs on a clock the script steps one frame at a time, plays no sound and logs every note it would have played. After the last frame, those notes are rendered offline through the same voices and effects, so the soundtrack lines up with the picture. To re-record:

```bash
node promo/capture.mjs /tmp/sg
```

```bash
ffmpeg -y -framerate 30 -pattern_type glob -i '/tmp/sg/frames/*.jpg' -i /tmp/sg/audio.wav -vf "fade=t=out:st=13.75:d=0.45:color=0xf1eee7,format=yuv420p" -af "loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st=13.6:d=0.6" -c:v libx264 -crf 18 -movflags +faststart -c:a aac -b:a 192k -t 14.2 promo/sound-garden-demo.mp4
```

## Code map

| File | What it does |
| --- | --- |
| `src/main.js` | Boots the app: reads the link, picker, planting, controls, start card, frame loop |
| `src/garden.js` | The bed model, link encode and decode, demo and surprise gardens |
| `src/scene.js` | Painted meadow tile, garden bed, breeze, picking, camera fit |
| `src/flowers.js` | The four flower meshes and picker icons |
| `src/music.js` | Synth voices, effects bus, lookahead sequencer, offline render for the demo |
| `promo/` | Demo video, poster frame and the script that records them |
