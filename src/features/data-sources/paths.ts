// The data sources screens' URLs, for the router and for links between
// them.
export const dataSourcesPath = "/settings/data-sources";
export const newDataSourcePath = `${dataSourcesPath}/new`;
export const adapterPath = (adapterId: string) =>
  `${dataSourcesPath}/${encodeURIComponent(adapterId)}`;

// The public Agent guide.
export const agentGuidePath = "/docs/agents";
