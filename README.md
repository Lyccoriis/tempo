# Tempo

A YouTube Music desktop player for Windows, with a queue, synced lyrics, search, discover, a library view, listening stats, a ten band equalizer, and a backdrop that moves with the music.

Everything stays on your machine. Your listening history lives in a local SQLite database inside your profile folder, and profiles can be switched without restarting.

## Features

- Player bar, queue, mini player and a full screen focus view
- Synced lyrics, with word timing and translation where it is available
- Search, discover and a library built from what you play
- Stats and a data browser over your plays, tracks, artists and albums
- Ten band equalizer with presets, automatic presets by genre, balance, limiter and fade between songs
- Animated backdrop that follows the music, with a karaoke line
- Profiles, keystrokes you can rebind, and a finder on double Shift
- Updates download in the background and install on restart

## Run it

```
npm install
npm run dev
```

`npm install` also fetches the Electron build of `better-sqlite3`. Close the app before running it again, Windows keeps the old file locked.

## Build

```
npm run build
```

The installer lands in `release/`. `npm run release` builds and publishes it as a GitHub release, which is where installed copies look for updates.

## Layout

- `electron/` the main process: window, the YouTube Music view, the database, IPC handlers, the preload
- `src/` the React interface: panels, stores, shared components, styles
- `build/` the app icon

## Sign in

Open the Music panel and choose sign in. Tempo opens your own Edge or Chrome on a profile of its own and reads the login from there, because Google refuses to sign in inside an embedded browser.
