import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="rounded-full bg-zinc-100 p-3 dark:bg-zinc-800">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold">Start tracking your money</p>
          <p className="mt-1 text-sm text-zinc-500">
            Add a transaction to see your dashboard, reports, and summaries populate automatically.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
