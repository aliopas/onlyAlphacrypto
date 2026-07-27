import { ed } from './tokens';
import { EditionBadge } from './primitives';
import type { ConfidenceBand } from './content';

interface EditionIdentityProps {
    editionLabel: string;
    publishedLabel: string | null;
    updatedLabel: string | null;
    showUpdated: boolean;
    sourceCount: number;
    confidenceLabel: string;
    confidenceBand: ConfidenceBand;
    confidenceDetail: string;
}

export function EditionIdentity({
    editionLabel,
    publishedLabel,
    updatedLabel,
    showUpdated,
    sourceCount,
    confidenceLabel,
    confidenceBand,
    confidenceDetail,
}: EditionIdentityProps) {
    const confColor =
        confidenceBand === 'limited'
            ? ed.colors.confidenceThin
            : confidenceBand === 'moderate'
              ? ed.colors.accentSoft
              : ed.colors.confidenceOk;

    return (
        <div
            className={`mb-10 md:mb-12 pb-6 border-b ${ed.colors.rule}`}
            aria-label="Edition identity"
            style={{ fontFamily: ed.font.ui }}
        >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4">
                <EditionBadge>{editionLabel}</EditionBadge>
                {confidenceBand === 'limited' && (
                    <span className={`text-[10px] uppercase tracking-[0.16em] ${confColor}`}>
                        Thin evidence
                    </span>
                )}
            </div>
            <p className={`${ed.type.meta} flex flex-wrap gap-x-1 gap-y-1`}>
                {publishedLabel && <span>{publishedLabel}</span>}
                {showUpdated && updatedLabel && (
                    <>
                        <span className="text-[#3a3630]" aria-hidden>
                            ·
                        </span>
                        <span>Updated {updatedLabel}</span>
                    </>
                )}
                <span className="text-[#3a3630]" aria-hidden>
                    ·
                </span>
                <span>
                    {sourceCount === 0
                        ? 'No verified sources this cycle'
                        : `${sourceCount} verified source${sourceCount === 1 ? '' : 's'}`}
                </span>
                <span className="text-[#3a3630]" aria-hidden>
                    ·
                </span>
                <span className={confColor}>{confidenceLabel}</span>
            </p>
            {confidenceBand !== 'solid' && (
                <p
                    className={`mt-3 text-[13px] leading-relaxed ${ed.colors.textDim}`}
                    style={{ fontFamily: ed.font.body }}
                >
                    {confidenceDetail}
                </p>
            )}
        </div>
    );
}
