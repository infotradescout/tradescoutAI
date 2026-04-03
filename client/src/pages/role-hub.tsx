import React from "react";
import { useRoute, Link } from "wouter";
import { getUserTypeMetadata } from "@shared/userTypes";
import { Layout } from "lucide-react";
import { Page, Section } from "@/components/layout/PagePrimitives";

export default function RoleHubPage() {
  const [match, params] = useRoute("/roles/:roleKey");
  const roleKey = match ? (params as any).roleKey : "";
  const meta = roleKey ? getUserTypeMetadata(roleKey) : null;

  if (!match) {
    return (
      <Page>
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-4">
            <p className="text-lg text-white">Role not found.</p>
          </div>
        </div>
      </Page>
    );
  }

  const label = meta?.label ?? roleKey.replace(/_/g, " ");
  const category = meta?.category ?? "general";
  const defaultView = meta?.defaultView ?? "user";
  const features = meta?.features ?? [];

  return (
    <Page className="max-w-5xl">
      <Section
        title={
          <span className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-ts-orange/10 flex items-center justify-center border border-ts-orange/40">
              <Layout className="h-4 w-4 text-ts-orange" />
            </div>
            {label}
          </span>
        }
        subtitle={<span className="text-xs uppercase tracking-[0.18em] text-ts-orange">Role hub</span>}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-tsCard/95 p-4 md:p-5">
              <h2 className="text-sm font-medium text-white mb-2">Role profile</h2>
              <p className="text-xs md:text-sm text-white/60">
                Active role settings for your account.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-tsCard/95 p-4 md:p-5 space-y-3">
              <h3 className="text-sm font-medium text-white">Role details</h3>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-white/5 text-white/60">
                  Key: <span className="text-ts-orange">{roleKey}</span>
                </span>
                <span className="px-2 py-1 rounded-full bg-white/5 text-white/60">
                  Category: <span className="text-ts-orange">{category}</span>
                </span>
                <span className="px-2 py-1 rounded-full bg-white/5 text-white/60">
                  Default view: <span className="text-ts-orange">{defaultView}</span>
                </span>
              </div>

              {features.length > 0 ? (
                <div className="mt-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-ts-orange mb-2">
                    Features unlocked
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs md:text-sm">
                    {features.map((f) => (
                      <li key={f} className="px-2 py-1 rounded-lg bg-white/5 text-white/60">
                        {f.replace(/_/g, " ")}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 text-xs text-white/60">
                  No role-specific features are enabled yet.
                </p>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-tsCard/95 p-4 md:p-5">
              <h3 className="text-sm font-medium text-white mb-2">Next steps</h3>
              <p className="text-xs md:text-sm text-white/60 mb-3">Quick actions.</p>
              <div className="space-y-2 text-xs md:text-sm">
                <Link
                  href="/"
                  className="block w-full text-center px-3 py-2 rounded-xl bg-ts-orange text-black font-medium hover:bg-ts-orange/20 transition"
                >
                  Ask Scout about this role
                </Link>
                <Link
                  href="/profile"
                  className="block w-full text-center px-3 py-2 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-tsCard transition"
                >
                  Update my roles
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </Section>
    </Page>
  );
}
