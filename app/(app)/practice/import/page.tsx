import type { Metadata } from "next";
import QuizImporter from "@/components/practice/QuizImporter";

export const metadata: Metadata = { title: "Import quiz JSON" };

export default function ImportPracticePage() {
  return <QuizImporter />;
}
