/**
 * No circuit pages are built ahead of time: declaring static params (none up
 * front) makes Next.js render each slug once on first request and serve it
 * from the ISR cache afterwards, instead of a function render per view,
 * crawler hit and prefetch. Applies to the detail page (revalidated hourly,
 * see page.tsx) and the client-only edit page.
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
