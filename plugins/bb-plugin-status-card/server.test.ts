import {it,expect} from 'vitest';
import {createFakePluginHost} from '@get-bb/plugin-sdk/testing';
import plugin from './server';
import examples from './examples.json';
it('persists per-thread cards, broadcasts updates, rejects stale writers and isolates threads',async()=>{
 const {bb,harness}=createFakePluginHost({pluginId:'status-card'});plugin(bb);
 try{
  const board={snapshots:examples};const a='thr_abc123',b='thr_def456';
  expect(await harness.behavior.callRpc('read',{threadId:a})).toBeNull();
  const first=await harness.behavior.callRpc('publish',{threadId:a,expectedRevision:0,board});expect(first).toMatchObject({revision:1});
  expect(await harness.behavior.callRpc('read',{threadId:b})).toBeNull();
  await expect(harness.behavior.callRpc('publish',{threadId:a,expectedRevision:0,board})).rejects.toThrow(/changed/);
  expect(await harness.behavior.callRpc('read',{threadId:a})).toMatchObject({revision:1});
  await expect(harness.behavior.callRpc('clear',{threadId:a,expectedRevision:0})).rejects.toThrow(/changed/);
  await harness.behavior.callRpc('clear',{threadId:a,expectedRevision:1});expect(await harness.behavior.callRpc('read',{threadId:a})).toBeNull();
 }finally{await harness.lifecycle.dispose()}
});
