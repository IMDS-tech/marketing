import '@imds/integrations';

declare module '@imds/integrations'{
  interface ConnectorDefinition{
    id?:string;
  }
}
