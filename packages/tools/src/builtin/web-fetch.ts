/**
 * WebFetch Tool
 *
 * Fetches content from a URL and converts HTML to Markdown.
 * Includes a 15-minute cache for repeated fetches.
 */

import { BaseTool } from '../base.js';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types.js';
import TurndownService from 'turndown';

// Cache TTL in milliseconds (15 minutes)
const CACHE_TTL = 15 * 60 * 1000;

// Simple in-memory cache
interface CacheEntry {
  content: string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Clean expired cache entries
 */
function cleanCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}

/**
 * Get from cache if not expired
 */
function getFromCache(url: string): string | null {
  const entry = cache.get(url);
  if (entry && Date.now() - entry.timestamp <= CACHE_TTL) {
    return entry.content;
  }
  return null;
}

/**
 * Add to cache
 */
function addToCache(url: string, content: string): void {
  // Clean old entries periodically
  if (cache.size > 100) {
    cleanCache();
  }
  cache.set(url, { content, timestamp: Date.now() });
}

/**
 * Initialize Turndown service for HTML to Markdown conversion
 */
function createTurndown(): TurndownService {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });

  // Remove script and style tags
  turndown.remove(['script', 'style', 'noscript', 'iframe']);

  return turndown;
}

/**
 * Extract main content from HTML (simple heuristic)
 */
function extractMainContent(html: string): string {
  // Try to find main content areas
  const mainPatterns = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of mainPatterns) {
    const match = html.match(pattern);
    if (match && match[1] && match[1].length > 500) {
      return match[1];
    }
  }

  // Fall back to body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return bodyMatch[1];
  }

  return html;
}

/**
 * Clean up the markdown output
 */
function cleanMarkdown(markdown: string): string {
  return markdown
    // Remove excessive newlines
    .replace(/\n{4,}/g, '\n\n\n')
    // Remove leading/trailing whitespace from lines
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Trim overall
    .trim();
}

/**
 * WebFetchTool - Fetch URLs and convert to markdown
 */
export class WebFetchTool extends BaseTool {
  readonly name = 'WebFetch';
  readonly description = `Fetches content from a URL and converts HTML to Markdown.

Features:
- Converts HTML to readable Markdown
- 15-minute cache for repeated fetches
- Handles redirects
- Extracts main content when possible

Usage:
- Provide a URL and a prompt describing what to extract
- The content will be converted to Markdown for analysis`;

  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch content from (must be a valid HTTP/HTTPS URL)',
      },
      prompt: {
        type: 'string',
        description: 'What information to extract or look for in the page',
      },
    },
    required: ['url', 'prompt'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      let url = params.url as string;
      const prompt = params.prompt as string;

      // Normalize URL
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      // Validate URL
      try {
        new URL(url);
      } catch {
        return this.failure(`Invalid URL: ${url}`);
      }

      // Check cache first
      const cached = getFromCache(url);
      if (cached) {
        return this.success(
          `[Cached content from: ${url}]\n\nPrompt: ${prompt}\n\n---\n\n${cached}`,
          { cached: true, url }
        );
      }

      // Fetch the URL
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'OpenAgent/1.0 (Web Fetch Tool)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          redirect: 'follow',
          signal: context.signal,
        });

        if (!response.ok) {
          return this.failure(
            `Failed to fetch URL: ${response.status} ${response.statusText}`
          );
        }

        // Check content type
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          // Return JSON as-is
          const json = await response.json();
          const content = JSON.stringify(json, null, 2);
          addToCache(url, content);
          return this.success(
            `[JSON content from: ${url}]\n\nPrompt: ${prompt}\n\n---\n\n\`\`\`json\n${content}\n\`\`\``,
            { contentType: 'json', url }
          );
        }

        if (contentType.includes('text/plain')) {
          // Return plain text as-is
          const content = await response.text();
          addToCache(url, content);
          return this.success(
            `[Text content from: ${url}]\n\nPrompt: ${prompt}\n\n---\n\n${content}`,
            { contentType: 'text', url }
          );
        }

        // Assume HTML
        const html = await response.text();

        // Extract main content
        const mainContent = extractMainContent(html);

        // Convert to Markdown
        const turndown = createTurndown();
        let markdown = turndown.turndown(mainContent);
        markdown = cleanMarkdown(markdown);

        // Truncate if too long (keep under ~50KB)
        const maxLength = 50000;
        if (markdown.length > maxLength) {
          markdown = markdown.substring(0, maxLength) + '\n\n[Content truncated...]';
        }

        // Cache the result
        addToCache(url, markdown);

        // Handle redirects
        const finalUrl = response.url;
        const redirectNote = finalUrl !== url
          ? `\n[Redirected from: ${url}]\n`
          : '';

        return this.success(
          `[Content from: ${finalUrl}]${redirectNote}\n\nPrompt: ${prompt}\n\n---\n\n${markdown}`,
          {
            url: finalUrl,
            originalUrl: url,
            redirected: finalUrl !== url,
            contentLength: markdown.length,
          }
        );
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return this.failure('Request was cancelled');
        }

        return this.failure(`Failed to fetch URL: ${error}`);
      }
    });
  }
}
