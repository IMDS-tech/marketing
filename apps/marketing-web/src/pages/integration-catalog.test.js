import test from 'node:test';
import assert from 'node:assert/strict';
import {filterConnectorCatalog,getConnectorAvailability} from './integration-catalog.ts';

const connectors=[
  {slug:'meta-ads',name:'Meta Ads',category:'paid_ads',authType:'oauth2',scopes:[],lifecycle:'beta'},
  {slug:'ga4',name:'Google Analytics 4',category:'analytics',authType:'oauth2',scopes:[],lifecycle:'beta'},
  {slug:'stripe',name:'Stripe',category:'ecommerce',authType:'api_key',scopes:[],lifecycle:'planned'},
];

test('catalog filters by query and category',()=>{
  assert.deepEqual(filterConnectorCatalog(connectors,'google','analytics',false).map(item=>item.slug),['ga4']);
});

test('only available returns server-supported OAuth connectors',()=>{
  assert.deepEqual(filterConnectorCatalog(connectors,'','all',true).map(item=>item.slug),['meta-ads','ga4']);
});

test('availability distinguishes planned and unsupported connectors',()=>{
  assert.equal(getConnectorAvailability(connectors[2]),'planned');
  assert.equal(getConnectorAvailability({...connectors[0],slug:'unknown-oauth'}),'unsupported');
});
