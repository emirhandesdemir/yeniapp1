
// This layout file is now redundant because the root layout at /src/app/layout.tsx
// conditionally applies the AppLayout to all main application pages.
// This change was made to resolve routing conflicts.
// This file can be safely deleted from the project in the future.

import type { ReactNode } from 'react';

export default function DeprecatedMainLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
