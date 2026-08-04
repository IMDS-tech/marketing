export type ModuleStatus='planned'|'prototype'|'development'|'beta'|'stable'|'deprecated'|'disabled';

export type ModuleSurface='workspace'|'client-portal'|'superadmin'|'backend'|'shared';

export interface ModuleDefinition{
  id:string;
  name:string;
  description:string;
  status:ModuleStatus;
  surface:ModuleSurface;
  route?:string;
  permissions:string[];
  entitlements:string[];
  dependencies:string[];
  submodules:string[];
}

export interface ModuleDomain{
  id:string;
  name:string;
  description:string;
  modules:ModuleDefinition[];
}
