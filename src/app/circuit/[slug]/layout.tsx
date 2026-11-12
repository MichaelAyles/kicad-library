/**
 * Circuit pages are client components that fetch their data in the browser,
 * so the server HTML is the same shell for every slug. Declaring static params
 * (none up front) makes Next.js render each slug once on first request and
 * serve it from the cache afterwards, instead of a function render per view,
 * crawler hit and prefetch.
 */
export function generateStaticParams() {
  return [];
}

export const dynamicParams = true;

export default function CircuitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
