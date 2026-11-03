// Browser-only: fills and opens the <dialog id="detail"> rendered by DetailDialog.astro.
import type { ClientItem } from './view.ts';

export function openDetail(item: ClientItem): void {
  const dialog = document.querySelector<HTMLDialogElement>('#detail')!;
  const photo = dialog.querySelector<HTMLImageElement>('.detail-photo')!;
  const fields = dialog.querySelector('.detail-fields')!;

  dialog.querySelector('.detail-title')!.textContent = item.nombre;
  photo.hidden = !item.foto;
  if (item.foto) photo.src = item.foto;
  else photo.removeAttribute('src');

  fields.replaceChildren(
    ...item.detail.flatMap(([label, value]) => {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      return [dt, dd];
    }),
  );
  dialog.querySelector('.detail-note')!.textContent = item.detailNote;
  dialog.querySelector<HTMLAnchorElement>('.detail-link')!.href = item.url;
  dialog.showModal();
}
