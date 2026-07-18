import type { ReactNode } from 'react';
import { ed } from './tokens';

export function ReadingMeasure({
    children,
    className = '',
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={`${ed.measure} mx-auto w-full ${className}`.trim()}>
            {children}
        </div>
    );
}

export function EditionBadge({ children }: { children: ReactNode }) {
    return <span className={ed.type.editionBadge}>{children}</span>;
}

export function Chapter({
    id,
    label,
    title,
    children,
}: {
    id?: string;
    label?: string;
    title?: string;
    children: ReactNode;
}) {
    return (
        <section
            id={id}
            className={`${ed.space.chapterGap} border-t ${ed.colors.border} pt-10 md:pt-12 first:border-t-0 first:pt-0`}
        >
            {label && <p className={ed.type.chapterLabel}>{label}</p>}
            {title && <h2 className={ed.type.h2}>{title}</h2>}
            <div className={ed.type.body}>{children}</div>
        </section>
    );
}

export function Quote({ children, attribution }: { children: ReactNode; attribution?: string }) {
    return (
        <blockquote
            className={`${ed.space.moduleY} border-l-2 border-[#3a3530] pl-5 md:pl-6`}
        >
            <p className={ed.type.quote}>{children}</p>
            {attribution && (
                <footer className={`mt-3 ${ed.type.meta}`}>— {attribution}</footer>
            )}
        </blockquote>
    );
}

export function KeyTakeaway({ children }: { children: ReactNode }) {
    return (
        <aside
            className={`${ed.space.moduleY} ${ed.colors.surface} border ${ed.colors.borderSoft} rounded-sm px-5 py-4`}
        >
            <p className={`${ed.type.moduleLabel} mb-2`}>Key Takeaway</p>
            <div className={`${ed.type.body} text-[#e0dcd6]`}>{children}</div>
        </aside>
    );
}

export function MarketFact({ children, label = 'Market Fact' }: { children: ReactNode; label?: string }) {
    return (
        <aside
            className={`${ed.space.moduleY} flex gap-4 items-start`}
        >
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#6b6760] shrink-0" aria-hidden />
            <div>
                <p className={`${ed.type.moduleLabel} mb-1`}>{label}</p>
                <div className={ed.type.bodySm}>{children}</div>
            </div>
        </aside>
    );
}

export function TimelineBlock({
    items,
}: {
    items: Array<{ when: string; what: string }>;
}) {
    if (items.length === 0) return null;
    return (
        <div className={`${ed.space.moduleY}`}>
            <p className={`${ed.type.moduleLabel} mb-4`}>Timeline</p>
            <ol className="space-y-4 border-l border-[#2a2a2a] pl-5">
                {items.map((item, i) => (
                    <li key={`${item.when}-${i}`} className="relative">
                        <span
                            className="absolute -left-[1.4rem] top-1.5 w-2 h-2 rounded-full bg-[#4a4742]"
                            aria-hidden
                        />
                        <p className={ed.type.meta}>{item.when}</p>
                        <p className={`${ed.type.bodySm} mt-0.5 text-[#c8c4be]`}>{item.what}</p>
                    </li>
                ))}
            </ol>
        </div>
    );
}

export function SourceNote({ children }: { children: ReactNode }) {
    return (
        <p className={`${ed.space.moduleY} ${ed.type.meta} border-t ${ed.colors.border} pt-4`}>
            <span className={`${ed.type.moduleLabel} mr-2`}>Source Note</span>
            {children}
        </p>
    );
}

export function KeyInsight({ children }: { children: ReactNode }) {
    return (
        <aside
            className={`${ed.space.moduleY} border border-[#2a2a2a] bg-gradient-to-b from-[#0c0c0c] to-[#080808] rounded-sm px-5 py-5`}
        >
            <p className={`${ed.type.moduleLabel} mb-2 text-[#a89f91]`}>Key Insight</p>
            <div className={`${ed.type.body} text-[#e8e6e3]`}>{children}</div>
        </aside>
    );
}

export function CalmNfaNotice() {
    return (
        <p className={`${ed.type.bodySm} ${ed.colors.nfa} border-l border-[#2a2a2a] pl-4 mb-10 md:mb-12`}>
            <span className="text-[#c8c4be] font-medium">Not financial advice.</span>{' '}
            This edition explains structural market frameworks — liquidity, dominance, macro, and
            news sensitivity. It does not provide BUY/SELL signals or price targets.
        </p>
    );
}
