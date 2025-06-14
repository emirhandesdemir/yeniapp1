import type { ReactNode } from 'react';
import Link from 'next/link';
import { Globe } from 'lucide-react';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  description: string;
  footerLinkHref: string;
  footerLinkText: string;
  footerText: string;
}

export default function AuthLayout({ 
  children, 
  title, 
  description,
  footerLinkHref,
  footerLinkText,
  footerText 
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-primary/10 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-block p-3 bg-primary/20 rounded-full mb-4">
            <Globe className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-headline font-bold text-primary-foreground tracking-tight">
            Sohbet Küresi
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {title}
          </p>
        </div>
        
        <div className="bg-card p-8 shadow-2xl rounded-xl">
          <p className="text-center text-muted-foreground mb-6">{description}</p>
          {children}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          {footerText}{' '}
          <Link href={footerLinkHref} className="font-medium text-primary hover:underline">
            {footerLinkText}
          </Link>
        </p>
      </div>
    </div>
  );
}
