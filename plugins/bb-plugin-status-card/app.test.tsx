// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {loadPluginApp,renderSlot} from '@get-bb/plugin-sdk/testing/app';
import {boardSchema} from './model';
import examples from './examples.json';
it('mounts as a bare thread composer banner and reads only that thread’s card',async()=>{
 const app=await loadPluginApp(()=>import('./app'));
 const customization=app.composerCustomizations[0];expect(customization.scopes).toEqual(['thread']);expect(customization.banners![0].chrome).toBe('bare');
 const requests:string[]=[];
 const slot=renderSlot(customization.banners![0],{}, {composer:{scope:{kind:'thread',threadId:'thr_current'}},rpc:{read:input=>{requests.push((input as {threadId:string}).threadId);return {...boardSchema.parse({snapshots:examples}),revision:1}}}});
 try{expect(await slot.findByText('Run 1A + Run 2 plans')).toBeTruthy();expect(slot.queryByText(/working \/.*agents/)).toBeNull();expect(requests).toEqual(['thr_current']);expect(slot.queryByRole('combobox')).toBeNull();expect(slot.queryByText(/History ·/)).toBeNull();expect(slot.queryByRole('group',{name:'Layout'})).toBeNull();expect(slot.queryByRole('button',{name:'Focus'})).toBeNull();}finally{slot.lifecycle.unmount()}
});
