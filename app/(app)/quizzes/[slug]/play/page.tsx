import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import OfficialPlayer from "@/components/quiz/OfficialPlayer";
import { getAttempt } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Playing" };

export default async function PlayPage({ params, searchParams }: PageProps<"/quizzes/[slug]/play">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const attemptId = typeof query.attempt === "string" ? query.attempt : null;
  if (!attemptId) redirect(`/quizzes/${slug}`);

  const details = await getAttempt(attemptId);
  if (!details || details.attempt.quiz_id !== slug) notFound();
  if (details.attempt.status === "abandoned") redirect(`/history/${attemptId}`);

  // Keyed by attempt so starting a new attempt never reuses the previous player state.
  return <OfficialPlayer key={attemptId} details={details} />;
}
