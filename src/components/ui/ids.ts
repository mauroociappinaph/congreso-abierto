// Unique element ids for components rendered several times on one page (aria-labelledby, aria-controls).
let next = 0;

export const uid = (prefix: string) => `${prefix}-${++next}`;
