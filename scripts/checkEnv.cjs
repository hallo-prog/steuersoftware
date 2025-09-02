#!/usr/bin/env node
/* Simple environment sanity check (lädt optional .env.local / .env via dotenv) */
try {
  const fs = require('fs');
  const path = require('path');
  const dotenv = require('dotenv');
  const candidates = ['.env.local', '.env'];
  for (const file of candidates) {
    const p = path.join(process.cwd(), file);
    if (fs.existsSync(p)) {
      const res = dotenv.config({ path: p });
      if (res.error) {
        console.warn('Konnte', file, 'nicht laden:', res.error.message);
      }
    }
  }
} catch (e) {
  // dotenv optional
}
// Erwartet in Vite Frontend: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY'
];
const optional = [
  'VITE_SUPABASE_USAGE_THRESHOLD',
  'VITE_R2_ENABLED',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_BASE_URL',
  'GEMINI_API_KEY',
  'VITE_TAVILY_API_KEY'
];

function status(name) {
  if (process.env[name] && process.env[name].trim() !== '') return 'OK';
  return 'MISSING';
}

const pad = (s,l)=> s + ' '.repeat(Math.max(1,l-s.length));
const all = [...required, ...optional];
const width = Math.max(...all.map(s=>s.length)) + 2;

let missingRequired = 0;

console.log('Environment Check (Frontend .env.* Variablen)\n');
for (const key of required) {
  const st = status(key);
  if (st === 'MISSING') missingRequired++;
  console.log(pad(key,width), st);
}
console.log('\nOptional:');
for (const key of optional) {
  console.log(pad(key,width), status(key));
}

if (missingRequired) {
  console.error(`\n❌ Fehlende erforderliche Variablen: ${missingRequired}.`);
  process.exitCode = 1;
} else {
  console.log('\n✅ Grundlegende erforderliche Variablen vorhanden.');
}
