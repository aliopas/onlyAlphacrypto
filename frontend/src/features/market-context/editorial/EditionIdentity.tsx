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
            className={`mb-8 md:mb-10 border-b ${ed.colors.border} ${ed.space.stripY}`}
            aria-label="Edition identity"
        >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
                <EditionBadge>{editionLabel}</EditionBadge>
                {confidenceBand === 'limited' && (
                    <span className={`text-[10px] font-mono uppercase tracking-wider ${confColor}`}>
                        Thin evidence window
                    </span>
                )}
            </div>
            <dl className={`flex flex-wrap gap-x-5 gap-y-1.5 ${ed.type.meta}`}>
                {publishedLabel && (
                    <div className="flex gap-1.5">
                        <dt className="text-[#4a4742]">Published</dt>
                        <dd className="text-[#8a8680]">{publishedLabel}</dd>
                    </div>
                )}
                {showUpdated && updatedLabel && (
                    <div className="flex gap-1.5">
                        <dt className="text-[#4a4742]">Updated</dt>
                        <dd className="text-[#8a8680]">{updatedLabel}</dd>
                    </div>
                )}
                <div className="flex gap-1.5">
                    <dt className="text-[#4a4742]">Sources</dt>
                    <dd className="text-[#8a8680]">
                        {sourceCount === 0
                            ? 'None verified this cycle'
                            : `${sourceCount} verified`}
                    </dd>
                </div>
                <div className="flex gap-1.5">
                    <dt className="text-[#4a4742]">Confidence</dt>
                    <dd className={confColor}>{confidenceLabel}</dd>
                </div>
            </dl>
            {confidenceBand !== 'solid' && (
                <p className={`mt-3 text-[13px] leading-relaxed ${ed.colors.textDim}`}>
                    {confidenceDetail}
                </p>
            )}
        </div>
    );
}
