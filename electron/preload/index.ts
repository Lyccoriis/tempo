import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {

  profile: {
    list: () =>
      ipcRenderer.invoke('profile:list'),

    create: (opts: unknown) =>
      ipcRenderer.invoke('profile:create', opts),

    switch: (id: string) =>
      ipcRenderer.invoke('profile:switch', id),

    update: (id: string, patch: { name?: string; role?: string; color?: string }) =>
      ipcRenderer.invoke('profile:update', id, patch),

    setPicture: (id: string, dataUrl: string | null) =>
      ipcRenderer.invoke('profile:setPicture', id, dataUrl),

    delete: (id: string) =>
      ipcRenderer.invoke('profile:delete', id),

    paths: (id: string) =>
      ipcRenderer.invoke('profile:paths', id),

    getConfig: (id: string) =>
      ipcRenderer.invoke('profile:getConfig', id),

    saveConfig: (id: string, config: unknown) =>
      ipcRenderer.invoke('profile:saveConfig', id, config),

    getLayout: (id: string) =>
      ipcRenderer.invoke('profile:getLayout', id),

    saveLayout: (id: string, layout: unknown) =>
      ipcRenderer.invoke('profile:saveLayout', id, layout),
  },

  ytmusic: {
    start: () => ipcRenderer.invoke('ytmusic:start'),

    show: (bounds: { x: number; y: number; width: number; height: number }) =>
      ipcRenderer.invoke('ytmusic:show', bounds),

    hide: () => ipcRenderer.invoke('ytmusic:hide'),

    home: () => ipcRenderer.invoke('ytmusic:home'),

    signedIn: () => ipcRenderer.invoke('ytmusic:signedIn'),

    importCookies: (header: string) => ipcRenderer.invoke('ytmusic:importCookies', header),

    loginBrowser: () => ipcRenderer.invoke('ytmusic:loginBrowser'),

    signInWithBrowser: () => ipcRenderer.invoke('ytmusic:signInWithBrowser'),

    signOut: () => ipcRenderer.invoke('ytmusic:signOut'),

    state: () => ipcRenderer.invoke('ytmusic:state'),

    command: (command: unknown) => ipcRenderer.invoke('ytmusic:command', command),

    onState: (cb: (state: unknown) => void) => {
      const listener = (_event: unknown, payload: unknown) => cb(payload)
      ipcRenderer.on('ytmusic:state', listener)
      return () => ipcRenderer.removeListener('ytmusic:state', listener)
    },

    onFeel: (cb: (feel: unknown) => void) => {
      const listener = (_event: unknown, payload: unknown) => cb(payload)
      ipcRenderer.on('ytmusic:feel', listener)
      return () => ipcRenderer.removeListener('ytmusic:feel', listener)
    },

    queue: () => ipcRenderer.invoke('ytmusic:queue'),

    onQueue: (cb: (queue: unknown) => void) => {
      const listener = (_event: unknown, payload: unknown) => cb(payload)
      ipcRenderer.on('ytmusic:queue', listener)
      return () => ipcRenderer.removeListener('ytmusic:queue', listener)
    },

    eq: (eq: unknown) => ipcRenderer.invoke('ytmusic:eq', eq),
    fade: (fade: unknown) => ipcRenderer.invoke('ytmusic:fade', fade),

    spectrum: () => ipcRenderer.invoke('ytmusic:spectrum'),

    genre: (title: string, artist: string) => ipcRenderer.invoke('ytmusic:genre', title, artist),

    about: (kind: string, title: string, artist: string) => ipcRenderer.invoke('ytmusic:about', kind, title, artist),

    search: (query: string) => ipcRenderer.invoke('ytmusic:search', query),

    browse: (browseId: string) => ipcRenderer.invoke('ytmusic:browse', browseId),

    more: (token: string) => ipcRenderer.invoke('ytmusic:more', token),

    lyrics: (videoId: string, hint?: { title: string; artist: string; duration: number }) =>
      ipcRenderer.invoke('ytmusic:lyrics', videoId, hint),

    wordTimed: (videoIds: string[]) => ipcRenderer.invoke('ytmusic:wordTimed', videoIds),

    translateLyrics: (videoId: string) => ipcRenderer.invoke('ytmusic:translateLyrics', videoId),

    stats: (range: string) => ipcRenderer.invoke('ytmusic:stats', range),

    onPlayed: (cb: (play: unknown) => void) => {
      const listener = (_event: unknown, payload: unknown) => cb(payload)
      ipcRenderer.on('ytmusic:played', listener)
      return () => ipcRenderer.removeListener('ytmusic:played', listener)
    },
  },

  musicRepo: {
    open: (profileId: string) => ipcRenderer.invoke('musicRepo:open', profileId),
    info: () => ipcRenderer.invoke('musicRepo:info'),
    summary: () => ipcRenderer.invoke('musicRepo:summary'),
    tables: () => ipcRenderer.invoke('musicRepo:tables'),
    tracks: (query: unknown) => ipcRenderer.invoke('musicRepo:tracks', query),
    track: (id: number) => ipcRenderer.invoke('musicRepo:track', id),
    trackByVideo: (videoId: string) => ipcRenderer.invoke('musicRepo:trackByVideo', videoId),
    trackHistory: (id: number, offset: number, limit: number) => ipcRenderer.invoke('musicRepo:trackHistory', id, offset, limit),
    artists: (query: unknown) => ipcRenderer.invoke('musicRepo:artists', query),
    artist: (id: number) => ipcRenderer.invoke('musicRepo:artist', id),
    albums: (query: unknown) => ipcRenderer.invoke('musicRepo:albums', query),
    album: (id: number) => ipcRenderer.invoke('musicRepo:album', id),
    events: (query: unknown) => ipcRenderer.invoke('musicRepo:events', query),
    plays: (query: unknown) => ipcRenderer.invoke('musicRepo:plays', query),
    searchHistory: (limit: number) => ipcRenderer.invoke('musicRepo:searchHistory', limit),
    recordSearch: (query: string, resultKind?: string, resultId?: string) =>
      ipcRenderer.invoke('musicRepo:recordSearch', query, resultKind, resultId),
    clearSearch: (id?: number) => ipcRenderer.invoke('musicRepo:clearSearch', id),
    integrity: () => ipcRenderer.invoke('musicRepo:integrity'),
    rebuildStats: () => ipcRenderer.invoke('musicRepo:rebuildStats'),
    setAside: () => ipcRenderer.invoke('musicRepo:setAside'),
    artwork: (url: string) => ipcRenderer.invoke('musicRepo:artwork', url),
    onChanged: (cb: () => void) => {
      const listener = () => cb()
      ipcRenderer.on('musicRepo:changed', listener)
      return () => ipcRenderer.removeListener('musicRepo:changed', listener)
    },
  },

  musicDiscover: {
    taste: () => ipcRenderer.invoke('musicDiscover:taste'),
    enrich: () => ipcRenderer.invoke('musicDiscover:enrich'),
    library: (query: unknown) => ipcRenderer.invoke('musicDiscover:library', query),
    fresh: (query: unknown) => ipcRenderer.invoke('musicDiscover:fresh', query),
    find: (title: string, artist: string) => ipcRenderer.invoke('musicDiscover:find', title, artist),
    home: () => ipcRenderer.invoke('musicDiscover:home'),
    onProgress: (cb: (progress: unknown) => void) => {
      const listener = (_e: unknown, progress: unknown) => cb(progress)
      ipcRenderer.on('musicDiscover:progress', listener)
      return () => ipcRenderer.removeListener('musicDiscover:progress', listener)
    },
  },

  update: {
    state: () => ipcRenderer.invoke('update:state'),
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.send('update:install'),
    onState: (fn: (state: unknown) => void) => {
      const listener = (_event: unknown, state: unknown) => fn(state)
      ipcRenderer.on('update:state', listener)
      return () => { ipcRenderer.removeListener('update:state', listener) }
    },
  },

  shell: {
    setTitle: (title: string) =>
      ipcRenderer.send('shell:setTitle', title),

    openExternal: (url: string) =>
      ipcRenderer.send('shell:openExternal', url),

    showInFolder: (path: string) =>
      ipcRenderer.send('shell:showInFolder', path),

    setTheme: (theme: string) =>
      ipcRenderer.send('shell:setTheme', theme),

    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    onMaximized: (fn: (value: boolean) => void) => {
      const listener = (_event: unknown, value: boolean) => fn(value)
      ipcRenderer.on('window:maximized', listener)
      return () => { ipcRenderer.removeListener('window:maximized', listener) }
    },
  },
})
