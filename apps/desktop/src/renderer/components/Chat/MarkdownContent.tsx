import { useMemo } from 'react';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { CodeBlock } from './CodeBlock';

interface MarkdownContentProps {
  content: string;
}

function extractTextContent(children: unknown): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(extractTextContent).join('');
  if (children && typeof children === 'object' && 'props' in (children as any)) {
    return extractTextContent((children as any).props.children);
  }
  return String(children ?? '');
}

export function MarkdownContent({ content }: MarkdownContentProps): ReactNode {
  const components = useMemo(
    () => ({
      code({ className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || '');
        if (match) {
          const code = extractTextContent(children).replace(/\n$/, '');
          return <CodeBlock language={match[1]} code={code} />;
        }
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },

      a({ children, href, ...props }: any) {
        const isExternal = href?.startsWith('http');
        return (
          <a
            href={href}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            onClick={
              isExternal
                ? (e: React.MouseEvent) => {
                    e.preventDefault();
                  }
                : undefined
            }
            {...props}
          >
            {children}
          </a>
        );
      },

      img({ src, alt, ...props }: any) {
        if (!src?.startsWith('data:image/')) {
          return (
            <span className="image-blocked">[Image blocked for security]</span>
          );
        }
        return <img src={src} alt={alt} {...props} />;
      },
    }),
    [],
  );

  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
