import { ErrorBoundary } from '@/features/shared/components/ErrorBoundary';

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
    return (
        <ErrorBoundary>{children}</ErrorBoundary>
    );
}
