// Client-side pagination for the filtered lists. paginate and pageItems are pure; mountPager drives a <Pager>
// whose rows are already filtered by the caller, so every count is the count of the filtered rows.

export interface PageState {
  page: number;
  pages: number;
  // 1-based, inclusive; both 0 when there are no rows
  from: number;
  to: number;
  hasPrev: boolean;
  hasNext: boolean;
}

// pageSize Infinity puts every row on one page ("Todos")
export const paginate = (total: number, page: number, pageSize: number): PageState => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(pages, Math.max(1, Math.trunc(page) || 1));
  const from = total === 0 ? 0 : (current - 1) * Math.min(pageSize, total) + 1;
  const to = Math.min(total, current * pageSize);
  return { page: current, pages, from, to, hasPrev: current > 1, hasNext: current < pages };
};

export const pageStatus = (state: PageState, total: number) =>
  total === 0 ? 'Sin resultados' : `Mostrando ${state.from}–${state.to} de ${total}`;

// first, last and the pages around the current one; at most 7 slots, a gap standing for the pages left out
export const pageItems = (page: number, pages: number): (number | 'gap')[] => {
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  if (pages <= 7) return range(1, pages);
  if (page <= 4) return [...range(1, 5), 'gap', pages];
  if (page >= pages - 3) return [1, 'gap', ...range(pages - 4, pages)];
  return [1, 'gap', page - 1, page, page + 1, 'gap', pages];
};

export interface Pager {
  // all: every row of the list; matched: the rows that pass the filter, in display order
  show(all: HTMLElement[], matched: HTMLElement[], options?: { reset?: boolean }): void;
}

// Takes over row visibility for one list. Without a pager element the caller keeps hiding rows itself.
export const mountPager = (nav: HTMLElement | null, focusTarget: HTMLElement | null): Pager | null => {
  if (!nav) return null;
  const status = nav.querySelector<HTMLElement>('[data-pager-status]')!;
  const items = nav.querySelector<HTMLElement>('[data-pager-items]')!;
  const prev = nav.querySelector<HTMLButtonElement>('[data-pager-prev]')!;
  const next = nav.querySelector<HTMLButtonElement>('[data-pager-next]')!;
  const size = nav.querySelector<HTMLSelectElement>('[data-pager-size]')!;
  // ?pagina= only when the list is alone on the page, so two lists never fight over it
  const useUrl = document.querySelectorAll('[data-pager]').length === 1;
  const sizeOf = () => Number(size.value) || Infinity;

  let all: HTMLElement[] = [];
  let matched: HTMLElement[] = [];
  let page = useUrl ? Number(new URLSearchParams(location.search).get('pagina')) || 1 : 1;

  const setUrl = () => {
    if (!useUrl) return;
    const url = new URL(location.href);
    if (page > 1) url.searchParams.set('pagina', String(page));
    else url.searchParams.delete('pagina');
    history.replaceState(history.state, '', url);
  };

  const button = (label: string, target: number, current: boolean) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.dataset.page = String(target);
    b.setAttribute('aria-label', `Página ${target}`);
    if (current) b.setAttribute('aria-current', 'page');
    return b;
  };

  const render = () => {
    const state = paginate(matched.length, page, sizeOf());
    page = state.page;
    const shown = new Set(matched.slice(Math.max(0, state.from - 1), state.to));
    for (const row of all) row.hidden = !shown.has(row);
    status.textContent = pageStatus(state, matched.length);
    prev.setAttribute('aria-disabled', String(!state.hasPrev));
    next.setAttribute('aria-disabled', String(!state.hasNext));
    items.replaceChildren(
      ...pageItems(state.page, state.pages).map(item => {
        if (item !== 'gap') return button(String(item), item, item === state.page);
        const gap = document.createElement('span');
        gap.className = 'gap';
        gap.setAttribute('aria-hidden', 'true');
        gap.textContent = '…';
        return gap;
      }),
    );
    setUrl();
  };

  const go = (target: number) => {
    const before = page;
    page = target;
    render();
    if (page === before || !focusTarget) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    focusTarget.focus({ preventScroll: true });
    focusTarget.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };

  prev.addEventListener('click', () => go(page - 1));
  next.addEventListener('click', () => go(page + 1));
  items.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-page]');
    if (target) go(Number(target.dataset.page));
  });
  size.addEventListener('change', () => {
    page = 1;
    render();
  });
  nav.hidden = false;

  return {
    show(rows, filtered, options = {}) {
      all = rows;
      matched = filtered;
      if (options.reset) page = 1;
      render();
    },
  };
};
