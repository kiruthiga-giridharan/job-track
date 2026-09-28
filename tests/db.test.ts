// Runs the real migration against an in-memory Postgres (PGlite) with a minimal
// stand-in for Supabase's `auth` schema, then exercises the access rules.
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

const migrationsDir = fileURLToPath(new URL('../supabase/migrations/', import.meta.url))
const migration = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort()
  .map(f => readFileSync(migrationsDir + f, 'utf8'))
  .join('\n')

const AUTH_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- Supabase grants table privileges to these roles by default at creation time.
  alter default privileges in schema public grant all on tables to anon, authenticated;
`

let db: PGlite
let jobId = ''

async function asAnon(sql: string, params: unknown[] = []) {
  await db.exec('set role anon')
  try {
    return await db.query<Record<string, unknown>>(sql, params)
  } finally {
    await db.exec('reset role')
  }
}

async function tableExists(name: string) {
  const res = await db.query<{ t: string | null }>(`select to_regclass($1) as t`, [name])
  return res.rows[0].t !== null
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(AUTH_STUB)
  await db.exec(migration)
})

describe('public board (no sign-in)', () => {
  it('drops the sign-in tables and user columns', async () => {
    expect(await tableExists('public.members')).toBe(false)
    expect(await tableExists('public.invites')).toBe(false)
    const cols = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'jobs'`,
    )
    const names = cols.rows.map(r => r.column_name)
    expect(names).not.toContain('added_by')
    expect(names).not.toContain('updated_by')
  })

  it('lets anonymous visitors add a job and trims its fields', async () => {
    const res = await asAnon(
      `insert into public.jobs (title, company, apply_url) values ('  Designer ', 'Bloom', 'https://bloom.example/jobs/1') returning id, title`,
    )
    jobId = res.rows[0].id as string
    expect(res.rows[0].title).toBe('Designer')
  })

  it('lets anonymous visitors read and update jobs, stamping applied_at', async () => {
    expect((await asAnon('select id from public.jobs')).rows).toHaveLength(1)
    const on = await asAnon(`update public.jobs set applied = true, notes = 'Résumé v3' where id = $1 returning applied_at, notes`, [jobId])
    expect(on.rows[0].applied_at).not.toBeNull()
    expect(on.rows[0].notes).toBe('Résumé v3')
    const off = await asAnon(`update public.jobs set applied = false where id = $1 returning applied_at`, [jobId])
    expect(off.rows[0].applied_at).toBeNull()
  })

  it('rejects invalid application URLs', async () => {
    await expect(asAnon(`insert into public.jobs (title, company, apply_url) values ('X', 'Y', 'javascript:alert(1)')`)).rejects.toThrow(
      /check constraint/,
    )
  })

  it('lets anonymous visitors delete jobs', async () => {
    const res = await asAnon('delete from public.jobs where id = $1 returning id', [jobId])
    expect(res.rows).toHaveLength(1)
  })
})
