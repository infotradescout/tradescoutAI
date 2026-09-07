/** Public contact is opt-in data. Account ownership or management never grants publication. */
export type PublicProfileContact = Readonly<{
  label: string;
  phone: string;
  tel: string;
  email?: string;
}>;

export function resolveApprovedPublicContact(
  value: unknown,
  options: { publicationApproved: boolean; visible?: boolean },
): PublicProfileContact | null {
  if (options.publicationApproved !== true || options.visible === false || !value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const text = (key: string, limit: number): string => typeof input[key] === "string" && input[key].length <= limit && !/[\u0000-\u001f\u007f]/.test(input[key]) ? input[key].trim() : "";
  const label = text("label", 120);
  const phone = text("phone", 40);
  const tel = text("tel", 16);
  if (!label || !phone || !/^[+\d ()\-.]+$/.test(phone) || !/^\+[1-9]\d{7,14}$/.test(tel)) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits !== tel.slice(1) && !(digits.length === 10 && `1${digits}` === tel.slice(1))) return null;
  const email = text("email", 254);
  if (input.email != null && (!email || !/^[A-Za-z0-9.!#$%&'*+/=^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(email))) return null;
  return Object.freeze({ label, phone, tel, ...(email ? { email } : {}) });
}

export function publicProfileContactStructuredData(contact: PublicProfileContact | null) {
  return contact ? {
    telephone: contact.tel,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: contact.tel,
      contactType: contact.label,
      ...(contact.email ? { email: contact.email } : {}),
    },
  } : {};
}

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Uses only explicitly approved public data; never inspects account, owner, or other-business contacts. */
export function withPublicProfileContactHtml(
  html: string,
  contact: PublicProfileContact | null,
  identityUrls: readonly string[],
): string {
  if (!contact) return html;
  const main = /(<main\b[^>]*\bdata-seo-profile=["']true["'][^>]*>)([\s\S]*?)(<\/main>)/i;
  const summary = html.match(main);
  if (!summary || !/<\/article>\s*$/i.test(summary[2])) return html;
  let result = html.replace(main, (whole, open: string, body: string, close: string) => {
    if (/\bdata-public-profile-contact=["']true["']/.test(body)) return whole;
    const details = `<p data-public-profile-contact="true"><strong>${escape(contact.label)}:</strong> <a href="tel:${escape(contact.tel)}">${escape(contact.phone)}</a>${contact.email ? ` · <a href="mailto:${encodeURIComponent(contact.email)}">${escape(contact.email)}</a>` : ""}</p>`;
    return `${open}${body.replace(/<\/article>\s*$/i, () => `${details}</article>`)}${close}`;
  });
  const urls = new Set(identityUrls);
  const ids = new Set(identityUrls.map((url) => `${url}#identity`));
  result = result.replace(/(<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (whole, open: string, json: string, close: string) => {
    try {
      const document = JSON.parse(json);
      let changed = false;
      const visit = (node: unknown): void => {
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (!node || typeof node !== "object") return;
        const value = node as Record<string, unknown>;
        const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
        if (types.includes("LocalBusiness") && (ids.has(String(value["@id"])) || urls.has(String(value.url)))) {
          Object.assign(value, publicProfileContactStructuredData(contact));
          changed = true;
        }
        if (value["@graph"]) visit(value["@graph"]);
      };
      visit(document);
      return changed ? `${open}${JSON.stringify(document).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")}${close}` : whole;
    } catch { return whole; }
  });
  return result;
}
