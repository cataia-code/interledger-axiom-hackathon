import { ping } from '../services/pingService.js';

export function getPing(req, res) {
  res.json(ping());
}
