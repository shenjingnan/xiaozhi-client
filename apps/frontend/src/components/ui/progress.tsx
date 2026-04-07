import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  status?: "installing" | "completed" | "failed" | "idle";
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, status = "idle", ...props }, ref) => {
    const getProgressColor = () => {
      switch (status) {
        case "installing":
          return "bg-blue-500";
        case "completed":
          return "bg-green-500";
        case "failed":
          return "bg-red-500";
        default:
          return "bg-gray-300";
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full transition-all duration-300 ease-in-out",
            getProgressColor()
          )}
          style={{ width: `${value || 0}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
