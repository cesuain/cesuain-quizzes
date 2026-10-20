import {
  Button,
  EmptyState,
  EmptyStateContent,
  EmptyStateDescription,
  EmptyStateHeader,
  EmptyStateTitle,
} from "@cesuain/ui";
import NextLink from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <EmptyState>
        <EmptyStateHeader>
          <EmptyStateTitle>Not found</EmptyStateTitle>
          <EmptyStateDescription>This page does not exist, or it belongs to another account.</EmptyStateDescription>
        </EmptyStateHeader>
        <EmptyStateContent>
          <Button asChild variant="gradient">
            <NextLink href="/dashboard">Go to the dashboard</NextLink>
          </Button>
        </EmptyStateContent>
      </EmptyState>
    </main>
  );
}
