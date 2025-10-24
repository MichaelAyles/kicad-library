"use client";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown content with GitHub Flavored Markdown support
 * Sanitizes HTML to prevent XSS attacks
 */
export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
        // Custom styling for markdown elements
        a: ({ node, ...props }) => (
          <a
            {...props}
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          />
        ),
        code: ({ node, ...props }: any) => {
          const isInline = !String(props.className).includes('language-');
          return isInline ? (
            <code
              {...props}
              className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono"
            />
          ) : (
            <code
              {...props}
              className="block p-3 bg-muted rounded-md text-sm font-mono overflow-x-auto"
            />
          );
        },
        pre: ({ node, ...props }) => (
          <pre {...props} className="bg-muted p-3 rounded-md overflow-x-auto my-2" />
        ),
        blockquote: ({ node, ...props }) => (
          <blockquote
            {...props}
            className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground my-2"
          />
        ),
        ul: ({ node, ...props }) => (
          <ul {...props} className="list-disc list-inside my-2 space-y-1" />
        ),
        ol: ({ node, ...props }) => (
          <ol {...props} className="list-decimal list-inside my-2 space-y-1" />
        ),
        h1: ({ node, ...props }) => (
          <h1 {...props} className="text-xl font-bold mt-4 mb-2" />
        ),
        h2: ({ node, ...props }) => (
          <h2 {...props} className="text-lg font-bold mt-3 mb-2" />
        ),
        h3: ({ node, ...props }) => (
          <h3 {...props} className="text-base font-bold mt-2 mb-1" />
        ),
        hr: ({ node, ...props }) => (
          <hr {...props} className="my-4 border-border" />
        ),
        table: ({ node, ...props }) => (
          <div className="overflow-x-auto my-2">
            <table {...props} className="min-w-full border-collapse border border-border" />
          </div>
        ),
        th: ({ node, ...props }) => (
          <th {...props} className="border border-border px-3 py-2 bg-muted font-semibold text-left" />
        ),
        td: ({ node, ...props }) => (
          <td {...props} className="border border-border px-3 py-2" />
        ),
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
