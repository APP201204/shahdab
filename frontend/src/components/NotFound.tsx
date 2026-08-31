import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";

export function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <EmptyState
        icon={<FileQuestion className="h-8 w-8 text-muted-foreground" />}
        title="Page not found"
        description="The page you are looking for does not exist."
        action={
          <Link to="/">
            <Button variant="outline">Go home</Button>
          </Link>
        }
        className="w-full max-w-md"
      />
    </main>
  );
}
