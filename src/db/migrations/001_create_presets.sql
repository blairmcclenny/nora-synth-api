CREATE TABLE presets (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version = 1),
  filter double precision NOT NULL CHECK (filter BETWEEN 0 AND 1),
  mood double precision NOT NULL CHECK (mood BETWEEN 0 AND 1),
  movement double precision NOT NULL CHECK (movement BETWEEN 0 AND 1),
  space double precision NOT NULL CHECK (space BETWEEN 0 AND 1),
  expression double precision NOT NULL CHECK (expression BETWEEN 0 AND 1),
  attack double precision NOT NULL CHECK (attack BETWEEN 0 AND 1),
  decay double precision NOT NULL CHECK (decay BETWEEN 0 AND 1),
  sustain double precision NOT NULL CHECK (sustain BETWEEN 0 AND 1),
  release double precision NOT NULL CHECK (release BETWEEN 0 AND 1),
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);