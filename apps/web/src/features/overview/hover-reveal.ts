/**
 * Affordances hidden until their surface is hovered. Keyboard focus always
 * reveals them, and coarse pointers show them permanently — touch has no
 * hover to reveal with. Callers add their own `group-hover/*:opacity-100`
 * (or `group-focus-within/*`) for the surface that does the revealing.
 */
export const HOVER_REVEAL =
  'opacity-0 transition-opacity focus-visible:opacity-100 pointer-coarse:opacity-100';
