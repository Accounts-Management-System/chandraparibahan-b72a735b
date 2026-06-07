import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90 [html.light_&]:bg-[linear-gradient(180deg,var(--primary),color-mix(in_oklab,var(--primary)_80%,black))] [html.light_&]:border [html.light_&]:border-[color-mix(in_oklab,var(--primary)_50%,black)] [html.light_&]:shadow-[inset_0_1px_0_oklch(1_0_0_/_0.3),0_1px_2px_oklch(0_0_0_/_0.25)] [html.light_&]:active:shadow-[inset_0_2px_4px_oklch(0_0_0_/_0.3)]",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground [html.light_&]:bg-[linear-gradient(180deg,oklch(0.99_0_0),oklch(0.88_0.005_270))] [html.light_&]:border-[oklch(0_0_0_/_0.25)] [html.light_&]:shadow-[inset_0_1px_0_oklch(1_0_0_/_0.9),0_1px_2px_oklch(0_0_0_/_0.15)] [html.light_&]:active:shadow-[inset_0_2px_4px_oklch(0_0_0_/_0.2)] [html.light_&]:text-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
