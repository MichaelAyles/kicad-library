'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

export function CookieNotice() {
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed the notice
    const dismissed = localStorage.getItem('cookieNoticeDismissed');
    if (!dismissed) {
      setShowNotice(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('cookieNoticeDismissed', 'true');
    setShowNotice(false);
  };

  if (!showNotice) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-card border-t shadow-lg">
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <p className="text-sm text-foreground mb-2">
              <strong>Cookie Notice:</strong> We use only essential cookies for authentication and platform functionality.
              We do not use tracking or advertising cookies.
            </p>
            <p className="text-xs text-muted-foreground">
              By using CircuitSnips, you agree to our{' '}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              {' '}and{' '}
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="p-2 hover:bg-muted rounded-md transition-colors flex-shrink-0"
            aria-label="Dismiss cookie notice"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
