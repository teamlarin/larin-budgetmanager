import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva(
  "rounded-lg border bg-card text-card-foreground shadow-sm",
  {
    variants: {
      variant: {
        default: "transition-all duration-300 hover:shadow-medium hover:-translate-y-1 hover:border-primary/30",
        static: "", // No hover effects
        stats: "transition-all duration-300 hover:shadow-medium hover:-translate-y-1 hover:border-primary/30",
        table: "", // For table containers, no hover
        compact: "transition-all duration-300 hover:shadow-medium hover:-translate-y-1 hover:border-primary/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const cardHeaderVariants = cva(
  "flex flex-col space-y-1.5",
  {
    variants: {
      variant: {
        default: "p-6",
        stats: "flex flex-row items-center justify-between space-y-0 p-4 pb-2",
        compact: "p-4",
        table: "p-4",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const cardContentVariants = cva(
  "",
  {
    variants: {
      variant: {
        default: "p-6 pt-0",
        stats: "p-4 pt-0",
        compact: "p-4 pt-0",
        table: "p-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const cardFooterVariants = cva(
  "flex items-center",
  {
    variants: {
      variant: {
        default: "p-6 pt-0",
        stats: "p-4 pt-0",
        compact: "p-4 pt-0",
        table: "p-4 pt-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  )
)
Card.displayName = "Card"

export interface CardHeaderProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardHeaderVariants> {}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardHeaderVariants({ variant }), className)}
      {...props}
    />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

export interface CardContentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardContentVariants> {}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(cardContentVariants({ variant }), className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

export interface CardFooterProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardFooterVariants> {}

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardFooterVariants({ variant }), className)}
      {...props}
    />
  )
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants, cardHeaderVariants, cardContentVariants, cardFooterVariants }
