// @vitest-environment jsdom
import React, { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ScoutSearchDock from "./ScoutSearchDock";
import { ScoutLaunchContextCard } from "./ScoutLaunchContextCard";
import { parseScoutLaunchLocation } from "@shared/scoutLaunchContext";
import {
  SCOUT_MAIN_INPUT_DRAFT_KEY,
  SCOUT_MAIN_INPUT_OWNER_KEY,
  SCOUT_HELP_INTENT_KEY,
  prepareScoutLaunchContinuationPath,
  takeScoutHelpIntentForOwner,
  useScoutAccountBoundLaunch,
  useScoutAccountBoundLaunchPrompt,
  useScoutTaskDraftBoundary,
  writeScoutExternalPrefill,
} from "./scoutTaskDraftBoundary";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("Scout task draft boundary", () => {
  let container: HTMLDivElement;
  let root: Root;
  let sent: ReturnType<typeof vi.fn<(account: string, task: string, text: string) => void>>;
  let discarded: ReturnType<typeof vi.fn<() => void>>;

  function Tasks() {
    const [account, setAccount] = useState<"user:A" | "user:B" | "unresolved">("user:A");
    const [task, setTask] = useState<"A" | "B" | "new">("A");
    const [composerMount, setComposerMount] = useState(0);
    const [unrelatedRender, setUnrelatedRender] = useState(0);
    const [prefillKey, setPrefillKey] = useState(0);
    const [externalPrefill, setExternalPrefill] = useState<string | undefined>();
    const { version, changeTask } = useScoutTaskDraftBoundary(discarded);

    return (
      <div>
        <span data-testid="task">{task}</span>
        <span data-testid="account">{account}</span>
        <span data-testid="rerenders">{unrelatedRender}</span>
        <button type="button" onClick={() => setUnrelatedRender((value) => value + 1)}>
          Rerender same task
        </button>
        <button type="button" onClick={() => { changeTask(); setTask("B"); }}>
          Load task B
        </button>
        <button type="button" onClick={() => { changeTask(); setTask("new"); }}>
          Start new
        </button>
        <button type="button" onClick={() => setComposerMount((value) => value + 1)}>
          Reload composer
        </button>
        <button type="button" onClick={() => setAccount("user:B")}>
          Switch to account B
        </button>
        <button type="button" onClick={() => setAccount("unresolved")}>Auth loading</button>
        <button type="button" onClick={() => setAccount("user:A")}>Resolve account A</button>
        <button type="button" onClick={() => writeScoutExternalPrefill("Pending A handoff", account === "unresolved" ? null : account)}>
          Save pending handoff
        </button>
        <button
          type="button"
          onClick={() => {
            const prompt = "Classic-to-Scout handoff about plumbing";
            writeScoutExternalPrefill(prompt, account === "unresolved" ? null : account);
            setExternalPrefill(prompt);
            setPrefillKey((value) => value + 1);
          }}
        >
          Open classic handoff
        </button>
        <ScoutSearchDock
          key={`scout-task-draft-${account}:${version}:${composerMount}`}
          isMobile
          placement={task === "new" ? "inline" : "fixed"}
          isBusy={false}
          prefillKey={prefillKey}
          forcedPrefill={externalPrefill}
          draftOwner={account === "unresolved" ? null : account}
          hasMessages={task !== "new"}
          quickStartPrompts={[]}
          onSend={(text) => sent(account, task, text)}
          onTyping={() => undefined}
        />
      </div>
    );
  }

  function textArea(): HTMLTextAreaElement {
    const input = container.querySelector<HTMLTextAreaElement>("textarea");
    if (!input) throw new Error("Scout composer was not rendered");
    return input;
  }

  function click(label: string): void {
    const button = [...container.querySelectorAll("button")].find(
      (candidate) =>
        candidate.textContent?.trim() === label || candidate.getAttribute("aria-label") === label
    );
    if (!button) throw new Error(`Missing ${label} control`);
    button.click();
  }

  function type(text: string): void {
    const input = textArea();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  beforeEach(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    sent = vi.fn<(account: string, task: string, text: string) => void>();
    discarded = vi.fn<() => void>();
    await act(async () => root.render(<Tasks />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("keeps same-task typing but clears A before loading B, including a composer reload", async () => {
    await act(async () => type("Private task A details"));
    expect(textArea().value).toBe("Private task A details");
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY)).toBe("Private task A details");

    await act(async () => click("Rerender same task"));
    expect(textArea().value).toBe("Private task A details");

    await act(async () => click("Load task B"));
    expect(container.querySelector('[data-testid="task"]')?.textContent).toBe("B");
    expect(textArea().value).toBe("");
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY)).toBeNull();
    expect(discarded).toHaveBeenCalledTimes(1);

    await act(async () => click("Reload composer"));
    expect(textArea().value).toBe("");
    await act(async () => type("Task B plumbing follow-up"));
    await act(async () => click("Send follow-up"));
    expect(sent).toHaveBeenCalledExactlyOnceWith("user:A", "B", "Task B plumbing follow-up");
    expect(sent).not.toHaveBeenCalledWith("user:A", "B", "Private task A details");
  });

  it("starts new with a blank composer and still accepts an intentional classic handoff", async () => {
    await act(async () => type("Private task A details"));
    await act(async () => click("Start new"));
    expect(container.querySelector('[data-testid="task"]')?.textContent).toBe("new");
    expect(textArea().value).toBe("");
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY)).toBeNull();

    await act(async () => click("Reload composer"));
    expect(textArea().value).toBe("");

    await act(async () => click("Open classic handoff"));
    expect(textArea().value).toBe("Classic-to-Scout handoff about plumbing");
    await act(async () => click("Start search"));
    expect(sent).toHaveBeenCalledExactlyOnceWith("user:A", "new", "Classic-to-Scout handoff about plumbing");
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY)).toBeNull();
  });

  it("clears an account A typed draft on an already-mounted A to B switch and reload", async () => {
    await act(async () => type("Private account A estimate"));
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_OWNER_KEY)).toBe("user:A");

    await act(async () => click("Switch to account B"));
    expect(container.querySelector('[data-testid="account"]')?.textContent).toBe("user:B");
    expect(textArea().value).toBe("");
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY)).toBeNull();

    await act(async () => click("Reload composer"));
    expect(textArea().value).toBe("");
    await act(async () => type("B's new question"));
    await act(async () => click("Send follow-up"));
    expect(sent).toHaveBeenCalledExactlyOnceWith("user:B", "A", "B's new question");
    expect(sent).not.toHaveBeenCalledWith("user:B", "A", "Private account A estimate");
  });

  it("rejects A's pending handoff under B but accepts B's deliberate classic handoff", async () => {
    await act(async () => click("Save pending handoff"));
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY)).toBe("Pending A handoff");
    await act(async () => click("Switch to account B"));
    expect(textArea().value).toBe("");
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY)).toBeNull();

    await act(async () => click("Open classic handoff"));
    expect(textArea().value).toBe("Classic-to-Scout handoff about plumbing");
    await act(async () => click("Send follow-up"));
    expect(sent).toHaveBeenCalledExactlyOnceWith(
      "user:B", "A", "Classic-to-Scout handoff about plumbing"
    );
  });

  it("keeps a same-account handoff through auth loading until the account resolves", async () => {
    await act(async () => click("Save pending handoff"));
    await act(async () => click("Auth loading"));
    expect(textArea().value).toBe("");
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY)).toBe("Pending A handoff");
    await act(async () => click("Resolve account A"));
    expect(textArea().value).toBe("Pending A handoff");
  });

  it("does not revive unmarked legacy text after a composer reload", async () => {
    window.localStorage.setItem(SCOUT_MAIN_INPUT_DRAFT_KEY, "Legacy private text");
    await act(async () => click("Reload composer"));
    expect(textArea().value).toBe("");
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY)).toBeNull();
  });

  it("never releases another account's or legacy help intent for auto-send", () => {
    window.localStorage.setItem(
      SCOUT_HELP_INTENT_KEY,
      JSON.stringify({ owner: "user:A", prompt: "Private A help request" })
    );
    expect(takeScoutHelpIntentForOwner("user:B")).toBeNull();
    expect(window.localStorage.getItem(SCOUT_HELP_INTENT_KEY)).toBeNull();

    window.localStorage.setItem(SCOUT_HELP_INTENT_KEY, JSON.stringify({ prompt: "Legacy text" }));
    expect(takeScoutHelpIntentForOwner("user:B")).toBeNull();
    expect(window.localStorage.getItem(SCOUT_HELP_INTENT_KEY)).toBeNull();

    window.localStorage.setItem(
      SCOUT_HELP_INTENT_KEY,
      JSON.stringify({ owner: "user:B", prompt: "B's deliberate help request" })
    );
    expect(takeScoutHelpIntentForOwner(null)).toBeNull();
    expect(takeScoutHelpIntentForOwner("user:B")).toBe("B's deliberate help request");
    expect(window.localStorage.getItem(SCOUT_HELP_INTENT_KEY)).toBeNull();
  });

  it("rejects A's URL prompt after B switches and reloads, then accepts a distinct B launch", async () => {
    function Launch({ startOwner }: { startOwner: string }) {
      const [owner, setOwner] = useState(startOwner);
      const [prompt, setPrompt] = useState("A's private URL prompt");
      const accepted = useScoutAccountBoundLaunchPrompt(
        JSON.stringify({ prompt }),
        prompt,
        owner
      );
      return (
        <div>
          <span data-testid="accepted-launch">{accepted || ""}</span>
          <button type="button" onClick={() => setOwner("user:B")}>Switch URL account B</button>
          <button type="button" onClick={() => setPrompt("B's new deliberate launch")}>
            Open new B launch
          </button>
          <button type="button" onClick={() => setPrompt("A's private URL prompt")}>
            Reopen old A URL
          </button>
          <ScoutSearchDock
            key={owner}
            isMobile
            placement="inline"
            isBusy={false}
            prefillKey={0}
            forcedPrefill={accepted}
            draftOwner={owner}
            hasMessages={false}
            quickStartPrompts={[]}
            onSend={(text) => sent(owner, "URL", text)}
            onTyping={() => undefined}
          />
        </div>
      );
    }
    await act(async () => root.render(<Launch startOwner="user:A" />));
    expect(container.querySelector('[data-testid="accepted-launch"]')?.textContent).toBe(
      "A's private URL prompt"
    );
    expect(textArea().value).toBe("A's private URL prompt");
    await act(async () => click("Switch URL account B"));
    expect(container.querySelector('[data-testid="accepted-launch"]')?.textContent).toBe("");
    expect(textArea().value).toBe("");
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<Launch startOwner="user:B" />));
    expect(container.querySelector('[data-testid="accepted-launch"]')?.textContent).toBe("");
    expect(textArea().value).toBe("");
    await act(async () => click("Open new B launch"));
    expect(container.querySelector('[data-testid="accepted-launch"]')?.textContent).toBe(
      "B's new deliberate launch"
    );
    expect(textArea().value).toBe("B's new deliberate launch");
    await act(async () => click("Start search"));
    expect(sent).toHaveBeenCalledExactlyOnceWith("user:B", "URL", "B's new deliberate launch");
    await act(async () => click("Reopen old A URL"));
    expect(container.querySelector('[data-testid="accepted-launch"]')?.textContent).toBe("");
    expect(textArea().value).toBe("");
  });

  it("keeps each accepted same-context prompt with its account after prompt removal and reload", async () => {
    const aRoute = "/scout?source=business_profile_call&businessSlug=shared-plumbing&intent=estimate&prompt=A%20private%20launch";
    const bRoute = "/scout?source=business_profile_call&businessSlug=shared-plumbing&intent=estimate&prompt=B%20deliberate%20launch";
    const unmarkedRoute = "/scout?source=business_profile_call&businessSlug=shared-plumbing&intent=estimate";
    const contextEffects = vi.fn<(owner: string, intent: string) => void>();
    const sentWithContext = vi.fn<(owner: string, text: string, intent: string, returnPath: string) => void>();
    let aMarkedRoute = "";
    let bMarkedRoute = "";

    function Launch({ startOwner, startRoute = aRoute }: { startOwner: string; startRoute?: string }) {
      const [owner, setOwner] = useState(startOwner);
      const [route, setRoute] = useState(startRoute);
      const launch = parseScoutLaunchLocation(route);
      const acceptance = useScoutAccountBoundLaunch(
        launch.signature,
        Boolean(launch.context || launch.prompt),
        owner,
        Boolean(launch.continuationToken)
      );
      const context = acceptance === "accepted" ? launch.context : null;
      const prompt = acceptance === "accepted" ? launch.prompt : undefined;
      const returnPath = acceptance === "accepted" ? launch.returnPath : undefined;
      useEffect(() => {
        if (context?.intent) contextEffects(owner, context.intent);
      }, [context?.intent, owner]);

      return (
        <div>
          <span data-testid="launch-acceptance">{acceptance}</span>
          <span data-testid="launch-intent">{context?.intent || ""}</span>
          <span data-testid="launch-return-path">{returnPath || ""}</span>
          <span data-testid="launch-route">{route}</span>
          <button type="button" onClick={() => setOwner("user:B")}>Switch context account B</button>
          <button type="button" onClick={() => setRoute(unmarkedRoute)}>Open fresh unmarked context</button>
          <button type="button" onClick={() => setRoute(bRoute)}>Open B context launch</button>
          <button type="button" onClick={() => setRoute(aRoute)}>Reopen A context launch</button>
          <button type="button" onClick={() => setRoute(aMarkedRoute)}>Reopen A marked URL</button>
          {context ? (
            <ScoutLaunchContextCard
              context={context}
              returnPath={returnPath}
              onOpenOriginal={() => undefined}
              onClear={() => undefined}
            />
          ) : null}
          <ScoutSearchDock
            key={owner}
            isMobile
            placement="inline"
            isBusy={false}
            prefillKey={0}
            forcedPrefill={prompt}
            draftOwner={owner}
            hasMessages={false}
            quickStartPrompts={[]}
            onSend={(text) => {
              sent(owner, "URL", text);
              sentWithContext(owner, text, context?.intent || "", returnPath || "");
              if (launch.prompt) {
                const marked = prepareScoutLaunchContinuationPath(route, owner);
                if (owner === "user:A") aMarkedRoute = marked;
                if (owner === "user:B") bMarkedRoute = marked;
                setRoute(marked);
              }
            }}
            onTyping={() => undefined}
          />
        </div>
      );
    }

    await act(async () => root.render(<Launch startOwner="user:A" />));
    expect(container.querySelector('[aria-label="Shared context from your previous view"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="launch-intent"]')?.textContent).toBe("estimate");
    expect(textArea().value).toBe("A private launch");
    expect(contextEffects).toHaveBeenCalledExactlyOnceWith("user:A", "estimate");

    await act(async () => click("Open fresh unmarked context"));
    expect(container.querySelector('[data-testid="launch-acceptance"]')?.textContent).toBe("accepted");
    await act(async () => click("Reopen A context launch"));
    expect(container.querySelector('[data-testid="launch-acceptance"]')?.textContent).toBe("accepted");
    await act(async () => click("Start search"));
    expect(aMarkedRoute).toMatch(/^\/scout\?[^#]*scoutContinue=[a-f0-9]{32}/);
    expect(aMarkedRoute).not.toContain("A%20private%20launch");
    expect(aMarkedRoute).not.toContain("user%3AA");
    expect(container.querySelector('[data-testid="launch-acceptance"]')?.textContent).toBe("accepted");
    expect(container.querySelector('[aria-label="Shared context from your previous view"]')).not.toBeNull();

    contextEffects.mockClear();
    await act(async () => click("Switch context account B"));
    expect(container.querySelector('[data-testid="launch-acceptance"]')?.textContent).toBe("blocked");
    expect(container.querySelector('[aria-label="Shared context from your previous view"]')).toBeNull();
    expect(container.querySelector('[data-testid="launch-intent"]')?.textContent).toBe("");
    expect(textArea().value).toBe("");
    expect(contextEffects).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<Launch startOwner="user:B" startRoute={aMarkedRoute} />));
    expect(container.querySelector('[data-testid="launch-acceptance"]')?.textContent).toBe("blocked");
    expect(container.querySelector('[aria-label="Shared context from your previous view"]')).toBeNull();
    expect(container.querySelector('[data-testid="launch-intent"]')?.textContent).toBe("");
    expect(textArea().value).toBe("");
    expect(contextEffects).not.toHaveBeenCalled();

    await act(async () => click("Open fresh unmarked context"));
    expect(container.querySelector('[data-testid="launch-acceptance"]')?.textContent).toBe("blocked");
    expect(container.querySelector('[data-testid="launch-return-path"]')?.textContent).toBe("");
    contextEffects.mockClear();

    await act(async () => click("Open B context launch"));
    expect(container.querySelector('[data-testid="launch-acceptance"]')?.textContent).toBe("accepted");
    expect(container.querySelector('[aria-label="Shared context from your previous view"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="launch-intent"]')?.textContent).toBe("estimate");
    expect(container.querySelector('[data-testid="launch-return-path"]')?.textContent).toBe("/u/shared-plumbing");
    expect(textArea().value).toBe("B deliberate launch");
    expect(contextEffects).toHaveBeenCalledExactlyOnceWith("user:B", "estimate");

    await act(async () => click("Start search"));
    expect(sentWithContext).toHaveBeenCalledWith("user:B", "B deliberate launch", "estimate", "/u/shared-plumbing");
    expect(bMarkedRoute).toMatch(/^\/scout\?[^#]*scoutContinue=[a-f0-9]{32}/);
    expect(bMarkedRoute).not.toBe(aMarkedRoute);
    expect(bMarkedRoute).not.toContain("B%20deliberate%20launch");
    expect(bMarkedRoute).not.toContain("user%3AB");
    expect(container.querySelector('[data-testid="launch-acceptance"]')?.textContent).toBe("accepted");
    expect(container.querySelector('[data-testid="launch-intent"]')?.textContent).toBe("estimate");
    expect(container.querySelector('[data-testid="launch-return-path"]')?.textContent).toBe("/u/shared-plumbing");

    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<Launch startOwner="user:B" startRoute={bMarkedRoute} />));
    expect(container.querySelector('[data-testid="launch-acceptance"]')?.textContent).toBe("accepted");
    expect(container.querySelector('[aria-label="Shared context from your previous view"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="launch-intent"]')?.textContent).toBe("estimate");
    expect(container.querySelector('[data-testid="launch-return-path"]')?.textContent).toBe("/u/shared-plumbing");
    await act(async () => type("B follow-up after reload"));
    await act(async () => click("Start search"));
    expect(sentWithContext).toHaveBeenCalledWith("user:B", "B follow-up after reload", "estimate", "/u/shared-plumbing");

    contextEffects.mockClear();
    await act(async () => click("Reopen A marked URL"));
    expect(container.querySelector('[data-testid="launch-acceptance"]')?.textContent).toBe("blocked");
    expect(container.querySelector('[aria-label="Shared context from your previous view"]')).toBeNull();
    expect(contextEffects).not.toHaveBeenCalled();
    await act(async () => click("Reopen A context launch"));
    expect(container.querySelector('[data-testid="launch-acceptance"]')?.textContent).toBe("blocked");
  });

  it("blocks an old account's context-only URL after a fresh account remount", async () => {
    const contextOnlyRoute = "/scout?source=scout_resume&intent=local-search";
    const contextEffects = vi.fn<(owner: string, intent: string) => void>();

    function ContextOnly({ owner }: { owner: string }) {
      const launch = parseScoutLaunchLocation(contextOnlyRoute);
      const acceptance = useScoutAccountBoundLaunch(
        launch.signature,
        Boolean(launch.context || launch.prompt),
        owner
      );
      const context = acceptance === "accepted" ? launch.context : null;
      useEffect(() => {
        if (context?.intent) contextEffects(owner, context.intent);
      }, [context?.intent, owner]);
      return (
        <div>
          <span data-testid="context-only-acceptance">{acceptance}</span>
          <span data-testid="context-only-intent">{context?.intent || ""}</span>
          {context ? (
            <ScoutLaunchContextCard
              context={context}
              onOpenOriginal={() => undefined}
              onClear={() => undefined}
            />
          ) : null}
        </div>
      );
    }

    await act(async () => root.render(<ContextOnly owner="user:A" />));
    expect(container.querySelector('[data-testid="context-only-acceptance"]')?.textContent).toBe("accepted");
    expect(container.querySelector('[aria-label="Shared context from your previous view"]')).not.toBeNull();
    expect(contextEffects).toHaveBeenCalledExactlyOnceWith("user:A", "local-search");

    contextEffects.mockClear();
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<ContextOnly owner="user:B" />));
    expect(container.querySelector('[data-testid="context-only-acceptance"]')?.textContent).toBe("blocked");
    expect(container.querySelector('[aria-label="Shared context from your previous view"]')).toBeNull();
    expect(container.querySelector('[data-testid="context-only-intent"]')?.textContent).toBe("");
    expect(contextEffects).not.toHaveBeenCalled();
  });

  it("does not preclaim an unmarked context-only URL from a different prompt launch", async () => {
    const base = "/scout?source=scout_resume&intent=local-search";
    function Launch({ owner, route }: { owner: string; route: string }) {
      const launch = parseScoutLaunchLocation(route);
      const acceptance = useScoutAccountBoundLaunch(
        launch.signature,
        Boolean(launch.context || launch.prompt),
        owner,
        Boolean(launch.continuationToken)
      );
      return <span data-testid="unmarked-ownership">{acceptance}</span>;
    }
    await act(async () => root.render(
      <Launch owner="user:A" route={`${base}&prompt=A%20private%20launch`} />
    ));
    expect(container.querySelector('[data-testid="unmarked-ownership"]')?.textContent).toBe("accepted");
    await act(async () => root.render(<Launch owner="user:B" route={base} />));
    expect(container.querySelector('[data-testid="unmarked-ownership"]')?.textContent).toBe("accepted");
  });

  it("does not let a direct unbound continuation marker claim an account", async () => {
    const route = "/scout?source=business_profile_call&businessSlug=shared-plumbing&intent=estimate&scoutContinue=0123456789abcdef0123456789abcdef";
    function MarkedLaunch({ owner }: { owner: string }) {
      const launch = parseScoutLaunchLocation(route);
      const acceptance = useScoutAccountBoundLaunch(
        launch.signature,
        Boolean(launch.context || launch.prompt),
        owner,
        Boolean(launch.continuationToken)
      );
      return (
        <div>
          <span data-testid="unbound-marker-acceptance">{acceptance}</span>
          {acceptance === "accepted" && launch.context ? (
            <ScoutLaunchContextCard
              context={launch.context}
              onOpenOriginal={() => undefined}
              onClear={() => undefined}
            />
          ) : null}
        </div>
      );
    }
    await act(async () => root.render(<MarkedLaunch owner="user:A" />));
    expect(container.querySelector('[data-testid="unbound-marker-acceptance"]')?.textContent).toBe("blocked");
    expect(container.querySelector('[aria-label="Shared context from your previous view"]')).toBeNull();
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<MarkedLaunch owner="user:B" />));
    expect(container.querySelector('[data-testid="unbound-marker-acceptance"]')?.textContent).toBe("blocked");
    expect(container.querySelector('[aria-label="Shared context from your previous view"]')).toBeNull();
  });
});
