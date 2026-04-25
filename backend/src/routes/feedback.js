import { Router } from 'express';
import { addFeedback, listFeedback } from '../lib/memoryStore.js';

export const feedbackRouter = Router();

feedbackRouter.get('/', (_req, res) => {
  res.status(200).json({ ok: true, feedback: listFeedback() });
});

feedbackRouter.post('/', (req, res) => {
  const { message, rating, meta } = req.body ?? {};

  if (typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ ok: false, error: 'message is required' });
  }

  const entry = {
    id: `fb_${Date.now()}`,
    message: message.trim(),
    rating: typeof rating === 'number' ? rating : null,
    meta: meta && typeof meta === 'object' ? meta : null,
    createdAt: new Date().toISOString()
  };

  addFeedback(entry);
  return res.status(201).json({ ok: true, feedback: entry });
});

