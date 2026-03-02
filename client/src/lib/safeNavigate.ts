export type NavigateFn = (to: string, options?: { replace?: boolean }) => void;

export function safeNavigate(navigate: NavigateFn, href: string) {
  if (!href) return;

  if (typeof window === "undefined") {
    try {
      navigate(href);
    } catch {
      // ignore
    }
    return;
  }

  const targetUrl = new URL(href, window.location.origin);
  const target = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (current === target) return;

  let navigateFailed = false;
  try {
    navigate(href);
  } catch {
    navigateFailed = true;
  }

  if (navigateFailed) {
    window.location.assign(target);
    return;
  }

  window.setTimeout(() => {
    const now = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (now !== target) {
      window.location.assign(target);
    }
  }, 350);
}
