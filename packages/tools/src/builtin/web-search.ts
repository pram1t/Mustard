/**
 * WebSearch Tool
 *
 * Searches the web using multiple providers:
 * - DuckDuckGo (default, free, unlimited)
 * - Brave Search (free tier: 2000/month, better quality)
 * - SearXNG (self-hosted, unlimited, most comprehensive)
 *
 * Triple hybrid approach with automatic fallback chain.
 */

import { BaseTool } from '../base.js';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types.js';
import { search, SafeSearchType } from 'duck-duck-scrape';

// Rate limiting
const lastSearchTime = new Map<string, number>();
const RATE_LIMIT_MS = 1000; // 1 second between searches

/**
 * Check rate limit
 */
function checkRateLimit(sessionId: string): boolean {
  const lastTime = lastSearchTime.get(sessionId);
  const now = Date.now();

  if (lastTime && now - lastTime < RATE_LIMIT_MS) {
    return false;
  }

  lastSearchTime.set(sessionId, now);
  return true;
}

/**
 * Search result interface
 */
interface SearchResult {
  title: string;
  url: string;
  description: string;
}

/**
 * Filter results by domain
 */
function filterByDomain(
  results: SearchResult[],
  allowedDomains?: string[],
  blockedDomains?: string[]
): SearchResult[] {
  return results.filter(result => {
    try {
      const url = new URL(result.url);
      const domain = url.hostname.replace(/^www\./, '');

      // Check blocked domains
      if (blockedDomains && blockedDomains.length > 0) {
        for (const blocked of blockedDomains) {
          if (domain.includes(blocked.replace(/^www\./, ''))) {
            return false;
          }
        }
      }

      // Check allowed domains
      if (allowedDomains && allowedDomains.length > 0) {
        for (const allowed of allowedDomains) {
          if (domain.includes(allowed.replace(/^www\./, ''))) {
            return true;
          }
        }
        return false; // Not in allowed list
      }

      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Search using DuckDuckGo (free, unlimited, no API key)
 */
async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  try {
    const results = await search(query, {
      safeSearch: SafeSearchType.MODERATE,
    });

    if (!results.results || results.results.length === 0) {
      return [];
    }

    return results.results.map(result => ({
      title: result.title || 'No title',
      url: result.url || '',
      description: result.description || '',
    }));
  } catch (error) {
    throw new Error(`DuckDuckGo search failed: ${error}`);
  }
}

/**
 * Search using Brave Search API (free tier: 2000 searches/month)
 *
 * To use Brave:
 * 1. Get API key from https://brave.com/search/api/
 * 2. Set BRAVE_SEARCH_API_KEY environment variable
 */
async function searchBrave(
  query: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<SearchResult[]> {
  try {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', '10');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
      },
      signal,
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Brave Search rate limit exceeded (2000/month free tier)');
      }
      throw new Error(`Brave Search returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as {
      web?: {
        results?: Array<{
          title?: string;
          url?: string;
          description?: string;
        }>;
      };
    };

    if (!data.web?.results || data.web.results.length === 0) {
      return [];
    }

    return data.web.results.map(result => ({
      title: result.title || 'No title',
      url: result.url || '',
      description: result.description || '',
    }));
  } catch (error) {
    throw new Error(`Brave Search failed: ${error}`);
  }
}

/**
 * Search using SearXNG (self-hosted, unlimited, aggregates 70+ engines)
 *
 * To use SearXNG:
 * 1. Self-host SearXNG or use a public instance
 * 2. Enable JSON format in settings.yml: search.formats: [html, json]
 * 3. Set SEARXNG_URL environment variable to your instance URL
 */
async function searchSearXNG(
  query: string,
  instanceUrl: string,
  signal?: AbortSignal
): Promise<SearchResult[]> {
  try {
    const url = new URL('/search', instanceUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('categories', 'general');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OpenAgent/1.0 (Web Search Tool)',
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`SearXNG returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
      }>;
    };

    if (!data.results || data.results.length === 0) {
      return [];
    }

    return data.results.map(result => ({
      title: result.title || 'No title',
      url: result.url || '',
      description: result.content || '',
    }));
  } catch (error) {
    throw new Error(`SearXNG search failed: ${error}`);
  }
}

/**
 * WebSearchTool - Search the web for information
 *
 * Triple hybrid approach with 3 providers:
 * - DuckDuckGo: Default, free, unlimited, no setup
 * - Brave: Better quality, free tier 2000/month, needs API key
 * - SearXNG: Best results (70+ engines), self-hosted, unlimited
 */
export class WebSearchTool extends BaseTool {
  readonly name = 'WebSearch';
  readonly description = `Search the web for information.

Providers (in order of recommendation):
- **duckduckgo** (default): Free, unlimited, no API key, works out of the box
- **brave**: Better quality results, free tier (2000/month), set BRAVE_SEARCH_API_KEY
- **searxng**: Most comprehensive (70+ engines), self-hosted, set SEARXNG_URL

Fallback chain: If selected provider fails, automatically tries others.

Features:
- Domain filtering (allow/block specific sites)
- Automatic fallback between providers
- Returns results with titles, URLs, and descriptions

IMPORTANT: After using this tool, include a "Sources:" section with markdown links.`;

  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
        minLength: 2,
      },
      provider: {
        type: 'string',
        description: 'Search provider: "duckduckgo" (default), "brave" (needs API key), or "searxng" (self-hosted)',
        enum: ['duckduckgo', 'brave', 'searxng'],
        default: 'duckduckgo',
      },
      allowed_domains: {
        type: 'array',
        description: 'Only include results from these domains (e.g., ["github.com", "stackoverflow.com"])',
        items: { type: 'string' },
      },
      blocked_domains: {
        type: 'array',
        description: 'Exclude results from these domains',
        items: { type: 'string' },
      },
    },
    required: ['query'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      const query = params.query as string;
      const provider = (params.provider as string) || 'duckduckgo';
      const allowedDomains = params.allowed_domains as string[] | undefined;
      const blockedDomains = params.blocked_domains as string[] | undefined;

      // Check rate limit
      if (!checkRateLimit(context.sessionId)) {
        return this.failure('Rate limited. Please wait a moment before searching again.');
      }

      // Get API keys from environment
      const braveApiKey = context.config.env?.BRAVE_SEARCH_API_KEY || process.env.BRAVE_SEARCH_API_KEY;
      const searxngUrl = context.config.env?.SEARXNG_URL || process.env.SEARXNG_URL;

      // Perform search with fallback chain
      let results: SearchResult[];
      let usedProvider = provider;
      const errors: string[] = [];

      // Try requested provider first
      try {
        results = await this.searchWithProvider(
          query,
          provider,
          braveApiKey,
          searxngUrl,
          context.signal
        );
      } catch (error) {
        errors.push(`${provider}: ${error}`);

        // Fallback chain: try other providers
        const fallbackOrder = ['duckduckgo', 'brave', 'searxng'].filter(p => p !== provider);

        for (const fallbackProvider of fallbackOrder) {
          try {
            results = await this.searchWithProvider(
              query,
              fallbackProvider,
              braveApiKey,
              searxngUrl,
              context.signal
            );
            usedProvider = `${fallbackProvider} (fallback)`;
            break;
          } catch (fbError) {
            errors.push(`${fallbackProvider}: ${fbError}`);
          }
        }

        // If all providers failed
        if (!results!) {
          return this.failure(`All search providers failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
        }
      }

      if (results.length === 0) {
        return this.success(
          `No results found for: "${query}"`,
          { query, resultCount: 0, provider: usedProvider }
        );
      }

      // Apply domain filtering
      results = filterByDomain(results, allowedDomains, blockedDomains);

      if (results.length === 0) {
        return this.success(
          `No results found matching domain filters for: "${query}"`,
          { query, resultCount: 0, filtered: true, provider: usedProvider }
        );
      }

      // Limit results
      const maxResults = 10;
      results = results.slice(0, maxResults);

      // Format output
      let output = `Search results for: "${query}" (via ${usedProvider})\n\n`;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        output += `${i + 1}. **${result.title}**\n`;
        output += `   URL: ${result.url}\n`;
        if (result.description) {
          output += `   ${result.description}\n`;
        }
        output += '\n';
      }

      output += '---\n';
      output += 'Sources:\n';
      for (const result of results) {
        output += `- [${result.title}](${result.url})\n`;
      }

      return this.success(output, {
        query,
        resultCount: results.length,
        provider: usedProvider,
      });
    });
  }

  /**
   * Search with a specific provider
   */
  private async searchWithProvider(
    query: string,
    provider: string,
    braveApiKey: string | undefined,
    searxngUrl: string | undefined,
    signal?: AbortSignal
  ): Promise<SearchResult[]> {
    switch (provider) {
      case 'brave':
        if (!braveApiKey) {
          throw new Error('BRAVE_SEARCH_API_KEY not set');
        }
        return searchBrave(query, braveApiKey, signal);

      case 'searxng':
        if (!searxngUrl) {
          throw new Error('SEARXNG_URL not set');
        }
        return searchSearXNG(query, searxngUrl, signal);

      case 'duckduckgo':
      default:
        return searchDuckDuckGo(query);
    }
  }
}
