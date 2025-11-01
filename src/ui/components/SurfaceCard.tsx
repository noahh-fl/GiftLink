import type { HTMLAttributes, ReactNode } from "react";
import "../styles/components/surface-card.css";

interface SurfaceCardProps extends HTMLAttributes<HTMLElement> {
  as?: keyof JSX.IntrinsicElements;
  interactive?: boolean;
  children: ReactNode;
}

export default function SurfaceCard({
  as: Element = "section",
  interactive = false,
  className = "",
  children,
  ...props
}: SurfaceCardProps) {
  const classes = ["surface-card", interactive ? "surface-card--interactive" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <Element className={classes} {...props}>
      {children}
    </Element>
  );
}
