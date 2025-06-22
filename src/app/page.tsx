
import { notFound } from 'next/navigation';

// This page is now handled by the (main) route group at src/app/(main)/page.tsx.
// This file calls notFound() to prevent any routing conflicts.
export default function RootPage() {
  notFound();
}
