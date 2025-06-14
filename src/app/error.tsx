"use client"; // Error components must be Client Components

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
      <h1 className="text-3xl font-bold text-destructive mb-2">Bir şeyler ters gitti!</h1>
      <p className="text-muted-foreground mb-6 max-w-md">
        Beklenmedik bir hata oluştu. Lütfen daha sonra tekrar deneyin veya sorunu bize bildirin.
      </p>
      {error?.message && (
        <p className="text-sm text-muted-foreground bg-muted p-2 rounded-md mb-6">Hata Mesajı: {error.message}</p>
      )}
      <Button
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
        className="bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        Tekrar Dene
      </Button>
    </div>
  );
}
