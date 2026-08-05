import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const catalogSource=await readFile(new URL('../../../packages/integrations/src/index.ts',import.meta.url),'utf8');
const brandSource=await readFile(new URL('../src/pages/integrations/integrationBrands.ts',import.meta.url),'utf8');

const catalogSlugs=[...catalogSource.matchAll(/\['([^']+)','([^']+)','(analytics|paid_ads|seo|social|ecommerce|email|call_tracking|local|database)','(oauth2|api_key|basic|file)','(stable|beta|planned)'/g)].map(match=>match[1]);
const brands=[...brandSource.matchAll(/\['([^']+)','([^']+)','(#[0-9A-F]{6})'(?:,'([^']+)')?\]/g)].map(match=>({slug:match[1],domain:match[2],color:match[3],iconSlug:match[4]}));

test('every connector has one branded logo and color record',()=>{
  assert.equal(brands.length,catalogSlugs.length);
  assert.deepEqual([...brands.map(item=>item.slug)].sort(),[...catalogSlugs].sort());
  assert.equal(new Set(brands.map(item=>item.slug)).size,brands.length);
});

test('brand records contain usable logo domains and colors',()=>{
  for(const brand of brands){
    assert.match(brand.domain,/^[a-z0-9.-]+\.[a-z]{2,}$/i,brand.slug);
    assert.match(brand.color,/^#[0-9A-F]{6}$/,brand.slug);
    if(brand.iconSlug)assert.match(brand.iconSlug,/^[a-z0-9]+$/,brand.slug);
  }
});
