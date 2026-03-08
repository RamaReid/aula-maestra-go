import { LucideIcon } from "lucide-react";

import { Button } from "./button";
import { Card, CardContent } from "./card";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="rounded-[1.75rem] border-border/80 bg-card/90 shadow-sm">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
        {Icon && <Icon className="mb-1 h-12 w-12 text-muted-foreground" />}
        <div className="space-y-2">
          <p className="font-serif text-2xl font-semibold tracking-tight text-foreground">{title}</p>
          {description ? (
            <p className="mx-auto max-w-xl text-sm leading-7 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? (
          <Button className="mt-1" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
