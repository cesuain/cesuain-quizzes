import type { Metadata } from "next";
import PracticePlayer from "@/components/practice/PracticePlayer";

export const metadata: Metadata = { title: "Practice" };

export default function PlayPracticePage() {
  return <PracticePlayer />;
}
