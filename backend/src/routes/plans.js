import { Router } from 'express';
import { getPlans } from '../lib/memoryStore.js';

export const plansRouter = Router();

plansRouter.get('/', (_req, res) => {
  res.status(200).json({ ok: true, plans: getPlans() });
});

