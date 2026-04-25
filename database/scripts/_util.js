import fs from 'fs';
import path from 'path';

export function readSqlFilesSorted(dirPath) {
  return fs
    .readdirSync(dirPath)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((filename) => ({
      filename,
      fullPath: path.join(dirPath, filename),
      sql: fs.readFileSync(path.join(dirPath, filename), 'utf-8')
    }));
}

export function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

