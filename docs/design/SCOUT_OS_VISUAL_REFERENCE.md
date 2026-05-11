# Scout OS Visual Reference

Date: 2026-05-11
Owner: TradeScout product/design
Status: locked as forward visual reference

## Purpose

This document captures the approved Scout OS visual direction from the May 2026 reference board. Future TradeScout UI work should use this as the product's visual north star when building Scout, admin-adjacent intelligence views, local guide experiences, mobile action trays, and high-confidence task cards.

This is a TradeScout design reference only. Do not import MealScout, Trader's Corner, or unrelated brand assets into TradeScout surfaces.

## Core Feel

The approved direction is:

- Dark, premium, field-ready, and operational.
- Local and helpful, not generic chatbot software.
- Dense enough for useful action, but organized so users know where to look.
- Orange used as the action and signal color, not as a page wash.
- Scout presented as a guide that summarizes, prepares, and opens next actions.
- Cards and panels should feel like useful instruments, not marketing decorations.

## Layout Patterns

Use these patterns as primary references:

- Mobile-first stacked screens with a clear top status/header, main intelligence card, action tray, and bottom navigation.
- A primary result card that carries the current finding, recommendation, or local insight.
- Secondary cards for marketplace, local guide, price, schedule, permit, supplier, community, or weather/context signals.
- Tool trays with 2-4 high-value actions, using icon plus plain-English labels.
- Bottom search/chat input as a persistent utility, not the whole product.
- Right-side or lower companion panels for supporting context, never competing with the main result.
- The chat thread should summarize and collect intent; the cards should carry the main result and next actions.

## Visual Elements To Reuse

- Near-black backgrounds with raised charcoal surfaces.
- Thin, low-contrast borders with a warmer orange active border on selected/high-priority cards.
- Soft orange glow only on active status strips, active nav items, and primary CTAs.
- Small uppercase section labels for system layers, status, card categories, and tray labels.
- Large readable result headlines inside cards.
- Compact data tiles for price, availability, permit, schedule, trust, or demand signals.
- Local context headers with county/city selectors where relevant.
- Source labels such as verified, community-powered, local data, or updated date when real.
- Map or location mini-panels for area-based workflows.
- Image-backed community/local cards only when the image adds real context.
- Rounded cards in the 10-20px range, with tighter radius on utility buttons and chips.

## Copy Direction

The surface should sound like a capable local guide:

- "Here are your fastest options."
- "I found the likely paths."
- "Here are the best next steps."
- "Scout prepared this from your local context."
- "Send a material list or supplier link and Scout can help turn it into a Supply Run."
- "Review before sharing."
- "Contact when ready."

Avoid internal or system-facing language on public/user surfaces:

- route
- routing
- validator
- CALL_TOOL
- workspace
- likely type
- timing normal
- no-op
- debug
- classification

## Action Model

Scout should default to action cards instead of long chat explanations.

Recommended structure after a user asks for help:

1. Main finding card: what Scout understood and what matters now.
2. Best next steps: 1-4 options, fewer when confidence is high and more when confidence is low.
3. Context cards: local suppliers, products, marketplace items, materials, permits, pros, guides, or community activity when relevant.
4. Approval-gated actions: draft, message, contact, quote, invoice, publish, order, or broadcast only after explicit user approval and existing server guards.
5. Chat summary: short explanation plus intent collection, not the core result.

## Confidence Behavior

Confidence changes the number of options, not whether Scout is useful.

- High confidence: show the strongest path first and 1-2 supporting actions.
- Medium confidence: show 2-3 paths with clear labels.
- Low confidence: show several tap-ready options that collect intent without making the user answer a long questionnaire.

When there are two plausible interpretations, show both choices as action cards. Do not ask a naked chat question if the user can tap one of the options.

## Domain-Aware Cards

For project or task requests, Scout should consider all relevant angles before choosing what to show:

- User expectation: what the user seems to want.
- Required work: materials, labor, tools, rentals, plans, permits, inspections, safety, timing.
- Feasible paths: DIY, hire local help, compare prices, source materials, ask a guide question, save a request, or contact when ready.
- User role: homeowner, contractor, business owner, buyer, seller, property manager, or mixed-role user.
- Local context: county, availability, nearby posts, suppliers, marketplace items, and trusted providers.

Do not show user-facing judgments about whether expectations are realistic. Use neutral language:

- "Based on what you told Scout, these are the paths that fit best."
- "Here is what usually needs to be decided."
- "These are the parts Scout can help you prepare."

## Guardrails

- Keep all existing Scout abilities and routes intact.
- Do not remove features to simplify the UI.
- Keep Direct Connect contact gating.
- Never imply Scout can pay, message, contact, publish, order, quote, invoice, or broadcast without explicit approval.
- Never invent live supplier inventory, verified local pricing, availability, ratings, or community proof.
- Keep paid placement visually and semantically separate from organic results.
- Public/user surfaces should hide internal classifications and technical action names.

## Implementation Notes

When applying this reference:

- Prefer a result-first layout over a chat-first layout.
- Keep chat compact and use it for summary, clarifying intent, and collecting missing details.
- Put actionable cards above or beside the chat summary.
- Preserve source/proof labels where data is real.
- Use lucide icons for tool buttons and actions.
- Avoid decorative graphics that do not help the user decide.
- Before shipping, screenshot the surface at mobile and desktop sizes and verify the user can immediately identify the main result, next action, and input.

