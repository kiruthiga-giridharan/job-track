-- Skills the role asks for (tools, technologies, qualifications), kept apart from
-- tags (work arrangement, employment type, seniority) so they can be shown on
-- their own. Filled by the assistant when a job is extracted, editable by hand.

alter table public.jobs add column if not exists skills text[] not null default '{}';
