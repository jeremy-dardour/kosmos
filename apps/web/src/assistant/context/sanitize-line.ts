const WHITESPACE_RUN = /\s+/g;

/**
 * Context blocks are newline-joined and the API accepts newlines inside names,
 * so every user-authored string is collapsed onto one line before it is
 * interpolated — otherwise a crafted name forges extra context lines.
 */
export const sanitizeLine = (value: string): string =>
  value.replaceAll(WHITESPACE_RUN, ' ').trim();
