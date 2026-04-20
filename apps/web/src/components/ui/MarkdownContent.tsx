import { marked } from "marked";
import { useMemo } from "react";

marked.setOptions({
  breaks: true,
  gfm: true,
});

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Lightweight sanitization: strip script tags, event handlers, and javascript: URLs.
// For a local operator UI this blocks the most common XSS vectors without adding
// a heavy dependency.
const sanitizeHtml = (html: string): string => {
  const dangerousTagRe =
    /<(script|style|iframe|object|embed|form|input|textarea|button|select)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi;
  const dangerousSelfClosingTagRe =
    /<(iframe|object|embed|input|textarea|button|select)\b[^>]*\/?>/gi;

  return html
    .replace(dangerousTagRe, "")
    .replace(dangerousSelfClosingTagRe, "")
    .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/data:\s*text\/html/gi, "");
};

const highlightHtml = (html: string, term: string): string => {
  const escaped = escapeRegExp(term);
  const regex = new RegExp(`(${escaped})`, "gi");

  // Only highlight text nodes — skip anything inside HTML tags
  // Split on tags, highlight only the non-tag segments
  const parts = html.split(/(<[^>]*>)/);
  return parts
    .map((part) => {
      if (part.startsWith("<")) return part;
      return part.replace(regex, '<mark class="search-highlight">$1</mark>');
    })
    .join("");
};

type MarkdownContentProps = {
  content: string;
  className?: string;
  highlightTerm?: string;
};

export const MarkdownContent = ({ content, className, highlightTerm }: MarkdownContentProps) => {
  const html = useMemo(() => {
    const rendered = marked.parse(content, { async: false }) as string;
    const sanitized = sanitizeHtml(rendered);
    if (highlightTerm && highlightTerm.length > 0) {
      return highlightHtml(sanitized, highlightTerm);
    }
    return sanitized;
  }, [content, highlightTerm]);

  // biome-ignore lint/security/noDangerouslySetInnerHtml: content is sanitized above.
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};
