import { TavilyClient } from 'tavily';
import dotenv from 'dotenv';
dotenv.config();

// `tavily` package reads TAVILY_API_KEY from env by default,
// but we pass it explicitly for clarity.
const client = new TavilyClient({ apiKey: process.env.TAVILY_API_KEY });

// Session-level credit tracker (resets on process restart)
let creditsUsed = 0;
const MAX_CREDITS = parseInt(process.env.TAVILY_MAX_CREDITS_PER_RUN || '4');

/**
 * Cascading literature QC search.
 * Query 1: Exact match on PubMed/arXiv (1 credit)
 * Query 2: Similar work on protocols.io (1 credit, only if Q1 empty)
 *
 * @param {object} parsedHypothesis - Output from Agent 0
 * @returns {object} { results, creditsUsed, queryCount }
 */
export async function runQCSearch(parsedHypothesis) {
  const { intervention, outcome, assay_method, organism_or_substrate } = parsedHypothesis;

  // Build targeted query from parsed components
  const exactQuery = [intervention, outcome, assay_method, organism_or_substrate]
    .filter(Boolean)
    .join(' ')
    .slice(0, 200); // Tavily query length limit

  console.log(`[Tavily] Query 1: "${exactQuery.slice(0, 80)}..."`);
  console.log(`[Tavily] Credits used this session: ${creditsUsed}/${MAX_CREDITS}`);

  if (creditsUsed >= MAX_CREDITS) {
    console.warn('[Tavily] Credit limit reached — returning empty results');
    return { results: [], creditsUsed, queryCount: 0 };
  }

  // Query 1: Exact/specific search
  let allResults = [];
  try {
    const q1 = await client.search(exactQuery, {
      searchDepth: 'basic',
      maxResults: 3,
      includeDomains: [
        'pubmed.ncbi.nlm.nih.gov',
        'arxiv.org',
        'biorxiv.org',
        'pmc.ncbi.nlm.nih.gov',
      ],
      includeAnswer: false,
    });
    creditsUsed++;
    allResults = q1.results || [];
    console.log(`[Tavily] Query 1 returned ${allResults.length} results (credit used: 1)`);
  } catch (e) {
    console.error('[Tavily] Query 1 failed:', e.message);
    return { results: [], creditsUsed, queryCount: 1 };
  }

  // Query 2: Only run if Q1 found nothing
  if (allResults.length === 0 && creditsUsed < MAX_CREDITS) {
    const broaderQuery = [assay_method || intervention, 'protocol method study']
      .filter(Boolean)
      .join(' ')
      .slice(0, 200);

    console.log(`[Tavily] Query 2 (broader): "${broaderQuery.slice(0, 80)}..."`);

    try {
      const q2 = await client.search(broaderQuery, {
        searchDepth: 'basic',
        maxResults: 3,
        includeDomains: ['protocols.io', 'bio-protocol.org', 'nature.com', 'jove.com'],
        includeAnswer: false,
      });
      creditsUsed++;
      allResults = q2.results || [];
      console.log(`[Tavily] Query 2 returned ${allResults.length} results (credit used: 1)`);
    } catch (e) {
      console.error('[Tavily] Query 2 failed:', e.message);
    }
  }

  return { results: allResults, creditsUsed, queryCount: allResults.length > 0 ? 2 : 1 };
}

export function getCreditsUsed() {
  return creditsUsed;
}
export function resetCredits() {
  creditsUsed = 0;
}

