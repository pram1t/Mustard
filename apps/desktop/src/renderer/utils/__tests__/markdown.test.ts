// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sanitizeHtml, formatTimestamp, formatToolResult } from '../markdown';

describe('sanitizeHtml', () => {
  it('removes script tags', () => {
    const result = sanitizeHtml('<script>alert("xss")</script>');
    expect(result).not.toContain('script');
    expect(result).not.toContain('alert');
  });

  it('removes onerror handlers', () => {
    const result = sanitizeHtml('<img src="x" onerror="alert(\'xss\')">');
    expect(result).not.toContain('onerror');
  });

  it('removes javascript: URLs from links', () => {
    const result = sanitizeHtml('<a href="javascript:alert(\'xss\')">click</a>');
    expect(result).not.toContain('javascript:');
  });

  it('removes iframe tags', () => {
    const result = sanitizeHtml('<iframe src="evil.com"></iframe>');
    expect(result).not.toContain('iframe');
  });

  it('removes form tags', () => {
    const result = sanitizeHtml('<form action="evil.com"><input type="text"></form>');
    expect(result).not.toContain('form');
    expect(result).not.toContain('input');
  });

  it('removes style tags', () => {
    const result = sanitizeHtml('<style>body { display: none; }</style>');
    expect(result).not.toContain('style');
  });

  it('removes object and embed tags', () => {
    const result = sanitizeHtml('<object data="evil.swf"></object><embed src="evil.swf">');
    expect(result).not.toContain('object');
    expect(result).not.toContain('embed');
  });

  it('allows safe HTML tags', () => {
    const result = sanitizeHtml('<p>Hello <strong>world</strong></p>');
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
  });

  it('allows data: image URIs', () => {
    const result = sanitizeHtml('<img src="data:image/png;base64,abc" alt="test">');
    expect(result).toContain('data:image/png');
    expect(result).toContain('alt="test"');
  });

  it('forces target and rel on links', () => {
    const result = sanitizeHtml('<a href="https://example.com">link</a>');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('allows table elements', () => {
    const result = sanitizeHtml('<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>');
    expect(result).toContain('<table>');
    expect(result).toContain('<th>');
    expect(result).toContain('<td>');
  });

  it('allows code and pre elements', () => {
    const result = sanitizeHtml('<pre><code class="language-js">const x = 1;</code></pre>');
    expect(result).toContain('<pre>');
    expect(result).toContain('<code');
    expect(result).toContain('class="language-js"');
  });

  it('blocks data attributes', () => {
    const result = sanitizeHtml('<div data-payload="evil">content</div>');
    expect(result).not.toContain('data-payload');
  });
});

describe('formatTimestamp', () => {
  it('formats timestamp to HH:MM pattern', () => {
    const ts = new Date(2024, 0, 1, 14, 30, 0).getTime();
    const result = formatTimestamp(ts);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it('returns a string', () => {
    expect(typeof formatTimestamp(Date.now())).toBe('string');
  });
});

describe('formatToolResult', () => {
  it('returns short strings as-is', () => {
    expect(formatToolResult('hello world')).toBe('hello world');
  });

  it('truncates strings over 1000 characters', () => {
    const long = 'x'.repeat(1500);
    const result = formatToolResult(long);
    expect(result.length).toBeLessThan(1100);
    expect(result).toContain('(truncated)');
  });

  it('returns exactly 1000 char strings without truncation', () => {
    const exact = 'y'.repeat(1000);
    expect(formatToolResult(exact)).toBe(exact);
  });

  it('JSON-stringifies objects', () => {
    const result = formatToolResult({ key: 'value', nested: { a: 1 } });
    expect(result).toContain('"key"');
    expect(result).toContain('"value"');
    expect(result).toContain('"nested"');
  });

  it('JSON-stringifies arrays', () => {
    const result = formatToolResult([1, 2, 3]);
    expect(result).toContain('[');
    expect(result).toContain('1');
  });

  it('JSON-stringifies numbers', () => {
    expect(formatToolResult(42)).toBe('42');
  });

  it('handles null', () => {
    expect(formatToolResult(null)).toBe('null');
  });
});
