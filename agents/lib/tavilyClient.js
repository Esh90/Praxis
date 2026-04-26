import { TavilyClient } from 'tavily';
import dotenv from 'dotenv';
dotenv.config();

// `tavily` package reads TAVILY_API_KEY from env by default,
// but we pass it explicitly for clarity.
const client = new TavilyClient({ apiKey: process.env.TAVILY_API_KEY });

// Session-level credit tracker (resets on process restart)
let creditsUsed = 0;
const MAX_CREDITS = parseInt(process.env.TAVILY_MAX_CREDITS_PER_RUN || '4');

// Domain-specific allow-lists. Climate hypotheses returned no PubMed hits
// (the original list was bio-only), so each domain now has tailored hosts.
const DOMAIN_INCLUDE_DOMAINS = {
  diagnostics: [
    'pubmed.ncbi.nlm.nih.gov',
    'biosensors-journal.com',
    'sciencedirect.com',
    'nature.com',
    'pmc.ncbi.nlm.nih.gov',
  ],
  gut_health: [
    'pubmed.ncbi.nlm.nih.gov',
    'pmc.ncbi.nlm.nih.gov',
    'gut.bmj.com',
    'nature.com',
    'frontiersin.org',
  ],
  cell_biology: [
    'pubmed.ncbi.nlm.nih.gov',
    'pmc.ncbi.nlm.nih.gov',
    'protocols.io',
    'bio-protocol.org',
    'nature.com',
  ],
  climate: [
    'arxiv.org',
    'nature.com',
    'sciencedirect.com',
    'biorxiv.org',
    'pmc.ncbi.nlm.nih.gov',
  ],
  other: [
    'pubmed.ncbi.nlm.nih.gov',
    'arxiv.org',
    'nature.com',
    'sciencedirect.com',
    'pmc.ncbi.nlm.nih.gov',
  ],
};

/**
 * Cascading literature QC search.
 * Query 1: Precise search using Agent-0 extracted key_search_terms
 * Query 2: Broader fallback using intervention + outcome
 *
 * Both queries use domain-specific include_domains so the system finds
 * relevant work regardless of whether the user picked the right domain
 * (they can't pick anymore — Agent 0 owns the classification).
 *
 * @param {object} parsedHypothesis - Output from Agent 0
 * @returns {object} { results, creditsUsed, queryCount }
 */
export async function runQCSearch(parsedHypothesis) {
  const {
    intervention,
    outcome,
    assay_method,
    organism_or_substrate,
    key_search_terms,
    domain,
  } = parsedHypothesis || {};

  // Build Query 1 from LLM-extracted key terms (much more precise)
  // If key_search_terms isn't available, fall back to legacy fields.
  const q1Terms =
    Array.isArray(key_search_terms) && key_search_terms.length >= 2
      ? key_search_terms.slice(0, 3).join(' ')
      : [intervention, assay_method, organism_or_substrate].filter(Boolean).join(' ');

  const exactQuery = String(q1Terms || '').slice(0, 200);

  console.log(`[Tavily] Domain: ${domain}`);
  console.log(`[Tavily] Query 1: "${exactQuery.slice(0, 100)}"`);
  console.log(`[Tavily] Credits used this session: ${creditsUsed}/${MAX_CREDITS}`);

  if (creditsUsed >= MAX_CREDITS) {
    console.warn('[Tavily] Credit limit reached — returning empty results');
    return { results: [], creditsUsed, queryCount: 0 };
  }

  const includeDomains = DOMAIN_INCLUDE_DOMAINS[domain] || DOMAIN_INCLUDE_DOMAINS.other;

  // Query 1: Precise search using LLM-extracted key terms
  let allResults = [];
  try {
    const q1 = await client.search(exactQuery, {
      searchDepth: 'basic',
      maxResults: 5,
      includeDomains,
      includeAnswer: false,
    });
    creditsUsed++;
    allResults = q1.results || [];
    console.log(`[Tavily] Query 1 returned ${allResults.length} results (1 credit used)`);
  } catch (e) {
    console.error('[Tavily] Query 1 failed:', e.message);
    // Don't return — try Query 2 as a fallback
  }

  // Query 2: Run if Q1 returned fewer than 2 hits — we always want at
  // least two references on the canvas if any exist.
  if (allResults.length < 2 && creditsUsed < MAX_CREDITS) {
    const broaderQuery = [
      intervention?.split(' ').slice(0, 4).join(' '),
      outcome?.split(' ').slice(0, 3).join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 200);

    console.log(`[Tavily] Query 2 (broader): "${broaderQuery.slice(0, 80)}"`);

    try {
      const q2 = await client.search(broaderQuery, {
        searchDepth: 'basic',
        maxResults: 3,
        includeDomains: [
          'protocols.io',
          'bio-protocol.org',
          'nature.com/nprot',
          'pubmed.ncbi.nlm.nih.gov',
          'biorxiv.org',
        ],
        includeAnswer: false,
      });
      creditsUsed++;
      const existingUrls = new Set(allResults.map((r) => r.url));
      const newResults = (q2.results || []).filter((r) => !existingUrls.has(r.url));
      allResults = [...allResults, ...newResults];
      console.log(`[Tavily] Query 2 returned ${newResults.length} new results (1 credit used)`);
    } catch (e) {
      console.error('[Tavily] Query 2 failed:', e.message);
    }
  }

  return { results: allResults, creditsUsed, queryCount: 2 };
}

export function getCreditsUsed() {
  return creditsUsed;
}
export function resetCredits() {
  creditsUsed = 0;
}
