import Link from 'next/link';
import { ed } from './tokens';

export interface PathCrumb {
    label: string;
    href?: string;
}

/** Quiet publication path — not app breadcrumb chrome. */
export function PublicationPath({ items }: { items: PathCrumb[] }) {
    if (items.length === 0) return null;

    return (
        <nav className={`${ed.type.path} mb-10 md:mb-12`} aria-label="Location">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {items.map((item, i) => {
                    const last = i === items.length - 1;
                    return (
                        <li key={`${item.label}-${i}`} className="flex items-center gap-2">
                            {i > 0 && (
                                <span className="text-[#3a3630] select-none" aria-hidden>
                                    ·
                                </span>
                            )}
                            {item.href && !last ? (
                                <Link href={item.href} className={ed.colors.link}>
                                    {item.label}
                                </Link>
                            ) : (
                                <span className={last ? 'text-[#9c968c]' : undefined}>
                                    {item.label}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
