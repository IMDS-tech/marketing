import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/index.ts',import.meta.url),'utf8');
const tuples=[...source.matchAll(/\['([^']+)','([^']+)','(analytics|paid_ads|seo|social|ecommerce|email|call_tracking|local|database)','(oauth2|api_key|basic|file)','(stable|beta|planned)'/g)];
const slugs=tuples.map(match=>match[1]);

test('catalog contains 90 unique connectors',()=>{
  assert.equal(slugs.length,90);
  assert.equal(new Set(slugs).size,90);
});

test('phase two connectors are present',()=>{
  for(const slug of ['google-ads','ga4','meta-ads','tiktok-ads','search-console']) assert.ok(slugs.includes(slug),slug);
});

test('catalog uses supported contracts',()=>{
  for(const match of tuples){
    assert.match(match[1],/^[a-z0-9][a-z0-9-]+$/);
    assert.ok(match[2].length>1);
  }
});
