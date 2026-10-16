import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import app from '../src/app.js';
import { notFound, errorHandler } from '../src/middlewares/errorHandler.js';

test('GET /api/v1/health returns 200 ok', async () => {
  const res = await request(app).get('/api/v1/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('GET /api/v1/ping returns pong', async () => {
  const res = await request(app).get('/api/v1/ping');
  assert.equal(res.status, 200);
  assert.equal(res.body.message, 'pong');
});

test('unknown route returns JSON 404', async () => {
  const res = await request(app).get('/api/v1/nope');
  assert.equal(res.status, 404);
  assert.match(res.headers['content-type'], /json/);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('error handler returns JSON 500 for unexpected errors', async () => {
  const bad = express();
  bad.get('/boom', () => {
    throw new Error('boom');
  });
  bad.use(notFound, errorHandler);
  const res = await request(bad).get('/boom');
  assert.equal(res.status, 500);
  assert.equal(res.body.error.code, 'INTERNAL_ERROR');
});
