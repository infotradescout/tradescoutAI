export const HELP_SOURCES = {
  connection: "/help/how-tradescout-works#connection-without-compromise",
  directConnect: "/help/how-tradescout-works#direct-connect-workflow",
  messaging: "/help/how-tradescout-works#messaging-rules",
  finances: "/help/how-tradescout-works#finances-invoicing",
  cancelReopen: "/help/how-tradescout-works#cancel-reopen",
  sharing: "/help/how-tradescout-works#sharing-attribution",
} as const;

export type HelpSourceKey = keyof typeof HELP_SOURCES;

export function getHelpLink(domain: HelpSourceKey): string {
  return HELP_SOURCES[domain];
}
