'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type ConsentValue = 'accepted' | 'declined' | null;

export function CookieBanner() {
  const [consent, setConsent] = useState<ConsentValue>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const storedConsent = localStorage.getItem('cookie-consent') as ConsentValue;
    if (storedConsent === 'accepted' || storedConsent === 'declined') {
      setConsent(storedConsent);
    } else {
      setConsent(null);
      setIsVisible(true);
    }
  }, []);

  const handleAccept = (): void => {
    localStorage.setItem('cookie-consent', 'accepted');
    setConsent('accepted');
    setIsVisible(false);
  };

  const handleDecline = (): void => {
    localStorage.setItem('cookie-consent', 'declined');
    setConsent('declined');
    setIsVisible(false);
  };

  if (consent) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 bg-[#111] border-t border-[#222] p-4 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1 flex items-start gap-2">
          <span className="material-symbols-outlined text-base text-[#555] mt-0.5 shrink-0">
            info
          </span>
          <p className="text-xs text-[#888] leading-relaxed">
            We use cookies for analytics (Google Analytics) to improve your experience. Third-party vendors, including Google, may use cookies to serve ads based on your prior visits or to display personalized content. By clicking &apos;Accept&apos;, you consent to our use of cookies. Learn more in our{' '}
            <Link
              href="/privacy"
              className="text-[var(--color-primary)] hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleAccept}
            className="px-4 py-2 bg-[var(--color-primary)] text-black text-xs font-semibold rounded hover:opacity-90 transition-opacity"
          >
            Accept
          </button>
          <button
            onClick={handleDecline}
            className="px-4 py-2 bg-transparent border border-[#333] text-[#888] text-xs rounded hover:border-[#555] transition-colors"
          >
            Decline Non-Essential
          </button>
        </div>
      </div>
    </div>
  );
}
