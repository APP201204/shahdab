import { Loader2 } from "lucide-react";

export interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <div
      className="flex h-48 w-full flex-col items-center justify-center gap-2 text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
