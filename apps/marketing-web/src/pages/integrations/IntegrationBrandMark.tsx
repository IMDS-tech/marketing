import type{CSSProperties,ReactNode}from'react';
import type{ConnectorCategory}from'@imds/integrations';

type BrandTone={accent:string;surface:string;border:string;foreground:string;logoSurface:string;logoForeground:string;dark?:boolean};

const categoryTone:Record<ConnectorCategory,BrandTone>={
  analytics:{accent:'#7c3aed',surface:'#faf7ff',border:'#e9ddff',foreground:'#3b176f',logoSurface:'#f0e8ff',logoForeground:'#6d28d9'},
  paid_ads:{accent:'#2563eb',surface:'#f6f9ff',border:'#dbe7ff',foreground:'#173b79',logoSurface:'#eaf1ff',logoForeground:'#1d4ed8'},
  seo:{accent:'#059669',surface:'#f4fcf8',border:'#d4f3e5',foreground:'#14523f',logoSurface:'#e4f8ef',logoForeground:'#047857'},
  social:{accent:'#db2777',surface:'#fff7fb',border:'#f9d8e9',foreground:'#7a1b49',logoSurface:'#fde8f3',logoForeground:'#be185d'},
  ecommerce:{accent:'#16a34a',surface:'#f6fcf7',border:'#d9f1df',foreground:'#245a32',logoSurface:'#e8f7ec',logoForeground:'#15803d'},
  email:{accent:'#ea580c',surface:'#fff9f5',border:'#fde4d3',foreground:'#74351a',logoSurface:'#ffeddf',logoForeground:'#c2410c'},
  call_tracking:{accent:'#0891b2',surface:'#f4fbfd',border:'#d2eef4',foreground:'#164e63',logoSurface:'#dff5fa',logoForeground:'#0e7490'},
  local:{accent:'#ca8a04',surface:'#fffdf4',border:'#f7eabf',foreground:'#694d0c',logoSurface:'#fff5cc',logoForeground:'#a16207'},
  database:{accent:'#475569',surface:'#f8fafc',border:'#e2e8f0',foreground:'#334155',logoSurface:'#e9eef5',logoForeground:'#334155'},
};

const brandTone:Record<string,BrandTone>={
  'google-ads':{accent:'#4285f4',surface:'#f7faff',border:'#dbe7ff',foreground:'#163b72',logoSurface:'#fff',logoForeground:'#1a73e8'},
  ga4:{accent:'#f9ab00',surface:'#fffaf0',border:'#fde7b0',foreground:'#6f4800',logoSurface:'#fff4d6',logoForeground:'#e37400'},
  'search-console':{accent:'#458cf5',surface:'#f6f9ff',border:'#d9e6ff',foreground:'#183f78',logoSurface:'#eaf1ff',logoForeground:'#2563eb'},
  'meta-ads':{accent:'#0866ff',surface:'#f5f9ff',border:'#d5e5ff',foreground:'#123d7a',logoSurface:'#e8f1ff',logoForeground:'#0866ff'},
  facebook:{accent:'#0866ff',surface:'#f5f9ff',border:'#d5e5ff',foreground:'#123d7a',logoSurface:'#e8f1ff',logoForeground:'#0866ff'},
  'tiktok-ads':{accent:'#fe2c55',surface:'#111317',border:'#292d35',foreground:'#f8fafc',logoSurface:'#050609',logoForeground:'#fff',dark:true},
  tiktok:{accent:'#25f4ee',surface:'#111317',border:'#292d35',foreground:'#f8fafc',logoSurface:'#050609',logoForeground:'#fff',dark:true},
  instagram:{accent:'#d946ef',surface:'#fff7fc',border:'#f4d7ed',foreground:'#711b60',logoSurface:'#fdeaf7',logoForeground:'#c026d3'},
  linkedin:{accent:'#0a66c2',surface:'#f5faff',border:'#d8e9f8',foreground:'#164a72',logoSurface:'#e8f3fb',logoForeground:'#0a66c2'},
  'linkedin-ads':{accent:'#0a66c2',surface:'#f5faff',border:'#d8e9f8',foreground:'#164a72',logoSurface:'#e8f3fb',logoForeground:'#0a66c2'},
  youtube:{accent:'#ff0000',surface:'#fff7f7',border:'#ffd9d9',foreground:'#7a1e1e',logoSurface:'#ffe8e8',logoForeground:'#e60000'},
  shopify:{accent:'#7ab55c',surface:'#f8fcf5',border:'#dcefd2',foreground:'#355a23',logoSurface:'#eaf6e4',logoForeground:'#5c8f3f'},
  stripe:{accent:'#635bff',surface:'#f8f7ff',border:'#e2dfff',foreground:'#37307d',logoSurface:'#eceaff',logoForeground:'#635bff'},
  hubspot:{accent:'#ff7a59',surface:'#fff8f5',border:'#ffe0d8',foreground:'#7d3625',logoSurface:'#ffece6',logoForeground:'#e85d3d'},
  mailchimp:{accent:'#ffe01b',surface:'#fffdf0',border:'#f5eaa6',foreground:'#4f4300',logoSurface:'#fff5aa',logoForeground:'#241c15'},
  'amazon-ads':{accent:'#ff9900',surface:'#fffaf3',border:'#f8e0bd',foreground:'#61420d',logoSurface:'#fff0d8',logoForeground:'#232f3e'},
  postgresql:{accent:'#336791',surface:'#f5f9fc',border:'#d7e5ee',foreground:'#24485f',logoSurface:'#e6f0f6',logoForeground:'#336791'},
  mysql:{accent:'#00758f',surface:'#f4fafb',border:'#d1e9ee',foreground:'#22505c',logoSurface:'#e1f2f5',logoForeground:'#00758f'},
};

export function integrationBrandStyle(slug:string,category:ConnectorCategory):CSSProperties{
  const tone=brandTone[slug]??categoryTone[category];
  return {
    '--connector-accent':tone.accent,
    '--connector-surface':tone.surface,
    '--connector-border':tone.border,
    '--connector-foreground':tone.foreground,
    '--connector-logo-surface':tone.logoSurface,
    '--connector-logo-foreground':tone.logoForeground,
    '--connector-shadow':tone.dark?'0 16px 34px rgba(2,6,23,.22)':'0 13px 30px rgba(15,23,42,.07)',
  }as CSSProperties;
}

function GoogleAdsMark(){return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="34" cy="35" r="7" fill="#4285F4"/><path d="M13 37 27.8 11.3a7 7 0 0 1 12.1 7L25.1 44H13Z" fill="#34A853"/><path d="M8.1 18.3a7 7 0 0 1 12.1-7L35 37H18.8Z" fill="#FBBC04"/></svg>}
function GoogleAnalyticsMark(){return <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="28" width="9" height="13" rx="4.5" fill="#F9AB00"/><rect x="21" y="18" width="9" height="23" rx="4.5" fill="#F9AB00"/><rect x="34" y="7" width="8" height="34" rx="4" fill="#E37400"/></svg>}
function SearchConsoleMark(){return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 14h26a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z" fill="#4285F4"/><path d="M17 14v-3a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3" fill="none" stroke="#174EA6" strokeWidth="4"/><path d="M17 27h14M17 33h9" stroke="#fff" strokeWidth="3" strokeLinecap="round"/><circle cx="34" cy="29" r="5" fill="#fff"/><path d="m37.8 32.8 4.2 4.2" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>}
function MetaMark(){return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 31c0-8.8 4.2-18 10-18 4.5 0 7.6 5.2 10 9.4C28.5 18.2 31.7 13 36 13c6 0 9 8.6 9 15.7 0 4.8-1.6 8.3-5 8.3-4.7 0-8.2-6.8-11.3-12.3C25.5 30.4 22 37 17 37c-7.1 0-11-2.3-11-6Z" fill="none" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
function TikTokMark(){return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M28 7c1.1 6 4.5 9.4 10 10.5v7c-3.7-.1-7-1.2-10-3.4v11.4C28 39.4 22.7 44 16.5 44S5 39.2 5 32.8 10.2 21.5 16.5 21.5c1.2 0 2.4.2 3.5.6v7.2a6 6 0 0 0-3.5-1.2c-2.8 0-5 2.1-5 4.8s2.2 4.7 5 4.7c3.2 0 5-2.1 5-5.3V7Z" fill="#25F4EE" transform="translate(-1 1)"/><path d="M30 5c1.1 6 4.5 9.4 10 10.5v7c-3.7-.1-7-1.2-10-3.4v11.4C30 37.4 24.7 42 18.5 42S7 37.2 7 30.8 12.2 19.5 18.5 19.5c1.2 0 2.4.2 3.5.6v7.2a6 6 0 0 0-3.5-1.2c-2.8 0-5 2.1-5 4.8s2.2 4.7 5 4.7c3.2 0 5-2.1 5-5.3V5Z" fill="#FE2C55"/><path d="M29 6c1.1 6 4.5 9.4 10 10.5v3.2c-4.4-.7-8-2.9-10-5.6v17.4C29 38.4 23.7 43 17.5 43c-3.3 0-6.3-1.4-8.4-3.7a11.3 11.3 0 0 0 8.4 3.2c6.2 0 11.5-4.6 11.5-11.5Z" fill="#fff" opacity=".96"/></svg>}
function YouTubeMark(){return <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="11" width="40" height="26" rx="8" fill="#FF0000"/><path d="m20 18 12 6-12 7Z" fill="#fff"/></svg>}
function LinkedInMark(){return <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="6" width="36" height="36" rx="5" fill="#0A66C2"/><circle cx="16" cy="17" r="3" fill="#fff"/><path d="M13 22h6v14h-6Zm10 0h5v2c1.6-1.8 3.4-2.6 5.5-2.6 4.2 0 6.5 2.8 6.5 7.5V36h-6v-6.3c0-2.2-.8-3.6-2.7-3.6-2.1 0-2.8 1.5-2.8 4.2V36H23Z" fill="#fff"/></svg>}
function InstagramMark(){return <svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="ig" x1="7" y1="41" x2="41" y2="7" gradientUnits="userSpaceOnUse"><stop stopColor="#FEDA75"/><stop offset=".35" stopColor="#FA7E1E"/><stop offset=".65" stopColor="#D62976"/><stop offset="1" stopColor="#4F5BD5"/></linearGradient></defs><rect x="7" y="7" width="34" height="34" rx="10" fill="url(#ig)"/><circle cx="24" cy="24" r="8" fill="none" stroke="#fff" strokeWidth="3"/><circle cx="34" cy="14" r="2" fill="#fff"/></svg>}
function ShopifyMark(){return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="m11 14 6-2 3-6h7l3 4 8 3-4 29-24-4Z" fill="#95BF47"/><path d="M28 10c-1-3-3-5-6-5-4 0-7 4-8 9" fill="none" stroke="#5E8E3E" strokeWidth="2"/><path d="M28 19c-2-1-4-2-6-2-3 0-5 2-5 5 0 6 8 5 8 9 0 2-2 3-4 3-3 0-5-1-7-3l2-5c2 2 4 3 6 3 1 0 2-.5 2-1.5 0-3-8-2-8-9 0-4 3-7 8-7 3 0 5 1 7 2Z" fill="#fff"/></svg>}
function StripeMark(){return <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="5" width="38" height="38" rx="10" fill="#635BFF"/><path d="M31 18c-2-1-4-1.5-6-1.5-2 0-3 .7-3 1.8 0 3 11 1.3 11 9.2 0 5-4 8-10 8-3 0-6-.7-8-2l1.5-5c2.3 1.4 4.8 2.1 7 2.1 2 0 3.2-.7 3.2-1.9 0-3.2-11-1.6-11-9.4 0-4.8 3.7-7.8 9.7-7.8 2.5 0 5 .5 7 1.4Z" fill="#fff"/></svg>}

const marks:Record<string,()=>ReactNode>={
  'google-ads':GoogleAdsMark,ga4:GoogleAnalyticsMark,'search-console':SearchConsoleMark,'meta-ads':MetaMark,facebook:MetaMark,'tiktok-ads':TikTokMark,tiktok:TikTokMark,youtube:YouTubeMark,linkedin:LinkedInMark,'linkedin-ads':LinkedInMark,instagram:InstagramMark,shopify:ShopifyMark,stripe:StripeMark,
};

export function IntegrationBrandMark({slug,name,category}:{slug:string;name:string;category:ConnectorCategory}){
  const Mark=marks[slug];
  if(Mark)return <span className="connector-brand-mark" aria-label={`${name} logo`} role="img"><Mark/></span>;
  const letters=name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase();
  return <span className="connector-brand-mark connector-brand-fallback" aria-hidden="true">{letters||category.slice(0,2).toUpperCase()}</span>;
}
