import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ecosystemPublicLinkKey, parseMealScoutSharingLink, readProfileEcosystemPublicLinks,
  upsertProfileEcosystemPublicLinks } from "@shared/ecosystemPublicLink";

export default function ProfileEcosystemLinksEditor({ blocks, onChange }: { blocks: unknown[]; onChange: (blocks: unknown[]) => void }) {
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const refs = readProfileEcosystemPublicLinks(blocks);
  const add = () => {
    const pointer = parseMealScoutSharingLink(link.trim());
    if (!pointer) { setMessage("Paste the sharing link from MealScout's owner sharing controls."); return; }
    try {
      onChange(upsertProfileEcosystemPublicLinks(blocks, [...refs, pointer]));
      setLink(""); setMessage("Link added to this draft. Save the profile to publish it.");
    } catch (error) { setMessage((error as Error).message); }
  };
  return <div className="space-y-2 rounded-lg border border-white/10 p-3" data-testid="profile-ecosystem-links-editor">
    <p className="text-sm font-medium">Connected public profiles</p>
    <p className="text-xs text-white/70">Add an approved public sharing link. Each app keeps its accounts and permissions.</p>
    <Input aria-label="MealScout sharing link" placeholder="Paste MealScout sharing link" value={link} onChange={e => setLink(e.target.value)} />
    <Button type="button" variant="outline" size="sm" onClick={add} disabled={refs.length >= 3}>Add public link</Button>
    {refs.map((p, index) => <div key={ecosystemPublicLinkKey(p)} className="flex items-center justify-between text-sm">
      <span>MealScout public profile {index + 1}</span><Button type="button" size="sm" variant="ghost"
        onClick={() => { onChange(upsertProfileEcosystemPublicLinks(blocks, refs.filter(ref => ecosystemPublicLinkKey(ref) !== ecosystemPublicLinkKey(p)))); setMessage("Link removed from this draft. Save the profile to publish the change."); }}>Remove</Button>
    </div>)}
    {message ? <p role="status" className="text-sm text-white/70">{message}</p> : null}
  </div>;
}
