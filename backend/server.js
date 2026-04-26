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

// CORS: in production, set FRONTEND_ORIGIN to a comma-separated allowlist
// (e.g. "https://praxis.example.workers.dev,https://app.praxis.dev").
// When unset (local dev), accept all origins to keep the dev loop frictionless.
const frontendOriginEnv = process.env.FRONTEND_ORIGIN?.trim();
if (frontendOriginEnv) {
  const allowList = new Set(
    frontendOriginEnv
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  );
  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin / curl / health checks (no Origin header)
        if (!origin) return callback(null, true);
        if (allowList.has(origin)) return callback(null, true);
        return callback(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
    }),
  );
} else {
  app.use(cors());
}

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
// Bind to 0.0.0.0 so Render / Docker / cloud runtimes can reach the process.
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY);
  if (!hasGroqKey) {
    console.warn('[warn] GROQ_API_KEY is not set (generate endpoint will fail)');
  }
  if (frontendOriginEnv) {
    console.log(`[cors] allowlist: ${frontendOriginEnv}`);
  } else {
    console.log('[cors] open (no FRONTEND_ORIGIN set) — fine for local dev');
  }
  console.log(`[ready] backend listening on http://${host}:${port}`);
});

