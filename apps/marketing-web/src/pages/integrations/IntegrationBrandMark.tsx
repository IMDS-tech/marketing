import {useState,type CSSProperties}from'react';
import type{ConnectorCategory}from'@imds/integrations';
import{faviconUrl,getIntegrationBrand,simpleIconUrl}from'./integrationBrands';

const categoryColors:Record<ConnectorCategory,string>={analytics:'#7C3AED',paid_ads:'#2563EB',seo:'#059669',social:'#DB2777',ecommerce:'#16A34A',email:'#EA580C',call_tracking:'#0891B2',local:'#CA8A04',database:'#475569'};

export function integrationBrandStyle(slug:string,category:ConnectorCategory):CSSProperties{
  const accent=getIntegrationBrand(slug)?.color??categoryColors[category];
  return {
    '--connector-accent':accent,
    '--connector-surface':`color-mix(in srgb, ${accent} 6%, var(--surface,#fff))`,
    '--connector-border':`color-mix(in srgb, ${accent} 22%, var(--border,#e5e7eb))`,
    '--connector-foreground':`color-mix(in srgb, ${accent} 54%, var(--foreground,#111827))`,
    '--connector-logo-surface':`color-mix(in srgb, ${accent} 10%, #fff)`,
    '--connector-logo-foreground':accent,
    '--connector-shadow':`0 13px 30px color-mix(in srgb, ${accent} 10%, rgba(15,23,42,.07))`,
  }as CSSProperties;
}

type Props={slug:string;name:string;category:ConnectorCategory};

export function IntegrationBrandMark({slug,name}:Props){
  const brand=getIntegrationBrand(slug);
  const primary=brand?simpleIconUrl(brand):undefined;
  const fallback=brand?faviconUrl(brand.domain):undefined;
  const[logo,setLogo]=useState(primary??fallback);
  const[failed,setFailed]=useState(false);
  const letters=name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase();

  if(!logo||failed)return <span className="connector-brand-mark connector-brand-fallback" aria-label={`${name} logo`}>{letters}</span>;

  return <span className="connector-brand-mark"><img src={logo} alt={`${name} logo`} loading="lazy" referrerPolicy="no-referrer" onError={()=>{if(fallback&&logo!==fallback)setLogo(fallback);else setFailed(true)}}/></span>;
}
