/** Backend `PageSummary`: the page fields embedded in a suggestion detail. */
export interface PageSummary {
  id: string;
  url: string;
  title: string | null;
  h1: string | null;
}

/**
 * Contract for `GET /api/pages?site_id=&page=&page_size=` (backend `PageList` / `PageRead`).
 * Only the fields the UI reads are typed; the backend returns more.
 */
export interface PageRead extends PageSummary {
  site_id: string;
}

export interface PageList {
  items: PageRead[];
  total: number;
  page: number;
  page_size: number;
}
