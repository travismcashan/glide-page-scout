#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = 'https://afgwuqpsxnglxhosczoi.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('Set SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

async function upsert(table, rows) {
  const batchSize = 50;
  let total = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(batch),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error(`  Error on ${table} batch ${i}:`, resp.status, err);
    } else {
      total += batch.length;
    }
  }
  console.log(`  ${table}: upserted ${total} rows`);
}

function parseCsv(filePath) {
  const text = readFileSync(filePath, 'utf-8');
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(';');
  return lines.slice(1).map(line => {
    const values = line.split(';');
    const row = {};
    headers.forEach((h, i) => {
      let v = values[i]?.trim() ?? '';
      if (v === '') v = null;
      else if (v === 'true') v = true;
      else if (v === 'false') v = false;
      else if (/^\d+(\.\d+)?$/.test(v) && h !== 'id' && !h.endsWith('_id') && !h.endsWith('_at')) v = parseFloat(v);
      row[h] = v;
    });
    return row;
  });
}

const desktop = '/Users/travismcashan/Desktop';

console.log('Importing project_phases...');
const phases = parseCsv(resolve(desktop, 'project_phases-export-2026-03-29_20-29-56.csv'));
await upsert('project_phases', phases);

console.log('Importing team_roles...');
const roles = parseCsv(resolve(desktop, 'team_roles-export-2026-03-29_20-30-06.csv'));
await upsert('team_roles', roles);

console.log('Importing master_tasks...');
const tasks = parseCsv(resolve(desktop, 'master_tasks-export-2026-03-29_20-29-47.csv'));
await upsert('master_tasks', tasks);

console.log('Done!');
