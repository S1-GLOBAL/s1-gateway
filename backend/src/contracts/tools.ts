export interface Tool {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  /** ISO 8601. */
  createdAt: string;
}

export interface CreateToolRequest {
  name: string;
  url: string;
  description?: string;
  category: string;
}
