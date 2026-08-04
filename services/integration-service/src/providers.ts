import {config} from './config.js';
export type Provider='google-ads'|'ga4'|'search-console'|'meta-ads'|'tiktok-ads';
type ProviderConfig={authorizeUrl:string;tokenUrl:string;clientId?:string;clientSecret?:string;scopes:string[]};
const google:ProviderConfig={authorizeUrl:'https://accounts.google.com/o/oauth2/v2/auth',tokenUrl:'https://oauth2.googleapis.com/token',clientId:config.GOOGLE_CLIENT_ID,clientSecret:config.GOOGLE_CLIENT_SECRET,scopes:['openid','email','https://www.googleapis.com/auth/adwords','https://www.googleapis.com/auth/analytics.readonly','https://www.googleapis.com/auth/webmasters.readonly']};
export const providers:Record<Provider,ProviderConfig>={
'google-ads':google,ga4:google,'search-console':google,
'meta-ads':{authorizeUrl:'https://www.facebook.com/v25.0/dialog/oauth',tokenUrl:'https://graph.facebook.com/v25.0/oauth/access_token',clientId:config.META_CLIENT_ID,clientSecret:config.META_CLIENT_SECRET,scopes:['ads_read','business_management']},
'tiktok-ads':{authorizeUrl:'https://business-api.tiktok.com/portal/auth',tokenUrl:'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/',clientId:config.TIKTOK_CLIENT_ID,clientSecret:config.TIKTOK_CLIENT_SECRET,scopes:[]}}
export function providerConfig(provider:string){const found=providers[provider as Provider];if(!found?.clientId||!found.clientSecret)throw new Error(`Provider ${provider} is not configured`);return found}
