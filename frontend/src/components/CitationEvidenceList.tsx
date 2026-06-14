import { ChevronDown, ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { Citation } from '../types';

const DEFAULT_VISIBLE_CITATIONS = 3;

function getLocationLabel(citation: Citation) {
  return citation.locationLabel || citation.position || (
    typeof citation.chunkIndex === 'number' ? `Chunk ${citation.chunkIndex + 1}` : 'Source'
  );
}

function getRelevanceLabel(citation: Citation) {
  if (typeof citation.score !== 'number') {
    return 'Supporting match';
  }

  return citation.score >= 0.85 ? 'Strong match' : 'Supporting match';
}

export function CitationEvidenceList({
  citations,
  onOpenSource,
}: {
  citations: Citation[];
  onOpenSource?: (fileId: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleCitations = showAll ? citations : citations.slice(0, DEFAULT_VISIBLE_CITATIONS);

  if (!citations.length) {
    return null;
  }

  return (
    <div className="mt-2.5 border-t border-border-subtle pt-2">
      <div className="mb-2 flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider text-success font-mono">
        <ShieldCheck className="h-3 w-3" />
        Evidence
      </div>
      <div className="space-y-1.5">
        {visibleCitations.map((citation, index) => (
          <details
            key={`${citation.fileId}-${getLocationLabel(citation)}-${index}`}
            className="group rounded-xl border border-success/20 bg-success-subtle/30"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 marker:hidden">
              <FileText className="h-3.5 w-3.5 shrink-0 text-success" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10px] font-extrabold text-text-primary">
                  {citation.fileName}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[8.5px] font-black uppercase tracking-wider text-text-muted font-mono">
                  <span>{getLocationLabel(citation)}</span>
                  <span className="h-1 w-1 rounded-full bg-border-default" />
                  <span>{getRelevanceLabel(citation)}</span>
                </span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-muted transition group-open:rotate-180" />
            </summary>
            <div className="space-y-2 border-t border-success/15 px-2.5 pb-2.5 pt-2">
              <p className="text-[11px] leading-relaxed text-text-secondary font-serif">
                {citation.excerpt || 'This saved reference was created before evidence excerpts were available.'}
              </p>
              {onOpenSource ? (
                <button
                  type="button"
                  onClick={() => onOpenSource(citation.fileId)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-base/50 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-text-secondary transition hover:border-accent/35 hover:text-accent-hover"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open source
                </button>
              ) : null}
            </div>
          </details>
        ))}
      </div>
      {citations.length > DEFAULT_VISIBLE_CITATIONS ? (
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          className="mt-2 text-[9px] font-black uppercase tracking-wider text-text-muted transition hover:text-accent-hover font-mono"
        >
          {showAll ? 'Show top 3' : `Show all ${citations.length}`}
        </button>
      ) : null}
    </div>
  );
}
