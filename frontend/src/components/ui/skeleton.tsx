import { cn } from "@/lib/utils";

export interface SkeletonProps {
  className?: string;
  variant?: "default" | "circle";
}

export function Skeleton({ className, variant = "default" }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        variant === "circle" && "rounded-full",
        className
      )}
    />
  );
}
