import { ErrorBoundary } from '@/features/shared/components/ErrorBoundary';

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex-1 overflow-hidden p-4 md:p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
        </div>
    );
}
