export type PropertyMapping =
  | { type: 'title'; path: string }
  | { type: 'rich_text'; path: string }
  | { type: 'number'; path: string }
  | { type: 'select'; path: string; map?: Record<string, string> }
  | { type: 'multi_select'; path: string; map?: Record<string, string> }
  | { type: 'date'; path: string }
  | { type: 'checkbox'; path: string }
  | { type: 'url'; path: string }
  | { type: 'email'; path: string }
  | { type: 'phone_number'; path: string };

export type MappingConfig = {
  title: Extract<PropertyMapping, { type: 'title' }>;
  fields: Record<string, PropertyMapping>;
  match_property?: string; // Notion property name to match for upsert (e.g., external_id)
};

