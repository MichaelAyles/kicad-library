import { SHELL_SLUG } from "@/lib/shell-slug";

/**
 * The edit page is client-only, so it's built once for the shell slug and
 * serves every circuit: the worker maps /circuit/<slug>/edit to it and the
 * page reads the real slug from the URL (see worker/assets.ts).
 */
export function generateStaticParams() {
  return [{ slug: SHELL_SLUG }];
}

export const dynamicParams = false;

export default function EditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
