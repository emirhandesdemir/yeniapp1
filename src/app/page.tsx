import { notFound } from 'next/navigation';

// This root page is not used. The main page is inside the (main) route group.
// This prevents a route conflict for the '/' path by explicitly showing a 404.
export default function RootPage() {
  notFound();
}
