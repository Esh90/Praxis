import { Router } from 'express';
import { groqGenerate } from '../services/groq.js';

export const generateRouter = Router();

generateRouter.post('/', async (req, res) => {
  try {
    const { prompt } = req.body ?? {};
    const result = await groqGenerate({ apiKey: process.env.GROQ_API_KEY, prompt });
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const code = err && typeof err === 'object' ? err.code : undefined;
    const status = code === 'MISSING_API_KEY' || /api key/i.test(message) ? 400 : 500;
    res.status(status).json({ ok: false, error: message, code });
  }
});

