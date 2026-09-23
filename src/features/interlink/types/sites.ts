/** Contract for `GET /api/sites` (backend `SiteRead[]`). */
export interface Site {
  id: string;
  name: string;
  base_url: string;
  default_language: string | null;
  default_region: string | null;
  created_at: string;
  updated_at: string;
}
