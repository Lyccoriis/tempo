export interface MusicMigration {
  version: number
  name: string
  sql: string
}

const INITIAL = `
CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE artists (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  sort_name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX artists_name ON artists(name COLLATE NOCASE);

CREATE TABLE albums (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  release_year INTEGER,
  release_date TEXT,
  artwork_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX albums_title ON albums(title COLLATE NOCASE);

CREATE TABLE album_artists (
  album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (album_id, artist_id)
) WITHOUT ROWID;
CREATE INDEX album_artists_artist ON album_artists(artist_id);

-- A recording as this profile knows it. One per playable source for now,
-- sources get linked under one track only when a trusted id says so.
CREATE TABLE tracks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  duration_ms INTEGER,
  album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL,
  release_year INTEGER,
  explicit INTEGER,
  instrumental INTEGER,
  known_at INTEGER NOT NULL,
  known_via TEXT NOT NULL,
  known_context TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX tracks_title ON tracks(title COLLATE NOCASE);
CREATE INDEX tracks_album ON tracks(album_id);
CREATE INDEX tracks_known ON tracks(known_at);

CREATE TABLE track_artists (
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'primary',
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (track_id, artist_id, role)
) WITHOUT ROWID;
CREATE INDEX track_artists_artist ON track_artists(artist_id);

-- Something that plays, today a YouTube video id. What the provider showed
-- is kept as seen, apart from the normalized track.
CREATE TABLE track_sources (
  id INTEGER PRIMARY KEY,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'unknown',
  source_title TEXT NOT NULL DEFAULT '',
  source_artist_text TEXT NOT NULL DEFAULT '',
  source_album_text TEXT NOT NULL DEFAULT '',
  artwork_url TEXT NOT NULL DEFAULT '',
  duration_ms INTEGER,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  preferred INTEGER NOT NULL DEFAULT 1,
  UNIQUE (provider, provider_id)
);
CREATE INDEX track_sources_track ON track_sources(track_id);

-- Ids from outside providers (YouTube channels and albums now, MusicBrainz
-- and the like later). No column per provider, a provider is a row.
CREATE TABLE external_ids (
  id INTEGER PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('track', 'source', 'artist', 'album')),
  entity_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  confidence REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (entity_type, provider, external_id)
);
CREATE INDEX external_ids_entity ON external_ids(entity_type, entity_id);

CREATE TRIGGER tracks_drop_ids AFTER DELETE ON tracks BEGIN
  DELETE FROM external_ids WHERE entity_type = 'track' AND entity_id = OLD.id;
END;
CREATE TRIGGER sources_drop_ids AFTER DELETE ON track_sources BEGIN
  DELETE FROM external_ids WHERE entity_type = 'source' AND entity_id = OLD.id;
END;
CREATE TRIGGER artists_drop_ids AFTER DELETE ON artists BEGIN
  DELETE FROM external_ids WHERE entity_type = 'artist' AND entity_id = OLD.id;
END;
CREATE TRIGGER albums_drop_ids AFTER DELETE ON albums BEGIN
  DELETE FROM external_ids WHERE entity_type = 'album' AND entity_id = OLD.id;
END;

-- Sourced facts about a track, one row per feature per provider, with when
-- it was fetched. Confidence only when the provider gave one.
CREATE TABLE track_features (
  id INTEGER PRIMARY KEY,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  value_num REAL,
  value_text TEXT,
  provider TEXT NOT NULL,
  confidence REAL,
  fetched_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (value_num IS NOT NULL OR value_text IS NOT NULL),
  UNIQUE (track_id, feature, provider)
);
CREATE INDEX track_features_feature ON track_features(feature, value_num);

CREATE TABLE track_genres (
  id INTEGER PRIMARY KEY,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  genre TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'genre' CHECK (kind IN ('genre', 'style')),
  weight REAL,
  provider TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  UNIQUE (track_id, genre, kind, provider)
);
CREATE INDEX track_genres_genre ON track_genres(genre COLLATE NOCASE);

-- Every lookup against an outside provider, hit or miss, so a miss is not
-- asked again every day and a match keeps how sure it was.
CREATE TABLE metadata_fetches (
  id INTEGER PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  match_confidence REAL,
  fetched_at INTEGER NOT NULL,
  UNIQUE (entity_type, entity_id, provider)
);

CREATE TABLE listening_sessions (
  id INTEGER PRIMARY KEY,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  app_session TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX listening_sessions_started ON listening_sessions(started_at);

-- One row per time a track was on in the player, from its start until it
-- ended, was skipped or replaced. listened_ms only grows while it is audibly
-- playing, see MusicStatsService.ts. Legacy rows came from the old plays.jsonl.
CREATE TABLE plays (
  id INTEGER PRIMARY KEY,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES track_sources(id) ON DELETE SET NULL,
  session_id INTEGER REFERENCES listening_sessions(id) ON DELETE SET NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  updated_at INTEGER NOT NULL,
  duration_ms INTEGER,
  listened_ms INTEGER NOT NULL DEFAULT 0,
  max_position_ms INTEGER NOT NULL DEFAULT 0,
  completion REAL,
  end_reason TEXT CHECK (end_reason IN ('complete', 'skip', 'stop', 'interrupted', 'legacy')),
  qualified INTEGER NOT NULL DEFAULT 0,
  legacy INTEGER NOT NULL DEFAULT 0,
  legacy_key TEXT UNIQUE,
  origin TEXT NOT NULL DEFAULT ''
);
CREATE INDEX plays_track_started ON plays(track_id, started_at);
CREATE INDEX plays_started ON plays(started_at);
CREATE INDEX plays_open ON plays(ended_at) WHERE ended_at IS NULL;

CREATE TABLE listening_events (
  id INTEGER PRIMARY KEY,
  play_id INTEGER NOT NULL REFERENCES plays(id) ON DELETE CASCADE,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES track_sources(id) ON DELETE SET NULL,
  session_id INTEGER REFERENCES listening_sessions(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('start', 'pause', 'resume', 'seek', 'complete', 'skip', 'stop', 'interrupted', 'legacy')),
  occurred_at INTEGER NOT NULL,
  position_ms INTEGER,
  duration_ms INTEGER,
  listened_ms INTEGER,
  completion REAL,
  origin TEXT NOT NULL DEFAULT '',
  detail TEXT
);
CREATE INDEX listening_events_at ON listening_events(occurred_at);
CREATE INDEX listening_events_track_at ON listening_events(track_id, occurred_at);
CREATE INDEX listening_events_play ON listening_events(play_id);
CREATE INDEX listening_events_type_at ON listening_events(type, occurred_at);

-- Derived from plays, rebuilt by MusicHistory.rebuildStats. Heard means at
-- least one qualified play.
CREATE TABLE track_stats (
  track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  play_count INTEGER NOT NULL,
  listen_count INTEGER NOT NULL,
  completed_count INTEGER NOT NULL,
  skip_count INTEGER NOT NULL,
  total_listened_ms INTEGER NOT NULL,
  first_heard_at INTEGER,
  last_heard_at INTEGER,
  avg_completion REAL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX track_stats_first ON track_stats(first_heard_at);
CREATE INDEX track_stats_last ON track_stats(last_heard_at);
CREATE INDEX track_stats_plays ON track_stats(play_count);

CREATE TABLE search_history (
  id INTEGER PRIMARY KEY,
  query TEXT NOT NULL,
  query_norm TEXT NOT NULL UNIQUE,
  count INTEGER NOT NULL DEFAULT 1,
  searched_at INTEGER NOT NULL,
  result_kind TEXT NOT NULL DEFAULT '',
  result_id TEXT NOT NULL DEFAULT ''
);
CREATE INDEX search_history_at ON search_history(searched_at);
`

const QUALIFIED_INDEX = `
CREATE INDEX plays_qualified_started ON plays(started_at, source_id, listened_ms) WHERE qualified = 1;
`

const COLLECTION = `
CREATE TABLE collection_cards (
  id INTEGER PRIMARY KEY,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  variant TEXT NOT NULL DEFAULT 'base',
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic')),
  unlocked_at INTEGER NOT NULL,
  source_id INTEGER REFERENCES track_sources(id) ON DELETE SET NULL,
  play_id INTEGER REFERENCES plays(id) ON DELETE SET NULL,
  seen_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (track_id, variant)
);
CREATE INDEX collection_cards_unlocked ON collection_cards(unlocked_at);
CREATE INDEX collection_cards_rarity ON collection_cards(rarity);
CREATE INDEX collection_cards_new ON collection_cards(unlocked_at) WHERE seen_at IS NULL;

-- type is 'unlock' or 'quote' today. roll is the number in [0, 1) the seed
-- gave, odds and reason are JSON.
CREATE TABLE collection_events (
  id INTEGER PRIMARY KEY,
  card_id INTEGER REFERENCES collection_cards(id) ON DELETE CASCADE,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  play_id INTEGER REFERENCES plays(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  rarity TEXT,
  roll REAL,
  seed TEXT,
  odds TEXT,
  reason TEXT,
  rules_version INTEGER NOT NULL
);
CREATE INDEX collection_events_card ON collection_events(card_id);
CREATE INDEX collection_events_at ON collection_events(occurred_at);

-- A lyric line for a track, only ever copied from lyrics a provider gave.
-- method says how the line was chosen, pinned is for a choice made by hand.
CREATE TABLE card_quotes (
  id INTEGER PRIMARY KEY,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  line_index INTEGER,
  start_ms INTEGER,
  provider TEXT NOT NULL,
  credit TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  picked_at INTEGER NOT NULL,
  UNIQUE (track_id, text)
);
CREATE INDEX card_quotes_track ON card_quotes(track_id);
`

const SET_TRACKS = `
CREATE TABLE collection_set_tracks (
  id INTEGER PRIMARY KEY,
  album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  video_id TEXT NOT NULL DEFAULT '',
  duration_ms INTEGER,
  fetched_at INTEGER NOT NULL,
  UNIQUE (album_id, position)
);
CREATE INDEX collection_set_tracks_video ON collection_set_tracks(video_id);
`

const ARTIST_TAGS = `
CREATE TABLE artist_tags (
  id INTEGER PRIMARY KEY,
  artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  weight REAL NOT NULL,
  provider TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  UNIQUE (artist_id, tag, provider)
);
CREATE INDEX artist_tags_tag ON artist_tags(tag);
`

const PACKS = `
ALTER TABLE collection_cards ADD COLUMN origin TEXT;
ALTER TABLE collection_cards ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;

CREATE TABLE collection_packs (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  seed TEXT NOT NULL,
  source TEXT NOT NULL,
  meta TEXT,
  created_at INTEGER NOT NULL,
  opened_at INTEGER
);
CREATE INDEX collection_packs_open ON collection_packs(opened_at);

CREATE TABLE pack_cards (
  id INTEGER PRIMARY KEY,
  pack_id INTEGER NOT NULL REFERENCES collection_packs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  rarity TEXT NOT NULL CHECK (rarity IN ('common','uncommon','rare','epic','legendary','mythic')),
  roll REAL NOT NULL,
  odds TEXT NOT NULL,
  flipped_at INTEGER,
  card_id INTEGER REFERENCES collection_cards(id) ON DELETE SET NULL,
  UNIQUE (pack_id, position)
);
CREATE INDEX pack_cards_created ON pack_cards(pack_id, position);

CREATE TABLE notes_ledger (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref TEXT
);
CREATE INDEX notes_ledger_at ON notes_ledger(at);
`

const BINDERS = `
CREATE TABLE binders (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'chart-1',
  cover TEXT NOT NULL DEFAULT 'leather',
  rule TEXT,
  pages INTEGER NOT NULL DEFAULT 10,
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE binder_slots (
  binder_id INTEGER NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  card_id INTEGER NOT NULL UNIQUE REFERENCES collection_cards(id) ON DELETE CASCADE,
  PRIMARY KEY (binder_id, page, slot)
);
`

const TRADES = `
CREATE TABLE traders (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  personality TEXT NOT NULL,
  artist_id INTEGER REFERENCES artists(id) ON DELETE SET NULL,
  mood REAL NOT NULL DEFAULT 0.5,
  trades INTEGER NOT NULL DEFAULT 0,
  special TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE trade_offers (
  id INTEGER PRIMARY KEY,
  trader_id INTEGER NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('board','request')),
  gives TEXT NOT NULL,
  wants TEXT,
  ask INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'open',
  closed_at INTEGER,
  summary TEXT
);
CREATE INDEX trade_offers_state ON trade_offers(state, expires_at);
`

const TRADER_MEMORY = `
CREATE TABLE trader_memory (
  id INTEGER PRIMARY KEY,
  trader_id INTEGER NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  offer_id INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('gave','got')),
  track_id INTEGER NOT NULL,
  rarity TEXT NOT NULL,
  loved INTEGER NOT NULL DEFAULT 0,
  at INTEGER NOT NULL
);
CREATE INDEX trader_memory_trader ON trader_memory(trader_id, at);
`

const WISHLIST = `
CREATE TABLE wishlist (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('song','album','artist','rarity')),
  target_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (kind, target_id)
);
`

export const MIGRATIONS: MusicMigration[] = [
  { version: 1, name: 'initial_schema', sql: INITIAL },
  { version: 2, name: 'plays_qualified_index', sql: QUALIFIED_INDEX },
  { version: 3, name: 'card_collection', sql: COLLECTION },
  { version: 4, name: 'collection_set_tracks', sql: SET_TRACKS },
  { version: 5, name: 'artist_tags', sql: ARTIST_TAGS },
  { version: 6, name: 'collection_packs', sql: PACKS },
  { version: 7, name: 'binders', sql: BINDERS },
  { version: 8, name: 'trades', sql: TRADES },
  { version: 9, name: 'trader_memory', sql: TRADER_MEMORY },
  { version: 10, name: 'wishlist', sql: WISHLIST },
]

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version
