import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAuthRedirectUrl,parseAuthRedirectState,sanitizeAuthRedirectUrl} from './redirect-state.ts';

test('builds OAuth redirect URL with flow marker',()=>{
  const url=buildAuthRedirectUrl('https://app.imds.tech','google','/');
  assert.equal(url,'https://app.imds.tech/?auth_flow=google');
});

test('parses OAuth callback success',()=>{
  const state=parseAuthRedirectState('https://app.imds.tech/?code=abc&auth_flow=azure');
  assert.deepEqual(state,{status:'success',flow:'azure',message:null,errorCode:null});
});

test('parses recovery callback',()=>{
  const state=parseAuthRedirectState('https://app.imds.tech/#access_token=abc&type=recovery');
  assert.equal(state.status,'success');
  assert.equal(state.flow,'recovery');
});

test('parses confirmation callback',()=>{
  const state=parseAuthRedirectState('https://app.imds.tech/?token_hash=abc&type=signup');
  assert.equal(state.status,'success');
  assert.equal(state.flow,'confirmation');
});

test('parses provider error and decodes message',()=>{
  const state=parseAuthRedirectState('https://app.imds.tech/?error=access_denied&error_description=User+cancelled&auth_flow=google');
  assert.deepEqual(state,{status:'error',flow:'google',message:'User cancelled',errorCode:'access_denied'});
});

test('sanitizes secrets from callback URL',()=>{
  const sanitized=sanitizeAuthRedirectUrl('https://app.imds.tech/dashboard?code=abc&keep=1#access_token=secret&tab=settings');
  assert.equal(sanitized,'/dashboard?keep=1#tab=settings');
});
