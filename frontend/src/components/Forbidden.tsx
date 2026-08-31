import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";

export function Forbidden() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <EmptyState
        icon={<Shield className="h-8 w-8 text-muted-foreground" />}
        title="Access denied"
        description="You do not have permission to view this page."
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
