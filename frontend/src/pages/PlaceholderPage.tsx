import { EmptyState } from "@/components/EmptyState";
import { Construction } from "lucide-react";
import { pageWrapper } from "@/lib/styles";

interface PlaceholderPageProps {
  title: string;
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className={`p-6 ${pageWrapper}`}>
      <h1 className="text-2xl font-bold">{title}</h1>
      <EmptyState
        title="Coming soon"
        description="This page will be implemented in the next module."
        icon={<Construction className="h-8 w-8 text-muted-foreground" />}
      />
    </div>
  );
}
