# Experience Surfaces — JW Stone Spatial Studio 1.4.0

## Primary journey

The studio opens with the 3D scene as the dominant surface, a visible selected-stone summary, a clear “confirmation required” inventory state, and compact controls. The visitor can switch Kitchen, Bathroom, and Living Room without losing the chosen stone; orbit, zoom, reset, and choose useful camera presets; apply stone to supported surfaces; adjust crop, vein rotation, and physical texture scale; then reveal optional fabrication details.

## Controls and disclosure

Desktop uses a persistent scene viewport with a bounded inspector. Mobile keeps the viewport primary and exposes the inspector as short progressive panels rather than a long form. Stone, Scene, Texture, Fabrication, and Save/Send groups disclose in that order. Measurement details remain available but do not replace the spatial preview.

Optional sinks, cooktops, other openings, seams, waterfalls, backsplash/floor applications, and edge choices visibly change the design summary. Defaults are no sink, no cooktop, and no other opening. Destructive reset asks for confirmation; scene and camera reset do not.

## States and recovery

- Loading: stable viewport frame, progress label, and non-blocking catalog controls.
- Texture failure: neutral material, selected item identity, retry, and no invented preview.
- WebGL unavailable or context lost: accessible measured summary and fabrication controls remain usable, with retry and a plain explanation.
- Invalid shared state: valid allowlisted fields restore independently; rejected fields fall back safely without hiding the studio.
- Save success: local confirmation only. Send success or error remains owned by the existing TradeScout request flow.

## Accessibility and responsive proof

Every non-camera operation has a labeled keyboard/touch control and visible focus. Orbit gestures have adjacent instructions and a reset. Reduced motion suppresses nonessential camera animation. Minimum touch targets and horizontal overflow are checked at 390 px; desktop is checked at 1440 px. Canvas content has an equivalent live design summary so essential selections are not available only visually.

The `/jw-stone` marketplace, `/u/jw-stone` profile, and their owner-voided learning/guidance surfaces are not redesigned by this amendment.
