/**
 * Contract for `GET /api/pages?site_id=&page=&page_size=` (backend `PageList` / `PageRead`).
 * Only the fields the UI reads are typed; the backend returns more.
 */
export interface PageRead {
  id: string;
  site_id: string;
  url: string;
  title: string | null;
  h1: string | null;
}

export interface PageList {
  items: PageRead[];
  total: number;
  page: number;
  page_size: number;
}
