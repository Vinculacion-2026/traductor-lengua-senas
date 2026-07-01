create extension if not exists pgcrypto;

create table if not exists sign_entries (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  entry_type text not null check (entry_type in ('sign', 'letter')),
  scope text not null default 'global' check (scope in ('global', 'local')),
  schema_version integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (label, entry_type, scope)
);

create table if not exists sign_samples (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references sign_entries(id) on delete cascade,
  sample_kind text not null check (sample_kind in ('pose', 'motion')),
  feature_vector_version text,
  feature_count integer,
  duration_ms integer,
  frame_count integer,
  captured_at timestamptz not null default now(),
  vector jsonb,
  frames jsonb,
  raw_sample jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists sign_entries_label_idx on sign_entries (entry_type, label);
create index if not exists sign_samples_entry_id_idx on sign_samples (entry_id);
create index if not exists sign_samples_captured_at_idx on sign_samples (captured_at);
