-- Application record fields on per-person opportunity tracking
alter table public.opportunity_tracking
  add column if not exists apply_url text,
  add column if not exists application_doc_url text,
  add column if not exists submitted_at timestamptz,
  add column if not exists confirmation_code text,
  add column if not exists application_items jsonb not null default '[]'::jsonb;

comment on column public.opportunity_tracking.apply_url is
  'Portal or apply URL (may differ from program homepage)';
comment on column public.opportunity_tracking.application_doc_url is
  'Link to Google Doc, Word, or PDF with application Q/A';
comment on column public.opportunity_tracking.submitted_at is
  'When the application was submitted';
comment on column public.opportunity_tracking.confirmation_code is
  'Portal confirmation number or receipt note';
comment on column public.opportunity_tracking.application_items is
  'Checklist / Q&A rows: [{id, question, answer, done}]';
