import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from '../config/index.js';

// Almacén de imágenes con dos drivers intercambiables: disco local (desarrollo) y bucket compatible con S3
// (Railway Bucket en producción). Las claves son rutas relativas como `items/12/<uuid>.webp`.
// Interfaz: put(key, buffer, contentType), remove(key) y get(key) → { stream, contentType, contentLength } | null.

const TYPES = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

export function createDiskStorage(dir) {
  const file = (key) => path.join(dir, key);
  return {
    name: 'disk',
    async put(key, buffer) {
      await mkdir(path.dirname(file(key)), { recursive: true });
      await writeFile(file(key), buffer);
    },
    async remove(key) {
      await rm(file(key), { force: true });
    },
    async get(key) {
      try {
        const info = await stat(file(key));
        if (!info.isFile()) return null;
        return { stream: createReadStream(file(key)), contentType: TYPES[path.extname(key)] ?? 'application/octet-stream', contentLength: info.size };
      } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw err;
      }
    },
  };
}

export function createS3Storage({ client, bucket }) {
  return {
    name: 's3',
    async put(key, buffer, contentType = 'image/webp') {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }));
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    async get(key) {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return { stream: res.Body, contentType: res.ContentType ?? 'application/octet-stream', contentLength: res.ContentLength };
      } catch (err) {
        if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return null;
        throw err;
      }
    },
  };
}

function defaultStorage() {
  const s3 = config.s3;
  if (!s3) return createDiskStorage(config.uploadDir);
  const client = new S3Client({
    endpoint: s3.endpoint,
    region: s3.region,
    forcePathStyle: s3.forcePathStyle,
    credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
  });
  return createS3Storage({ client, bucket: s3.bucket });
}

let current = defaultStorage();
export const storage = {
  get name() { return current.name; },
  put: (...args) => current.put(...args),
  remove: (...args) => current.remove(...args),
  get: (...args) => current.get(...args),
};
// Solo para pruebas: sustituye el driver.
export const setStorage = (driver) => {
  current = driver ?? defaultStorage();
};
