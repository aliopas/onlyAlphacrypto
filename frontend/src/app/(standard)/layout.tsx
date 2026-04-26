import { ErrorBoundary } from '@/features/shared/components/ErrorBoundary';
import { Footer } from '@/features/shared/components/Footer';

export default function StandardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6">
                <ErrorBoundary>{children}</ErrorBoundary>
            </div>
            <Footer />
        </div>
    );
}
