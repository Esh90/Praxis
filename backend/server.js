import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { healthRouter } from './src/routes/health.js';
import { plansRouter } from './src/routes/plans.js';
import { feedbackRouter } from './src/routes/feedback.js';
import { generateRouter } from './src/routes/generate.js';
import { praxisRouter } from './src/routes/praxis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: new URL('./.env', import.meta.url) });
// Agents pipeline reads keys from agents/.env in local dev
dotenv.config({ path: path.resolve(__dirname, '..', 'agents', '.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.status(200).json({ ok: true, name: 'praxis-backend' });
});

app.use('/api/health', healthRouter);
app.use('/api/plans', plansRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/generate', generateRouter);
app.use('/api/praxis', praxisRouter);

const port = Number(process.env.PORT || 3001);

app.listen(port, () => {
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY);
  if (!hasGroqKey) {
    // Expected warning until .env is filled
    console.warn('[warn] GROQ_API_KEY is not set (generate endpoint will fail)');
  }
  console.log(`[ready] backend listening on http://localhost:${port}`);
});

