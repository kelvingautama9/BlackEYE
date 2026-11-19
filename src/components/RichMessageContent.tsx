import React, { useState, useEffect, useRef } from 'react';
import katex from 'katex';
import { Copy, Check, BarChart2, Code2, ChevronRight, Terminal } from 'lucide-react';
import { CodeArtifact } from '../types/ai';

declare global {
  interface Window {
    mermaid?: {
      initialize: (config: Record<string, unknown>) => void;
      run: (config: { nodes: HTMLElement[] }) => Promise<void>;
    };
  }
}

interface RichMessageContentProps {
  content: string;
  reasoning?: string;
  isStreaming?: boolean;
  useMarkdown?: boolean;
  onOpenArtifact?: (artifact: CodeArtifact) => void;
}

interface ChartDataPoint {
  label: string;
  value: number;
}

interface ChartSpec {
  type?: 'bar' | 'line';
  title?: string;
  unit?: string;
  data: ChartDataPoint[];
}

export function extractCodeArtifact(content: string): CodeArtifact | null {
  const regex = /```(html|svg|tsx|jsx|json)\s*\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null = null;
  let lastArtifact: CodeArtifact | null = null;

  while ((match = regex.exec(content)) !== null) {
    const lang = match[1].toLowerCase();
    const code = match[2].trim();
    if (code.length >= 40) {
      lastArtifact = {
        title: `Live Artifact (${lang.toUpperCase()})`,
        language: lang,
        code,
      };
    }
  }
  return lastArtifact;
}

function MermaidDiagram({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgError, setSvgError] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !window.mermaid) return;
    setSvgError(false);
    try {
      window.mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
      containerRef.current.removeAttribute('data-processed');
      containerRef.current.textContent = code;
      window.mermaid.run({ nodes: [containerRef.current] }).catch(() => {
        setSvgError(true);
      });
    } catch {
      setSvgError(true);
    }
  }, [code]);

  if (svgError) {
    return (
      <pre className="p-3 text-xs font-mono bg-[var(--bg-code)] border border-[var(--border-subtle)] rounded-md overflow-x-auto">
        {code}
      </pre>
    );
  }

  return (
    <div className="my-3 p-4 bg-white text-neutral-900 border border-[var(--border-subtle)] rounded-lg overflow-x-auto flex justify-center">
      <div ref={containerRef} className="mermaid text-xs" />
    </div>
  );
}

function InteractiveChartBlock({ spec }: { spec: ChartSpec }) {
  const [chartType, setChartType] = useState<'bar' | 'line'>(spec.type || 'bar');
  const data = Array.isArray(spec.data) ? spec.data : [];
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => Number(d.value) || 0), 1);

  return (
    <div className="my-2.5 sm:my-3.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-code)] p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 mb-2.5 sm:mb-3">
        <div>
          <h4 className="text-[11.5px] sm:text-xs font-semibold text-[var(--text-primary)]">
            {String(spec.title || 'Visualisasi Data').replace(/\*\*/g, '')}
          </h4>
          {spec.unit && (
            <span className="text-[10.5px] sm:text-[11px] text-[var(--text-secondary)]">
              Satuan: {spec.unit}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 bg-[var(--bg-surface)] p-0.5 rounded-[4px] border border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setChartType('bar')}
            className={`px-2 py-0.5 text-[10.5px] sm:text-[11px] font-medium rounded-[3px] btn-tactile ${
              chartType === 'bar'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Bar
          </button>
          <button
            type="button"
            onClick={() => setChartType('line')}
            className={`px-2 py-0.5 text-[10.5px] sm:text-[11px] font-medium rounded-[3px] btn-tactile ${
              chartType === 'line'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Line
          </button>
        </div>
      </div>

      {chartType === 'bar' ? (
        <div className="space-y-2">
          {data.map((item, idx) => {
            const pct = Math.max(4, Math.min(100, Math.round(((Number(item.value) || 0) / maxValue) * 100)));
            const cleanLabel = String(item.label || '').replace(/\*\*/g, '').replace(/`/g, '');
            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-[11px] sm:text-xs">
                  <span className="text-[var(--text-primary)] font-medium truncate max-w-[72%]">
                    {cleanLabel}
                  </span>
                  <span className="font-mono-tabular text-[var(--text-secondary)]">
                    {Number(item.value).toLocaleString('id-ID')} {spec.unit || ''}
                  </span>
                </div>
                <div className="w-full h-1.5 sm:h-2 bg-[var(--bg-muted)] rounded-[3px] overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-[3px] transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="pt-2">
          <svg viewBox="0 0 400 140" className="w-full h-36 overflow-visible">
            {data.length > 1 && (
              <polyline
                fill="none"
                stroke="#C65D3B"
                strokeWidth="2.5"
                points={data
                  .map((d, i) => {
                    const x = (i / (data.length - 1)) * 360 + 20;
                    const y = 115 - ((Number(d.value) || 0) / maxValue) * 95;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
            )}
            {data.map((d, i) => {
              const x = data.length > 1 ? (i / (data.length - 1)) * 360 + 20 : 200;
              const y = 115 - ((Number(d.value) || 0) / maxValue) * 95;
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r="4" fill="#C65D3B" />
                  <text
                    x={x}
                    y={132}
                    textAnchor="middle"
                    className="text-[9px] fill-current text-[var(--text-secondary)]"
                  >
                    {String(d.label).slice(0, 10)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

function CodeBlockCard({
  language,
  code,
  onOpenArtifact,
}: {
  language: string;
  code: string;
  onOpenArtifact?: (artifact: CodeArtifact) => void;
}) {
  const [copied, setCopied] = useState(false);
  const langUpper = (language || 'TEXT').toUpperCase();
  const isArtifactReady =
    ['html', 'svg', 'tsx', 'jsx'].includes(language.toLowerCase()) && code.trim().length >= 40;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="my-3.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-code)] overflow-hidden theme-surface">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-muted)]/60">
        <span className="font-mono text-[11px] font-semibold tracking-wider uppercase text-[var(--accent)]">
          {langUpper}
        </span>
        <div className="flex items-center gap-3">
          {isArtifactReady && onOpenArtifact && (
            <button
              type="button"
              onClick={() =>
                onOpenArtifact({
                  title: `Preview (${langUpper})`,
                  language: language.toLowerCase(),
                  code,
                })
              }
              className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--accent)] hover:underline btn-tactile"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Preview Artifact</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] btn-tactile cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Kode</span>
              </>
            )}
          </button>
        </div>
      </div>
      <pre className="p-2.5 sm:p-4 text-[11.5px] sm:text-[13px] leading-[1.55] sm:leading-[1.6] font-mono text-[var(--text-primary)] overflow-x-auto overflow-y-hidden horizontal-scroll-passthrough">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ResponsiveTableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [showChart, setShowChart] = useState(false);

  // Check if column 1 (or any column > 0) has numeric data for chart visualization
  const numericColIndex = headers.findIndex((_, colIdx) => {
    if (colIdx === 0) return false;
    return rows.some((r) => !isNaN(parseFloat(String(r[colIdx] || '').replace(/[^0-9.-]/g, ''))));
  });

  const handleCopyCsv = () => {
    const csvLines = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    navigator.clipboard.writeText(csvLines);
    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 1800);
  };

  const chartData: ChartDataPoint[] =
    numericColIndex > 0
      ? rows
          .map((r) => ({
            label: String(r[0] || '').replace(/\*\*/g, '').replace(/`/g, '').trim(),
            value: parseFloat(String(r[numericColIndex] || '0').replace(/[^0-9.-]/g, '')) || 0,
          }))
          .filter((d) => d.label)
      : [];

  return (
    <div className="my-2.5 sm:my-3.5">
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="flex items-center justify-between px-2.5 sm:px-3 py-1.5 bg-[var(--bg-muted)]/60 border-b border-[var(--border-subtle)]">
          <span className="text-[10px] sm:text-[11px] font-mono text-[var(--text-secondary)]">
            TABEL DATA ({rows.length} baris)
          </span>
          <div className="flex items-center gap-2 sm:gap-2.5">
            {chartData.length > 1 && (
              <button
                type="button"
                onClick={() => setShowChart((v) => !v)}
                className="flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-[var(--accent)] hover:underline btn-tactile cursor-pointer"
              >
                <BarChart2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>{showChart ? 'Tutup Grafik' : 'Grafik'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyCsv}
              className="flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] btn-tactile cursor-pointer"
            >
              {copiedCsv ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCsv ? 'CSV Tersalin' : 'Salin CSV'}</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-hidden horizontal-scroll-passthrough">
          <table className="w-full border-collapse text-left text-[11.5px] sm:text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-muted)]/40">
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className="px-2.5 py-2 sm:px-3.5 sm:py-2.5 font-semibold text-[var(--text-primary)] whitespace-nowrap"
                  >
                    {renderInlineElements(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-[var(--bg-muted)]/30 transition-colors">
                  {headers.map((_, cIdx) => (
                    <td
                      key={cIdx}
                      className={`px-2.5 py-2 sm:px-3.5 sm:py-2.5 text-[var(--text-primary)] font-mono-tabular align-top leading-relaxed ${
                        cIdx === 0
                          ? 'font-medium min-w-[95px] sm:min-w-[120px]'
                          : 'min-w-[130px] sm:min-w-[160px] whitespace-normal break-words'
                      }`}
                    >
                      {renderInlineElements(row[cIdx] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showChart && chartData.length > 1 && (
        <InteractiveChartBlock
          spec={{
            type: 'bar',
            title: `${headers[numericColIndex]} per ${headers[0]}`,
            data: chartData,
          }}
        />
      )}
    </div>
  );
}

// Inline Markdown & KaTeX parser
function renderInlineElements(text: string): React.ReactNode[] {
  if (!text) return [];

  // Tokenize inline math ($...$ or \(...\)), inline code (`...`), bold (**...**), italic (*...*), links ([...](...))
  const tokenRegex =
    /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+\$|\\\([\s\S]+?\\\)|`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]]+\]\([^)]+\))/g;

  const parts = text.split(tokenRegex);
  return parts.map((part, idx) => {
    if (!part) return null;

    // Display Math inline
    if (
      (part.startsWith('$$') && part.endsWith('$$')) ||
      (part.startsWith('\\[') && part.endsWith('\\]'))
    ) {
      const tex = part.slice(2, -2).trim();
      try {
        const html = katex.renderToString(tex, { displayMode: true, throwOnError: false });
        return <span key={idx} className="block my-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />;
      } catch {
        return <code key={idx}>{part}</code>;
      }
    }

    // Inline Math
    if (
      (part.startsWith('$') && part.endsWith('$') && part.length > 2) ||
      (part.startsWith('\\(') && part.endsWith('\\)'))
    ) {
      const tex = part.startsWith('$') ? part.slice(1, -1).trim() : part.slice(2, -2).trim();
      try {
        const html = katex.renderToString(tex, { displayMode: false, throwOnError: false });
        return <span key={idx} dangerouslySetInnerHTML={{ __html: html }} />;
      } catch {
        return <code key={idx}>{part}</code>;
      }
    }

    // Inline Code Badge (styled like Master Table, Customer DB, Rule Set in the reference screenshot)
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      const codeContent = part.slice(1, -1);
      // Check if it looks like LaTeX inside backticks
      if (/^\\(frac|sqrt|sum|int|alpha|beta|gamma|pi|theta)/.test(codeContent)) {
        try {
          const html = katex.renderToString(codeContent, { displayMode: false, throwOnError: false });
          return <span key={idx} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          // fallback to code badge
        }
      }
      return (
        <code
          key={idx}
          className="inline-block font-mono text-[0.83em] px-1.5 py-0.5 mx-0.5 rounded-[4px] bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-border)] leading-tight"
        >
          {codeContent}
        </code>
      );
    }

    // Bold
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[var(--text-primary)]">
          {renderInlineElements(part.slice(2, -2))}
        </strong>
      );
    }

    // Italic
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic">
          {renderInlineElements(part.slice(1, -1))}
        </em>
      );
    }

    // Markdown Link
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] underline underline-offset-2 hover:opacity-80"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const RichMessageContent: React.FC<RichMessageContentProps> = ({
  content,
  reasoning,
  isStreaming = false,
  useMarkdown = true,
  onOpenArtifact,
}) => {
  if (!useMarkdown) {
    return (
      <div className="whitespace-pre-wrap text-[12.5px] sm:text-[14.5px] leading-[1.6] sm:leading-[1.7] universal-chat-typography">
        {content}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 ml-1 align-text-bottom bg-[var(--accent)] animate-pulse" />
        )}
      </div>
    );
  }

  // Separate <think>...</think> blocks from main content
  let extractedThink = reasoning || '';
  let cleanContent = content || '';

  const thinkOpenIdx = cleanContent.indexOf('<think>');
  if (thinkOpenIdx !== -1) {
    const thinkCloseIdx = cleanContent.indexOf('</think>');
    if (thinkCloseIdx !== -1) {
      extractedThink =
        (extractedThink ? extractedThink + '\n' : '') +
        cleanContent.slice(thinkOpenIdx + 7, thinkCloseIdx).trim();
      cleanContent =
        cleanContent.slice(0, thinkOpenIdx) + cleanContent.slice(thinkCloseIdx + 8);
    } else {
      extractedThink =
        (extractedThink ? extractedThink + '\n' : '') +
        cleanContent.slice(thinkOpenIdx + 7).trim();
      cleanContent = cleanContent.slice(0, thinkOpenIdx);
    }
  }

  // Split content into top-level blocks (fenced code blocks vs normal markdown lines)
  const blocks: React.ReactNode[] = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let blockKey = 0;

  const renderMarkdownTextSegment = (segment: string) => {
    const lines = segment.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      // Horizontal Rule
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        blocks.push(
          <hr key={`hr_${blockKey++}`} className="my-4 border-t border-[var(--border-subtle)]" />
        );
        i++;
        continue;
      }

      // Block Math $$...$$
      if (trimmed.startsWith('$$')) {
        const mathLines: string[] = [];
        if (trimmed.endsWith('$$') && trimmed.length > 4) {
          mathLines.push(trimmed.slice(2, -2));
          i++;
        } else {
          mathLines.push(trimmed.slice(2));
          i++;
          while (i < lines.length && !lines[i].trim().endsWith('$$')) {
            mathLines.push(lines[i]);
            i++;
          }
          if (i < lines.length) {
            mathLines.push(lines[i].trim().slice(0, -2));
            i++;
          }
        }
        const tex = mathLines.join('\n').trim();
        try {
          const html = katex.renderToString(tex, { displayMode: true, throwOnError: false });
          blocks.push(
            <div
              key={`math_${blockKey++}`}
              className="my-3 py-2 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          blocks.push(
            <pre key={`math_err_${blockKey++}`} className="my-2 text-xs font-mono">
              {tex}
            </pre>
          );
        }
        continue;
      }

      // Markdown Table
      if (
        trimmed.startsWith('|') &&
        i + 1 < lines.length &&
        /^\s*\|?[\s-:|]+\|[\s-:|]*$/.test(lines[i + 1])
      ) {
        const parseTableRow = (r: string) =>
          r
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((c) => c.trim());

        const headers = parseTableRow(lines[i]);
        i += 2; // Skip header and separator row
        const tableRows: string[][] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableRows.push(parseTableRow(lines[i]));
          i++;
        }
        blocks.push(
          <ResponsiveTableBlock key={`tbl_${blockKey++}`} headers={headers} rows={tableRows} />
        );
        continue;
      }

      // Headings
      const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2];
        const sizeClass =
          level === 1
            ? 'text-[15px] sm:text-lg font-bold mt-4 sm:mt-5 mb-1.5 sm:mb-2'
            : level === 2
            ? 'text-[14px] sm:text-base font-bold mt-3.5 sm:mt-4 mb-1.5 sm:mb-2'
            : level === 3
            ? 'text-[13px] sm:text-[15px] font-bold mt-3 sm:mt-4 mb-1 sm:mb-1.5'
            : 'text-[12.5px] sm:text-[14.5px] font-bold mt-2.5 sm:mt-3 mb-1';
        blocks.push(
          <div
            key={`h_${blockKey++}`}
            className={`${sizeClass} text-[var(--text-primary)] tracking-tight`}
          >
            {renderInlineElements(text)}
          </div>
        );
        i++;
        continue;
      }

      // Bullet / Unordered Lists (Supports nested items)
      if (/^(\s*)([-*•])\s+(.+)$/.test(line)) {
        const listItems: Array<{ indent: number; text: string }> = [];
        while (i < lines.length && /^(\s*)([-*•])\s+(.+)$/.test(lines[i])) {
          const m = lines[i].match(/^(\s*)([-*•])\s+(.+)$/)!;
          listItems.push({ indent: m[1].length, text: m[3] });
          i++;
        }
        blocks.push(
          <ul key={`ul_${blockKey++}`} className="my-2 sm:my-2.5 space-y-1 sm:space-y-1.5 text-[12.5px] sm:text-[14.5px] leading-[1.6] sm:leading-[1.65]">
            {listItems.map((item, idx) => (
              <li
                key={idx}
                className={`flex items-start gap-2 sm:gap-2.5 ${item.indent >= 2 ? 'ml-4 sm:ml-6' : ''}`}
              >
                <span
                  className={`mt-2 shrink-0 rounded-full ${
                    item.indent >= 2
                      ? 'w-1.5 h-1.5 border border-[var(--text-secondary)]'
                      : 'w-1.5 h-1.5 bg-[var(--accent)]'
                  }`}
                />
                <span className="flex-1 text-[var(--text-primary)]">
                  {renderInlineElements(item.text)}
                </span>
              </li>
            ))}
          </ul>
        );
        continue;
      }

      // Ordered Lists
      if (/^\s*\d+\.\s+(.+)$/.test(line)) {
        const orderedItems: Array<{ num: string; text: string }> = [];
        while (i < lines.length && /^\s*(\d+)\.\s+(.+)$/.test(lines[i])) {
          const m = lines[i].match(/^\s*(\d+)\.\s+(.+)$/)!;
          orderedItems.push({ num: m[1], text: m[2] });
          i++;
        }
        blocks.push(
          <ol key={`ol_${blockKey++}`} className="my-2 sm:my-2.5 space-y-1 sm:space-y-1.5 text-[12.5px] sm:text-[14.5px] leading-[1.6] sm:leading-[1.65]">
            {orderedItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 sm:gap-2.5">
                <span className="font-mono-tabular text-[11px] sm:text-xs font-semibold text-[var(--accent)] mt-0.5 sm:mt-1 shrink-0">
                  {item.num}.
                </span>
                <span className="flex-1 text-[var(--text-primary)]">
                  {renderInlineElements(item.text)}
                </span>
              </li>
            ))}
          </ol>
        );
        continue;
      }

      // Blockquote
      if (trimmed.startsWith('>')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        blocks.push(
          <blockquote
            key={`bq_${blockKey++}`}
            className="my-2 sm:my-2.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-md bg-[var(--bg-muted)]/60 border border-[var(--border-subtle)] text-[12px] sm:text-[13.5px] italic text-[var(--text-secondary)]"
          >
            {renderInlineElements(quoteLines.join(' '))}
          </blockquote>
        );
        continue;
      }

      // Standard Paragraph
      blocks.push(
        <p key={`p_${blockKey++}`} className="my-1.5 sm:my-2 text-[12.5px] sm:text-[14.5px] leading-[1.6] sm:leading-[1.68] text-[var(--text-primary)]">
          {renderInlineElements(line)}
        </p>
      );
      i++;
    }
  };

  while ((match = codeBlockRegex.exec(cleanContent)) !== null) {
    if (match.index > lastIndex) {
      renderMarkdownTextSegment(cleanContent.slice(lastIndex, match.index));
    }

    const lang = (match[1] || 'text').toLowerCase();
    const code = match[2].replace(/\n$/, '');

    if (lang === 'mermaid') {
      blocks.push(<MermaidDiagram key={`mermaid_${blockKey++}`} code={code} />);
    } else if (lang === 'chart' || lang === 'json-chart') {
      try {
        const spec = JSON.parse(code) as ChartSpec;
        blocks.push(<InteractiveChartBlock key={`chart_${blockKey++}`} spec={spec} />);
      } catch {
        blocks.push(
          <CodeBlockCard
            key={`code_${blockKey++}`}
            language={lang}
            code={code}
            onOpenArtifact={onOpenArtifact}
          />
        );
      }
    } else {
      blocks.push(
        <CodeBlockCard
          key={`code_${blockKey++}`}
          language={lang}
          code={code}
          onOpenArtifact={onOpenArtifact}
        />
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < cleanContent.length) {
    renderMarkdownTextSegment(cleanContent.slice(lastIndex));
  }

  return (
    <div className="universal-chat-typography">
      {extractedThink && (
        <details
          open={isStreaming && !cleanContent.trim()}
          className="mb-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)]/50 overflow-hidden group"
        >
          <summary className="px-3.5 py-2 text-xs font-mono font-medium text-[var(--text-secondary)] cursor-pointer select-none flex items-center gap-2 hover:text-[var(--text-primary)] list-none">
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90 text-[var(--accent)]" />
            <Terminal className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>
              {isStreaming && !cleanContent.trim()
                ? 'Proses Penalaran (Chain-of-Thought Live)...'
                : 'Proses Penalaran (Chain-of-Thought)'}
            </span>
          </summary>
          <div className="px-3.5 py-2.5 border-t border-[var(--border-subtle)] text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed bg-[var(--bg-code)]">
            {extractedThink}
          </div>
        </details>
      )}

      {blocks}

      {isStreaming && (
        <span className="inline-block w-1.5 h-4 ml-1 align-text-bottom bg-[var(--accent)] animate-pulse" />
      )}
    </div>
  );
};
