import {
  Button,
  Card,
  EmptyState,
  EmptyStateContent,
  EmptyStateDescription,
  EmptyStateHeader,
  EmptyStateMedia,
  EmptyStateTitle,
  PageHeader,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderTitle,
} from "@cesuain/ui";
import { History } from "lucide-react";
import type { Metadata } from "next";
import NextLink from "next/link";
import AttemptTable from "@/components/history/AttemptTable";
import { listAttempts, quizTitles } from "@/lib/data/queries";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage() {
  const [attempts, titles] = await Promise.all([listAttempts({ limit: 200 }), quizTitles()]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader>
        <PageHeaderEyebrow>History</PageHeaderEyebrow>
        <PageHeaderTitle>Official quiz attempts</PageHeaderTitle>
        <PageHeaderDescription>
          Every official attempt is kept separately. Custom practice sessions are never saved and do not appear here.
        </PageHeaderDescription>
      </PageHeader>

      {attempts.length === 0 ? (
        <EmptyState>
          <EmptyStateHeader>
            <EmptyStateMedia variant="icon">
              <History />
            </EmptyStateMedia>
            <EmptyStateTitle>No attempts yet</EmptyStateTitle>
            <EmptyStateDescription>Start an official quiz and your results will be listed here.</EmptyStateDescription>
          </EmptyStateHeader>
          <EmptyStateContent>
            <Button asChild variant="gradient">
              <NextLink href="/quizzes">Browse quizzes</NextLink>
            </Button>
          </EmptyStateContent>
        </EmptyState>
      ) : (
        <Card variant="solid">
          <AttemptTable attempts={attempts} titles={titles} caption="Official quiz attempts" />
        </Card>
      )}
    </div>
  );
}
