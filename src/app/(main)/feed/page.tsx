
import { redirect } from 'next/navigation';

// This page is obsolete. The content has been moved to /src/app/(main)/page.tsx
// to make it the default page for the (main) route group.
// This redirect ensures any old links to /feed will go to the new main page.
export default function DeprecatedFeedPage() {
    redirect('/');
}
