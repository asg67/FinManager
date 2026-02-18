import { type HTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: "sm" | "md" | "lg";
}

export default function Card({ children, padding = "md", className, ...props }: CardProps) {
  return (
    <div className={clsx("card", `card--pad-${padding}`, className)} {...props}>
      {children}
    </div>
  );
}

function CardLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("card__label", className)}>{children}</div>;
}

function CardValue({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("card__value", className)}>{children}</div>;
}

Card.Label = CardLabel;
Card.Value = CardValue;
