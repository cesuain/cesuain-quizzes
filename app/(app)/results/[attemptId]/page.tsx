import { PageHeader, PageHeaderEyebrow, PageHeaderTitle } from "@cesuain/ui";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import AttemptReport from "@/components/history/AttemptReport";
import { getAttempt } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Results" };

export default async function ResultsPage({ params }: PageProps<"/results/[attemptId]">) {
  const { attemptId } = await params;
  const details = await getAttempt(attemptId);
  if (!details) notFound();
  if (details.attempt.status === "in_progress") {
    redirect(`/quizzes/${details.attempt.quiz_id}/play?attempt=${attemptId}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader>
        <PageHeaderEyebrow>Results</PageHeaderEyebrow>
        <PageHeaderTitle>{details.quiz_title}</PageHeaderTitle>
      </PageHeader>
      <AttemptReport details={details} view="results" />
    </div>
  );
}
