
import { redirect } from 'next/navigation';

// This is a redirector to the main feed page.
// The main feed is at /feed, which is handled by (main)/feed/page.tsx
export default function RootPage() {
  redirect('/feed');
}
