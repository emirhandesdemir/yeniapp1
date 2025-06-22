import { notFound } from 'next/navigation';

// This file exists to prevent a routing conflict with /src/app/(main)/page.tsx
// which is the true root page of the application. By calling notFound(),
// we explicitly tell Next.js to skip this file and look for the page
// inside the route groups. This is a robust way to handle this structure.
export default function RootPage() {
  notFound();
}
