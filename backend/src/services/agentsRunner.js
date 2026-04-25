import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

function defaultAgentsRoot() {
  const backendDir = path.dirname(fileURLToPath(import.meta.url)); // .../backend/src/services
  return path.resolve(backendDir, '..', '..', '..', 'agents');
}

export async function importAgentsOrchestrator() {
  const agentsRoot = process.env.PRAXIS_AGENTS_ROOT
    ? path.resolve(process.env.PRAXIS_AGENTS_ROOT)
    : defaultAgentsRoot();

  const orchestratorPath = path.join(agentsRoot, 'orchestrator.js');
  if (!fs.existsSync(orchestratorPath)) {
    throw new Error(`Could not find agents orchestrator at: ${orchestratorPath}`);
  }

  const mod = await import(pathToFileURL(orchestratorPath).href);
  if (typeof mod.runPipeline !== 'function') {
    throw new Error('agents/orchestrator.js must export runPipeline()');
  }
  return { runPipeline: mod.runPipeline, agentsRoot };
}
