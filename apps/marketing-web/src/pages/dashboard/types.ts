export type WidgetType = 'stat' | 'line' | 'bar' | 'pie' | 'table';

export type WidgetFilters = {
  entityType?: string;
  search?: string;
};

export type WidgetSettings = {
  breakdown?: 'none' | 'integration' | 'entity';
};

export type DashboardWidget = {
  id: string;
  section_id: string;
  type: WidgetType;
  metric_key: string | null;
  integration_slug: string | null;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string | null;
  date_range_json: Record<string, unknown>;
  filters_json: WidgetFilters;
  settings_json: WidgetSettings;
};

export type DashboardModel = {
  id: string;
  name: string;
  client_id: string;
  sections: Array<{
    id: string;
    title: string;
    widgets: DashboardWidget[];
  }>;
};

export type MetricOption = {
  metric_key: string;
  label: string;
  data_type: string;
  format: string;
  category: string;
};

export type IntegrationOption = {
  slug: string;
  name: string;
};

export type WidgetSeriesRow = {
  metric_date: string;
  breakdown_key: string;
  breakdown_label: string;
  value: number;
};
