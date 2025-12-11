import React from "react";
import { useRoute, Link } from "wouter";
import { getUserTypeMetadata } from "@shared/userTypes";
import { Layout, ArrowLeft } from "lucide-react";

export default function RoleHubPage() {
  const [match, params] = useRoute("/roles/:roleKey");
  const roleKey = match ? (params as any).roleKey : "";
  const meta = roleKey ? getUserTypeMetadata(roleKey) : null;

  if (!match) {
    return (
      <div className="min-h-screen bg-slate-950 text-tsTextMain flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg">Role not found.</p>
          <Link href="/">
            <a className="inline-flex items-center gap-2 text-tsAccent hover:text-tsAccentSoft">
              <ArrowLeft className="h-4 w-4" />
              Back to Scout
            </a>
          </Link>
        </div>
      </div>
    );
  }

  const label = meta?.label ?? roleKey.replace(/_/g, " ");
  const category = meta?.category ?? "general";
  const defaultView = meta?.defaultView ?? "user";
  const features = meta?.features ?? [];

  return (
    <div className="min-h-screen bg-slate-950 text-tsTextMain">
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-tsAccent/10 flex items-center justify-center border border-tsAccent/40">
              <Layout className="h-4 w-4 text-tsAccent" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-tsAccentSoft">
                Role hub
              </div>
              <h1 className="text-xl md:text-2xl font-semibold text-white">
                {label}
              </h1>
            </div>
          </div>
          <Link href="/">
            <a className="inline-flex items-center gap-2 text-xs md:text-sm text-tsTextMuted hover:text-tsAccentSoft">
              <ArrowLeft className="h-4 w-4" />
              Back to Scout
            </a>
          </Link>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4">
            <div className="rounded-2xl border border-tsBorder bg-slate-900/60 p-4 md:p-5">
              <h2 className="text-sm font-medium text-white mb-2">
                How Scout uses this role
              </h2>
              <p className="text-xs md:text-sm text-tsTextMuted">
                This role tells Scout which playbooks, tools, and local signals
                to prioritize when you ask questions or browse the platform. You
                can combine multiple roles for a blended experience (for
                example: homeowner + contractor, realtor + content creator, car
                dealer + business owner, or restaurant owner + nonprofit).
              </p>
            </div>

            <div className="rounded-2xl border border-tsBorder bg-slate-900/60 p-4 md:p-5 space-y-3">
              <h3 className="text-sm font-medium text-white">Role details</h3>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-slate-800 text-tsTextMuted">
                  Key: <span className="text-tsAccent">{roleKey}</span>
                </span>
                <span className="px-2 py-1 rounded-full bg-slate-800 text-tsTextMuted">
                  Category:{" "}
                  <span className="text-tsAccent">{category}</span>
                </span>
                <span className="px-2 py-1 rounded-full bg-slate-800 text-tsTextMuted">
                  Default view:{" "}
                  <span className="text-tsAccent">{defaultView}</span>
                </span>
              </div>

              {features.length > 0 ? (
                <div className="mt-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-tsAccentSoft mb-2">
                    Features unlocked
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs md:text-sm">
                    {features.map((f) => (
                      <li
                        key={f}
                        className="px-2 py-1 rounded-lg bg-slate-800 text-tsTextMuted"
                      >
                        {f.replace(/_/g, " ")}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 text-xs text-tsTextMuted">
                  This role does not define any special features yet, but Scout
                  still uses it to tune your answers.
                </p>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-tsBorder bg-slate-900/60 p-4 md:p-5">
              <h3 className="text-sm font-medium text-white mb-2">
                Next steps
              </h3>
              <p className="text-xs md:text-sm text-tsTextMuted mb-3">
                Use this hub as a starting point. Scout will route your
                questions through the tools that match your roles and location,
                whether you're a local business, restaurant owner, service
                provider, or community builder.
              </p>
              <div className="space-y-2 text-xs md:text-sm">
                <Link href="/">
                  <a className="block w-full text-center px-3 py-2 rounded-xl bg-tsAccent text.black font-medium hover:bg-tsAccentSoft transition">
                    Ask Scout about this role
                  </a>
                </Link>
                <Link href="/profile">
                  <a className="block w-full text-center px-3 py-2 rounded-xl border border-tsBorder text-tsTextMuted hover:text-white hover:bg-slate-900 transition">
                    Update my roles
                  </a>
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
