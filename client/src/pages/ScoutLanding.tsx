import React from "react";
import ScoutOS from "@/scout";

// Thin alias so older routes/components that reference ScoutLanding
// still work, but the actual "brain" and layout are owned entirely
// by ScoutOS.
export default function ScoutLanding() {
  return <ScoutOS />;
}
