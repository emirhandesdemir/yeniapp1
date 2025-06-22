
import type { ReactNode } from 'react';

// This layout is temporarily disabled to diagnose the startup issue.
export default function DeprecatedMainLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
