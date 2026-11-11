import { defineRpcContract, defineCli, cliCommand, type BbPluginApi } from '@get-bb/plugin-sdk';
import { z } from 'zod';
import { boardSchema, snapshotSchema, storedSchema, type Stored, type Board } from './model';
import examples from './examples.json';
const threadId=z.string().regex(/^thr_[a-z0-9]+$/);
export const rpcContract=defineRpcContract({
 read:{input:z.object({threadId}).strict(),output:storedSchema.nullable()},
 publish:{input:z.object({threadId,expectedRevision:z.number().int().nonnegative(),board:boardSchema}).strict(),output:storedSchema},
 clear:{input:z.object({threadId,expectedRevision:z.number().int().nonnegative()}).strict(),output:z.object({cleared:z.boolean()})},
});
export default function plugin(bb:BbPluginApi){
 let lock=Promise.resolve();
 const serial=<T,>(fn:()=>Promise<T>):Promise<T>=>{const result=lock.then(fn);lock=result.then(()=>{},()=>{});return result};
 const read=async(id:string)=>(await bb.storage.kv.get<Stored>(`board:${id}`))??null;
 async function publish(id:string,expected:number,board:Board){return serial(async()=>{
  const current=await read(id);if((current?.revision??0)!==expected)throw new Error('Status card changed; read it again before publishing.');
  const next=storedSchema.parse({...board,revision:expected+1});await bb.storage.kv.set(`board:${id}`,next);bb.realtime.publish('changed',{threadId:id});return next;
 })}
 async function clear(id:string,expected:number){return serial(async()=>{const current=await read(id);if((current?.revision??0)!==expected)throw new Error('Status card changed; read it again before clearing.');await bb.storage.kv.delete(`board:${id}`);bb.realtime.publish('changed',{threadId:id});return {cleared:!!current}})}
 bb.rpc.register(rpcContract,{read:({threadId})=>read(threadId),publish:({threadId,expectedRevision,board})=>publish(threadId,expectedRevision,board),clear:({threadId,expectedRevision})=>clear(threadId,expectedRevision)});
 bb.agents.registerTool({name:'status_card_read',description:'Read this thread’s pinned status card and revision.',parameters:z.object({}).strict(),execute:async(_,ctx)=>JSON.stringify(await read(ctx.threadId))});
 bb.agents.registerTool({name:'status_card_publish',description:'Pin or update this thread’s evidence-backed work lanes, tasks, PR lifecycle and decisions above the composer. Read first and supply the current revision; retain unfinished work.',parameters:z.object({expectedRevision:z.number().int().nonnegative(),snapshot:snapshotSchema}).strict(),execute:async({expectedRevision,snapshot},ctx)=>{const result=await publish(ctx.threadId,expectedRevision,{snapshots:[snapshot]});return JSON.stringify({revision:result.revision,items:snapshot.items.length,decisions:snapshot.decisions.length})}});
 bb.agents.registerTool({name:'status_card_clear',description:'Remove this thread’s pinned status card only when no useful work remains or the user asks to hide it.',parameters:z.object({expectedRevision:z.number().int().nonnegative()}).strict(),execute:async({expectedRevision},ctx)=>JSON.stringify(await clear(ctx.threadId,expectedRevision))});
 bb.cli.register(defineCli({name:'status-card',summary:'Pin evidence-backed work status above the composer',commands:{
  show:cliCommand({summary:'Read the current thread card',options:{json:{type:'boolean',description:'Print JSON'}},async run(_,ctx){if(!ctx.threadId)throw Error('Run from a BB thread');return {exitCode:0,stdout:JSON.stringify(await read(ctx.threadId))}}}),
  examples:cliCommand({summary:'Install five sourced Nov 10–11 historical snapshots in this thread for design review',options:{json:{type:'boolean',description:'Print JSON'}},async run(_,ctx){if(!ctx.threadId)throw Error('Run from a BB thread');const current=await read(ctx.threadId);const result=await publish(ctx.threadId,current?.revision??0,boardSchema.parse({snapshots:examples}));return {exitCode:0,stdout:JSON.stringify({threadId:ctx.threadId,revision:result.revision,snapshots:result.snapshots.map(s=>({id:s.id,asOf:s.asOf}))})}}}),
  hide:cliCommand({summary:'Hide the current thread card',options:{json:{type:'boolean',description:'Print JSON'}},async run(_,ctx){if(!ctx.threadId)throw Error('Run from a BB thread');const current=await read(ctx.threadId);return {exitCode:0,stdout:JSON.stringify(await clear(ctx.threadId,current?.revision??0))}}}),
 }}));
}
