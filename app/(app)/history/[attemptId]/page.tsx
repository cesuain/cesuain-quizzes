import { PageHeader, PageHeaderEyebrow, PageHeaderTitle } from "@cesuain/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AttemptReport from "@/components/history/AttemptReport";
import { getAttempt } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Attempt history" };

export default async function AttemptHistoryPage({ params }: PageProps<"/history/[attemptId]">) {
  const { attemptId } = await params;
  const details = await getAttempt(attemptId);
  if (!details) notFound();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader>
        <PageHeaderEyebrow>Attempt history</PageHeaderEyebrow>
        <PageHeaderTitle>{details.quiz_title}</PageHeaderTitle>
      </PageHeader>
      <AttemptReport details={details} view="history" />
    </div>
  );
}
