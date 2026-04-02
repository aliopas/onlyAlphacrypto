import React from 'react';

interface Props {
    title: string;
    icon?: React.ReactNode;
    rightContent?: React.ReactNode;
    variant?: 'boxed' | 'inline';
    dotColor?: string; // e.g. 'bg-emerald-500', 'bg-amber-500'
}

export function SectionHeader({ title, icon, rightContent, variant = 'inline', dotColor }: Props) {
    if (variant === 'boxed') {
        return (
            <div className="h-11 flex items-center px-4 border-b border-[#333] bg-[#111] shrink-0">
                {icon ? (
                    <span className="mr-2 opacity-80">{icon}</span>
                ) : dotColor ? (
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor} mr-2 shadow-[0_0_8px_rgba(255,255,255,0.2)]`} />
                ) : null}
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#888]">{title}</span>
                {rightContent && <div className="ml-auto flex items-center">{rightContent}</div>}
            </div>
        );
    }

    // inline variant
    return (
        <div className="flex items-center justify-between mb-4 w-full">
            <h3 className="text-[11px] font-mono text-[#888] uppercase tracking-[0.2em] flex items-center gap-2 m-0 leading-none">
                {icon ? (
                    <span className="opacity-80">{icon}</span>
                ) : dotColor ? (
                    <span className={`w-1.5 h-1.5 ${dotColor} rounded-full inline-block shadow-[0_0_8px_rgba(255,255,255,0.2)]`} />
                ) : null}
                {title}
            </h3>
            {rightContent && <div className="flex items-center">{rightContent}</div>}
        </div>
    );
}
