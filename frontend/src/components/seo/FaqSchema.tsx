import { sanitizeForJsonLd } from '@/lib/json-ld';

export interface FaqItem {
    question: string;
    answer: string;
}

interface FaqSchemaProps {
    items: FaqItem[];
}

export function FaqSchema({ items }: FaqSchemaProps) {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((item) => ({
            '@type': 'Question',
            name: sanitizeForJsonLd(item.question),
            acceptedAnswer: {
                '@type': 'Answer',
                text: sanitizeForJsonLd(item.answer),
            },
        })),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
    );
}
