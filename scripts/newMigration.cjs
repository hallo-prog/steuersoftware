#!/usr/bin/env node
/* Generate timestamped migration skeleton */
const fs = require('fs');
const path = require('path');

const nameArg = process.argv[2];
if (!nameArg) {
  console.error('Usage: npm run db:new <name>');
  process.exit(1);
}

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
if (!fs.existsSync(migrationsDir)) {
  console.error('Migrations directory not found:', migrationsDir);
  process.exit(1);
}

// Determine next sequential number (keep existing pattern 0001, 0002 ...)
const files = fs.readdirSync(migrationsDir).filter(f=>/^\d{4}_.*\.sql$/.test(f));
const nums = files.map(f=>parseInt(f.slice(0,4),10));
const next = (nums.length ? Math.max(...nums)+1 : 1);
const nextStr = String(next).padStart(4,'0');
const safeName = nameArg.replace(/[^a-z0-9_-]+/gi,'_').toLowerCase();
const filename = `${nextStr}_${safeName}.sql`;
const fullPath = path.join(migrationsDir, filename);

if (fs.existsSync(fullPath)) {
  console.error('File already exists:', filename);
  process.exit(1);
}

const template = `-- ${filename}\n-- Beschreibung: ${nameArg}\n\nBEGIN;\n\n-- SQL hier einfügen\n\nCOMMIT;\n`;
fs.writeFileSync(fullPath, template, 'utf8');
console.log('Created migration', filename);
