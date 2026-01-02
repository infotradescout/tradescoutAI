import { registerActionDescriptor } from "./actionDescriptors";

let alreadyRegistered = false;

export function registerStarterActionDescriptors() {
  if (alreadyRegistered) return;
  alreadyRegistered = true;

  registerActionDescriptor({
    actionId: "mission_fix_done",
    whatItDoes: "Marks a Mission Control fix as completed.",
    then: "Closes the one-fix item and records the decision.",
  });

  registerActionDescriptor({
    actionId: "mission_fix_defer",
    whatItDoes: "Defers a Mission Control fix with a stated reason.",
    then: "Keeps the item open and logs the deferral for today.",
  });

  registerActionDescriptor({
    actionId: "scout_start",
    whatItDoes: "Starts a new Scout conversation with your message.",
    then: "Routes the request for analysis and next steps.",
  });

  registerActionDescriptor({
    actionId: "scout_recommendation_accept",
    whatItDoes: "Accepts a recommendation provided by Scout.",
    then: "Applies the suggested action and continues the flow.",
  });

  registerActionDescriptor({
    actionId: "set_preferred_source",
    whatItDoes: "Opens instructions to set TradeScout as your preferred source on Google.",
    then: "Guides you to prioritize TradeScout results for future searches.",
  });

  registerActionDescriptor({
    actionId: "connect_request_submit",
    whatItDoes: "Submits your Direct Connect request through Scout.",
    then: "Sends the request for routing to the right provider.",
  });
}
