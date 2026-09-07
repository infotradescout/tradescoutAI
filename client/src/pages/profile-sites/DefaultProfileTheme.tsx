import type { ComponentProps } from "react";
import BusinessProfileTheme from "./BusinessProfileTheme";
import PreservedDefaultProfileTheme from "./PreservedDefaultProfileTheme";
import "./BusinessProfileFooter.css";

/** Business profiles share one layout. Explicit portfolio and community variants retain their presentation. */
export default function DefaultProfileTheme(props: ComponentProps<typeof PreservedDefaultProfileTheme>) {
  if (props.presentationVariant === "first-deliverable" || props.profileKind === "community") {
    return <PreservedDefaultProfileTheme {...props} />;
  }
  return <BusinessProfileTheme {...props} />;
}
