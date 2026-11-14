// Archivos: carpeta ./data en local, bucket de Cloud Storage en la nube (BUCKET).
import fs from 'node:fs/promises';
import path from 'node:path';
import { Storage } from '@google-cloud/storage';

const bucket = process.env.BUCKET && new Storage().bucket(process.env.BUCKET);
const DIR = path.resolve('data');

export async function save(name, buf) {
  if (bucket) return bucket.file(name).save(buf, { resumable: false });
  await fs.mkdir(path.dirname(path.join(DIR, name)), { recursive: true });
  await fs.writeFile(path.join(DIR, name), buf);
}

export async function load(name) {
  try {
    if (bucket) return (await bucket.file(name).download())[0];
    return await fs.readFile(path.join(DIR, name));
  } catch { return null; }
}

// Borra todo lo que empiece con `prefix` (p. ej. 'cards/', 'voices/'): para “Borrar todo” tras un ensayo o al final del evento.
export async function removeAll(prefix) {
  if (bucket) return bucket.deleteFiles({ prefix, force: true });
  await fs.rm(path.join(DIR, prefix), { recursive: true, force: true });
}
