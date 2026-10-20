import {
  Alert,
  AlertDescription,
  AlertTitle,
  PageHeader,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderTitle,
} from "@cesuain/ui";
import { FlaskConical } from "lucide-react";
import { PracticeProvider } from "@/components/practice/PracticeProvider";
import PracticeSteps from "@/components/practice/PracticeSteps";

export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return (
    <PracticeProvider>
      <div className="flex flex-col gap-6">
        <PageHeader>
          <PageHeaderEyebrow>Custom Quiz Generator</PageHeaderEyebrow>
          <PageHeaderTitle>Practice any topic</PageHeaderTitle>
          <PageHeaderDescription>
            Describe what you want to learn, generate a prompt for ChatGPT, paste the JSON it returns and practice.
          </PageHeaderDescription>
        </PageHeader>
        <Alert variant="info" role="note">
          <FlaskConical aria-hidden />
          <AlertTitle>Practice mode: session only</AlertTitle>
          <AlertDescription>
            Custom quizzes stay in this browser tab. They are not saved, earn no XP, unlock no achievements and never affect
            your official statistics. Refreshing or leaving the page discards them. Official quizzes, by contrast, save every
            answer and can be resumed.
          </AlertDescription>
        </Alert>
        <PracticeSteps />
        {children}
      </div>
    </PracticeProvider>
  );
}
