import * as React from "react"
import { cn } from "@/lib/utils"

export interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  size?: number;
  strokeWidth?: number;
  showValue?: boolean;
  colorClassName?: string;
}

const CircularProgress = React.forwardRef<HTMLDivElement, CircularProgressProps>(
  ({ className, value, size = 40, strokeWidth = 3, showValue = true, colorClassName, ...props }, ref) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const clampedValue = Math.min(Math.max(value, 0), 100);
    const offset = circumference - (clampedValue / 100) * circumference;

    return (
      <div
        ref={ref}
        className={cn("relative inline-flex items-center justify-center", className)}
        style={{ width: size, height: size }}
        {...props}
      >
        <svg
          className="transform -rotate-90"
          width={size}
          height={size}
        >
          {/* Background circle */}
          <circle
            className="text-muted"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          {/* Progress circle */}
          <circle
            className={cn("transition-all duration-300 ease-in-out", colorClassName || "text-primary")}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>
        {showValue && (
          <span className="absolute text-xs font-medium">
            {Math.round(value)}
          </span>
        )}
      </div>
    );
  }
);

CircularProgress.displayName = "CircularProgress";

export { CircularProgress };
