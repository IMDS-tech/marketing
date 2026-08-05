import {useState,type CSSProperties}from'react';
import type{ConnectorCategory}from'@imds/integrations';
import{faviconUrl,getIntegrationBrand,simpleIconUrl}from'./integrationBrands';
import'./integrationBrandColors.css';

const categoryColors:Record<ConnectorCategory,string>={analytics:'#7C3AED',paid_ads:'#2563EB',seo:'#059669',social:'#DB2777',ecommerce:'#16A34A',email:'#EA580C',call_tracking:'#0891B2',local:'#CA8A04',database:'#475569'};

function contrastColor(hex:string):'#000000'|'#FFFFFF'{
  const value=hex.replace('#','');
  const red=parseInt(value.slice(0,2),16);
  const green=parseInt(value.slice(2,4),16);
  const blue=parseInt(value.slice(4,6),16);
  const luminance=(red*299+green*587+blue*114)/1000;
  return luminance>=150?'#000000':'#FFFFFF';
}

export function integrationBrandStyle(slug:string,category:ConnectorCategory):CSSProperties{
  const brandColor=getIntegrationBrand(slug)?.color??categoryColors[category];
  const contrast=contrastColor(brandColor);
  return {
    '--connector-accent':brandColor,
    '--connector-surface':brandColor,
    '--connector-border':brandColor,
    '--connector-foreground':contrast,
    '--connector-logo-surface':contrast,
    '--connector-logo-foreground':brandColor,
    '--connector-button-background':contrast,
    '--connector-button-foreground':brandColor,
    '--connector-shadow':'0 13px 30px rgba(15,23,42,.18)',
  }as CSSProperties;
}

type Props={slug:string;name:string;category:ConnectorCategory};
const logoStyle:CSSProperties={width:34,height:34,objectFit:'contain',display:'block'};

export function IntegrationBrandMark({slug,name}:Props){
  const brand=getIntegrationBrand(slug);
  const primary=brand?simpleIconUrl(brand):undefined;
  const fallback=brand?faviconUrl(brand.domain):undefined;
  const[logo,setLogo]=useState(primary??fallback);
  const[failed,setFailed]=useState(false);
  const letters=name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase();

  if(!logo||failed)return <span className="connector-brand-mark connector-brand-fallback" aria-label={`${name} logo`}>{letters}</span>;

  return <span className="connector-brand-mark"><img style={logoStyle} src={logo} alt={`${name} logo`} loading="lazy" referrerPolicy="no-referrer" onError={()=>{if(fallback&&logo!==fallback)setLogo(fallback);else setFailed(true)}}/></span>;
}
