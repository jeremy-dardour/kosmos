import { describe, expect, it } from 'vitest';

import { isInsideCard } from '@/features/overview/is-inside-card';

function build(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  return host;
}

describe('isInsideCard', () => {
  it('accepts a target inside the card element', () => {
    const host = build('<article><button>in</button></article>');
    const card = host.querySelector('article')!;

    expect(isInsideCard(card.querySelector('button'), card)).toBe(true);
  });

  it('rejects a target outside the card', () => {
    const host = build('<article></article><button>out</button>');
    const card = host.querySelector('article')!;

    expect(isInsideCard(host.querySelector('button'), card)).toBe(false);
  });

  it.each(['menu', 'dialog', 'listbox'])(
    'treats a click inside a portalled %s as inside',
    (role) => {
      const host = build(
        `<article></article><div role="${role}"><button>pick</button></div>`,
      );
      const card = host.querySelector('article')!;

      expect(isInsideCard(host.querySelector('button'), card)).toBe(true);
    },
  );

  it('rejects a null target and survives a missing card', () => {
    expect(isInsideCard(null, null)).toBe(false);
  });
});
