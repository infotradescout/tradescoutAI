import type { ComponentProps } from "react";
import { JwCollapsibleSection as CoreJwCollapsibleSection } from "./JwCollapsibleSectionCore";

type JwCollapsibleSectionProps = ComponentProps<typeof CoreJwCollapsibleSection>;

export function JwCollapsibleSection(props: JwCollapsibleSectionProps) {
  return (
    <CoreJwCollapsibleSection
      {...props}
      title={props.title === "Full inventory" ? "Browse full inventory" : props.title}
    />
  );
}
