
// This file is intentionally left almost empty to avoid routing conflicts.
// The main page is defined in src/app/(main)/page.tsx, which correctly
// maps to the root URL ('/') due to the (main) route group. This setup
// ensures the main page uses the shared layout from the (main) group.
export default function RootPage() {
  return null;
}
