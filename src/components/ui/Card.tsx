import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import "../../styles/ui.css";

export type CardProps = HTMLAttributes<HTMLElement> & {
  as?: keyof JSX.IntrinsicElements;
  children?: ReactNode;
};

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { as = "section", className, children, ...rest },
  ref,
) {
  const Component = as;
  const classes = ["ui-card", className ?? ""].filter(Boolean).join(" ");

  return (
    <Component ref={ref as never} className={classes} {...rest}>
      {children}
    </Component>
  );
});

/*
Example:
<Card as="article">
  <h3>Shared wishlist</h3>
  <p>Track ideas and award points.</p>
</Card>
*/
