import type { ReactNode, CSSProperties } from 'react';
import { ed } from './tokens';

const bodyStyle: CSSProperties = { fontFamily: ed.font.body };
const displayStyle: CSSProperties = { fontFamily: ed.font.display };

export function ReadingMeasure({
    children,
    className = '',
    wide = false,
}: {
    children: ReactNode;
    className?: string;
    wide?: boolean;
}) {
    const w = wide ? ed.measureWide : ed.measure;
    return (
        <div
            className={`${w} mx-auto w-full ${className}`.trim()}
            style={bodyStyle}
        >
            {children}
        </div>
    );
}

export function IndexMeasure({
    children,
    className = '',
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`${ed.measureIndex} mx-auto w-full ${className}`.trim()}
            style={bodyStyle}
        >
            {children}
        </div>
    );
}

export function EditionBadge({ children }: { children: ReactNode }) {
    return (
        <span className={ed.type.editionBadge} style={{ fontFamily: ed.font.ui }}>
            {children}
        </span>
    );
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
            className={`${ed.space.chapterGap} border-t ${ed.colors.rule} pt-12 md:pt-14 first:border-t-0 first:pt-0`}
        >
            {label && (
                <p className={ed.type.chapterLabel} style={{ fontFamily: ed.font.ui }}>
                    {label}
                </p>
            )}
            {title && (
                <h2 className={ed.type.h2} style={displayStyle}>
                    {title}
                </h2>
            )}
            <div className={ed.type.body} style={bodyStyle}>
                {children}
            </div>
        </section>
    );
}

export function Quote({ children, attribution }: { children: ReactNode; attribution?: string }) {
    return (
        <blockquote className={`${ed.space.moduleY} border-l border-[#3a3530] pl-5 md:pl-6`}>
            <p className={ed.type.quote} style={displayStyle}>
                {children}
            </p>
            {attribution && (
                <footer className={`mt-3 ${ed.type.meta}`} style={{ fontFamily: ed.font.ui }}>
                    — {attribution}
                </footer>
            )}
        </blockquote>
    );
}

export function KeyTakeaway({ children }: { children: ReactNode }) {
    return (
        <aside className={`${ed.space.moduleY} border-t border-b ${ed.colors.rule} py-6 md:py-7`}>
            <p className={`${ed.type.moduleLabel} mb-3`} style={{ fontFamily: ed.font.ui }}>
                Key takeaway
            </p>
            <div className={`${ed.type.body} text-[#ece8e1]`} style={bodyStyle}>
                {children}
            </div>
        </aside>
    );
}

export function MarketFact({
    children,
    label = 'Market fact',
}: {
    children: ReactNode;
    label?: string;
}) {
    return (
        <aside className={`${ed.space.moduleY} flex gap-4 items-start`}>
            <span
                className="mt-2 w-1 h-1 rounded-full bg-[#6e6860] shrink-0"
                aria-hidden
            />
            <div>
                <p className={`${ed.type.moduleLabel} mb-1`} style={{ fontFamily: ed.font.ui }}>
                    {label}
                </p>
                <div className={ed.type.bodySm} style={bodyStyle}>
                    {children}
                </div>
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
        <div className={ed.space.moduleY}>
            <p className={`${ed.type.moduleLabel} mb-5`} style={{ fontFamily: ed.font.ui }}>
                Timeline
            </p>
            <ol className="space-y-5 border-l border-[#2a2824] pl-5">
                {items.map((item, i) => (
                    <li key={`${item.when}-${i}`} className="relative">
                        <span
                            className="absolute -left-[1.35rem] top-1.5 w-1.5 h-1.5 rounded-full bg-[#4a4640]"
                            aria-hidden
                        />
                        <p className={ed.type.meta} style={{ fontFamily: ed.font.ui }}>
                            {item.when}
                        </p>
                        <p className={`${ed.type.bodySm} mt-1 text-[#d4cfc6]`} style={bodyStyle}>
                            {item.what}
                        </p>
                    </li>
                ))}
            </ol>
        </div>
    );
}

export function SourceNote({ children }: { children: ReactNode }) {
    return (
        <p
            className={`${ed.space.moduleY} ${ed.type.meta} border-t ${ed.colors.rule} pt-5`}
            style={{ fontFamily: ed.font.ui }}
        >
            <span className={`${ed.type.moduleLabel} mr-2`}>Sources</span>
            <span className="text-[#8a847a]">{children}</span>
        </p>
    );
}

export function KeyInsight({ children }: { children: ReactNode }) {
    return (
        <aside className={`${ed.space.moduleY} pl-5 border-l-2 border-[#3d3830]`}>
            <p
                className={`${ed.type.moduleLabel} mb-2 text-[#a89a88]`}
                style={{ fontFamily: ed.font.ui }}
            >
                Key insight
            </p>
            <div className={`${ed.type.body} text-[#ece8e1]`} style={displayStyle}>
                {children}
            </div>
        </aside>
    );
}

export function CalmNfaNotice() {
    return (
        <p
            className={`${ed.type.bodySm} ${ed.colors.nfa} mb-12 md:mb-14 max-w-[36rem]`}
            style={bodyStyle}
        >
            <span className="text-[#c8c2b8]">Not financial advice.</span> Educational context on
            structure and narrative — not BUY/SELL signals or price targets.
        </p>
    );
}
