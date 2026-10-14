/** A tool as the frontend works with it. Independent of the wire format. */
export interface Tool {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  createdAt: Date;
}

export interface NewTool {
  name: string;
  url: string;
  description: string;
  category: string;
}
