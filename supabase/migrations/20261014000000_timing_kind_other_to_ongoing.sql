-- Collapse legacy "other" into ongoing (summer vs year-round only)
update public.opportunities
set timing_kind = 'ongoing'
where timing_kind = 'other';
