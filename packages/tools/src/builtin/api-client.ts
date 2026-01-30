/**
 * APIClientTool
 *
 * HTTP client for making API requests.
 * Beyond Claude Code - provides structured request/response handling.
 */

import { BaseTool } from '../base.js';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types.js';

/**
 * APIClientTool - HTTP requests for APIs
 */
export class APIClientTool extends BaseTool {
  readonly name = 'APIClient';
  readonly description = `Make HTTP requests to APIs and web services.

Supported methods: GET, POST, PUT, DELETE, PATCH

Features:
- JSON request/response handling
- Custom headers
- Timeout control
- Structured response with status, headers, and body

Use cases:
- Testing API endpoints
- Fetching data from services
- Sending webhooks`;

  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        description: 'HTTP method',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      },
      url: {
        type: 'string',
        description: 'The URL to request',
      },
      headers: {
        type: 'object',
        description: 'Request headers (e.g., {"Authorization": "Bearer token"})',
        additionalProperties: true,
      },
      body: {
        type: 'object',
        description: 'Request body (will be JSON-serialized for POST/PUT/PATCH)',
        additionalProperties: true,
      },
      timeout: {
        type: 'number',
        description: 'Request timeout in milliseconds (default: 30000)',
        default: 30000,
        minimum: 1000,
        maximum: 300000,
      },
    },
    required: ['method', 'url'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      const method = params.method as string;
      let url = params.url as string;
      const headers = (params.headers as Record<string, string>) || {};
      const body = params.body as Record<string, unknown> | undefined;
      const timeout = (params.timeout as number) || 30000;

      // Validate URL
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      try {
        new URL(url);
      } catch {
        return this.failure(`Invalid URL: ${url}`);
      }

      // Prepare request options
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'User-Agent': 'OpenAgent/1.0 (API Client Tool)',
          'Accept': 'application/json, text/plain, */*',
          ...headers,
        },
        signal: context.signal,
      };

      // Add body for methods that support it
      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        fetchOptions.body = JSON.stringify(body);
        fetchOptions.headers = {
          ...fetchOptions.headers,
          'Content-Type': 'application/json',
        };
      }

      // Create abort controller for timeout
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

      // Combine signals
      if (context.signal) {
        context.signal.addEventListener('abort', () => timeoutController.abort());
      }
      fetchOptions.signal = timeoutController.signal;

      try {
        const startTime = Date.now();
        const response = await fetch(url, fetchOptions);
        const duration = Date.now() - startTime;

        clearTimeout(timeoutId);

        // Get response headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        // Parse response body based on content type
        const contentType = response.headers.get('content-type') || '';
        let responseBody: unknown;
        let bodyText: string;

        try {
          if (contentType.includes('application/json')) {
            responseBody = await response.json();
            bodyText = JSON.stringify(responseBody, null, 2);
          } else if (contentType.includes('text/')) {
            bodyText = await response.text();
            responseBody = bodyText;
          } else {
            // Try to parse as text
            bodyText = await response.text();
            // Try JSON parsing
            try {
              responseBody = JSON.parse(bodyText);
              bodyText = JSON.stringify(responseBody, null, 2);
            } catch {
              responseBody = bodyText;
            }
          }
        } catch {
          bodyText = '[Unable to read response body]';
          responseBody = null;
        }

        // Truncate very long responses
        const maxBodyLength = 10000;
        const truncated = bodyText.length > maxBodyLength;
        if (truncated) {
          bodyText = bodyText.substring(0, maxBodyLength) + '\n...[truncated]';
        }

        // Format output
        const statusIcon = response.ok ? '✅' : '❌';
        let output = `${statusIcon} ${method} ${url}\n\n`;
        output += `**Status**: ${response.status} ${response.statusText}\n`;
        output += `**Duration**: ${duration}ms\n`;
        output += `**Content-Type**: ${contentType || 'unknown'}\n\n`;

        output += `**Response Headers**:\n`;
        for (const [key, value] of Object.entries(responseHeaders)) {
          if (!['content-length', 'date', 'connection'].includes(key.toLowerCase())) {
            output += `  ${key}: ${value}\n`;
          }
        }

        output += `\n**Response Body**:\n\`\`\`json\n${bodyText}\n\`\`\``;

        return this.success(output, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          duration,
          contentType,
          headers: responseHeaders,
          body: responseBody,
          truncated,
        });
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            if (context.signal?.aborted) {
              return this.failure('Request was cancelled');
            }
            return this.failure(`Request timed out after ${timeout}ms`);
          }
          return this.failure(`Request failed: ${error.message}`);
        }

        return this.failure(`Request failed: ${error}`);
      }
    });
  }
}
