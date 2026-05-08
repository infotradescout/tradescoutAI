export const procurementOrderStatuses = [
  "draft",
  "submitted",
  "needs_review",
  "quote_pending",
  "quote_sent",
  "approved",
  "assigned_to_fulfillment",
  "accepted_by_fulfillment",
  "rejected_by_fulfillment",
  "supplier_confirmed",
  "purchase_pending",
  "purchased",
  "driver_assigned",
  "pickup_started",
  "picked_up",
  "delivery_started",
  "delivered",
  "proof_uploaded",
  "completed",
  "cancelled",
  "failed",
  "refunded",
] as const;

export type ProcurementOrderStatus = (typeof procurementOrderStatuses)[number];

export const procurementModes = [
  "buy_deliver",
  "pickup_my_order",
  "emergency_supply_run",
  "repeat_previous_order",
  "help_me_source_it",
] as const;

export type ProcurementMode = (typeof procurementModes)[number];

export const procurementUrgencies = ["two_hour", "four_hour", "scheduled", "flexible"] as const;
export type ProcurementUrgency = (typeof procurementUrgencies)[number];

export const procurementVehicleTypes = [
  "car",
  "suv",
  "pickup_truck",
  "trailer",
  "box_truck",
  "unsure",
] as const;

export type ProcurementVehicleType = (typeof procurementVehicleTypes)[number];

export const procurementQuoteLineTypes = [
  "materials_estimate",
  "delivery_fee",
  "service_fee",
  "contingency_buffer",
] as const;

export type ProcurementQuoteLineType = (typeof procurementQuoteLineTypes)[number];

export const procurementModeLabels: Record<ProcurementMode, string> = {
  buy_deliver: "Buy + Deliver",
  pickup_my_order: "Pickup My Order",
  emergency_supply_run: "Emergency Supply Run",
  repeat_previous_order: "Repeat Previous Order",
  help_me_source_it: "Help Me Source It",
};

export const procurementSourceChannels = [
  "tradescout_supply_run",
  "grunt_direct_ordering",
  "admin_created",
  "repeat_order",
] as const;

export type ProcurementSourceChannel = (typeof procurementSourceChannels)[number];

export const procurementWorkspaceTypes = [
  "platform",
  "fulfillment_partner",
  "supplier",
  "admin",
] as const;

export type ProcurementWorkspaceType = (typeof procurementWorkspaceTypes)[number];

export const procurementUrgencyLabels: Record<ProcurementUrgency, string> = {
  two_hour: "2 hour",
  four_hour: "4 hour",
  scheduled: "Scheduled",
  flexible: "Flexible",
};

export const procurementVehicleLabels: Record<ProcurementVehicleType, string> = {
  car: "Car",
  suv: "SUV",
  pickup_truck: "Pickup truck",
  trailer: "Trailer",
  box_truck: "Box truck",
  unsure: "Not sure",
};

export const procurementStatusLabels: Record<ProcurementOrderStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  needs_review: "Needs review",
  quote_pending: "Waiting on Quote",
  quote_sent: "Quote sent",
  approved: "Approved",
  assigned_to_fulfillment: "Sent to Grunt",
  accepted_by_fulfillment: "Accepted by Grunt",
  rejected_by_fulfillment: "Rejected by Grunt",
  supplier_confirmed: "Supplier confirmed",
  purchase_pending: "Purchase pending",
  purchased: "Purchased",
  driver_assigned: "Driver assigned",
  pickup_started: "Pickup started",
  picked_up: "Picked up",
  delivery_started: "Delivery started",
  delivered: "Delivered",
  proof_uploaded: "Proof Received",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
  refunded: "Refunded",
};
