import { useCallback, useEffect, useState } from 'react';
import { definePluginApp, Markdown, useRpc, useRealtime, useRealtimeConnectionState, useComposer, useBbNavigate, useComposers, experimental_useAppPanel } from '@get-bb/plugin-sdk/app';
import type { rpcContract } from './server';
import type { Stored } from './model';
import { StatusView } from './View';
export function StatusBanner(){
 const composer=useComposer(),rpc=useRpc<typeof rpcContract>(),navigate=useBbNavigate(),panel=experimental_useAppPanel();
 const threadId=composer.scope.kind==='thread'?composer.scope.threadId:null;
 const connection=useRealtimeConnectionState();
 const [result,setResult]=useState<{threadId:string;board:Stored|null}|null>(null);
 const [error,setError]=useState('');
 const refresh=useCallback(()=>{if(!threadId)return;return rpc.call('read',{threadId}).then(board=>{setResult({threadId,board});setError('')},e=>setError(String(e)))},[rpc,threadId]);
 useEffect(()=>{void refresh()},[refresh,connection]);
 useRealtime('changed',()=>{void refresh()});
 if(!threadId||result?.threadId!==threadId||!result.board)return null;
 return <><StatusView key={threadId} board={result.board} storageKey={`status-card:${threadId}`} renderChat={owner=><Markdown content={`@thread:${owner.threadId}`} className="sc-chat-mention"/>} onDetails={(decision,snapshot)=>panel.openTab({tab:{id:"decision",context:{kind:"thread"},availability:"action"},params:{decisionId:decision.id,snapshotId:snapshot.id},title:"Decision"})} onThread={id=>navigate.toThread(id)} onUrl={url=>{navigate.openUrl(url)}} onAction={prompt=>{composer.insert(prompt,{at:'end',block:true});composer.focus()}}/>{error?<button className="sc-feedback" onClick={()=>void refresh()}>Status update failed · retry</button>:null}</>;
}
export function DecisionPanel({threadId,params}:{threadId:string;params:unknown}){
 const rpc=useRpc<typeof rpcContract>(),composers=useComposers();
 const [board,setBoard]=useState<Stored|null>(null),[feedback,setFeedback]=useState('');
 const connection=useRealtimeConnectionState();
 const refresh=useCallback(()=>{void rpc.call('read',{threadId}).then(setBoard)},[rpc,threadId]);
 useEffect(refresh,[refresh,connection]);useRealtime('changed',refresh);
 const target=params&&typeof params==='object'?params as {snapshotId?:string;decisionId?:string}:{};
 const snapshot=board?.snapshots.find(s=>s.id===target.snapshotId),decision=snapshot?.decisions.find(d=>d.id===target.decisionId);
 if(!board)return <div className="sc-root">Loading…</div>;
 if(!decision||!snapshot)return <div className="sc-root">This decision is no longer pending.</div>;
 const composer=composers.find(c=>c.scope.kind==='thread'&&c.scope.threadId===threadId);
 function choose(prompt:string){if(snapshot!.mode==='historical'){setFeedback('Historical example — choice not sent');return}if(!composer){setFeedback('Open this thread’s composer to respond.');return}composer.insert(prompt,{at:'end',block:true});composer.focus();setFeedback('Added to your draft')}
 return <div className="sc-root sc-decision-panel"><h2>{decision.question}</h2><p>{decision.context||decision.evidence.quote}</p><div className="sc-panel-options">{decision.options.map(o=><button className="sc-action" key={o.label} onClick={()=>choose(o.prompt)}>{o.label}</button>)}<button className="sc-action" onClick={()=>choose(`I need more information before deciding: ${decision.question}. Explain the options, recommendation, and consequences.`)}>More info</button></div>{feedback?<p role="status">{feedback}</p>:null}</div>;
}
export default definePluginApp(app=>{app.slots.experimental_tab({id:'decision',title:'Decision',icon:'ListTodo',context:{kind:'thread'},availability:'action',component:DecisionPanel});app.composer.customize({id:'status',scopes:['thread'],banners:[{id:'work-status',chrome:'bare',component:StatusBanner}]})});
