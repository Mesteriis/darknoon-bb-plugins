import { useEffect, useState, type ReactNode } from 'react';
import { laneState, needsAttention, type Stored, type Snapshot, type Item, type Decision, type Layout } from './model';
import './style.css';
export const layouts: {id:Layout;label:string;description:string}[]=[
 {id:'lanes',label:'Focus',description:'One lane at a time, with full work titles and actions.'},
 {id:'parallel',label:'Across lanes',description:'One row per lane makes simultaneous work visible.'},
 {id:'agents',label:'By agent',description:'One row per owner shows who is working on what.'},
];
export function money(amount:number,currency='USD'){return new Intl.NumberFormat('en-US',{style:'currency',currency}).format(amount)}
export function timeLabel(at:string){return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(at))+' EST'}
type Props={designControls?:boolean;board:Stored;storageKey:string;onAction:(prompt:string)=>void;onThread:(id:string)=>void;onUrl?:(url:string)=>void;forcedLayout?:Layout;forcedSnapshot?:string;renderChat?:(owner:Item['owner'])=>ReactNode;onDetails?:(decision:Decision,snapshot:Snapshot)=>void;onEvidence?:(snapshot:Snapshot)=>void};
export function StatusView({designControls=false,board,storageKey,onAction,onThread,onUrl,forcedLayout,forcedSnapshot,onEvidence,onDetails,renderChat}:Props){
 const [prefs,setPrefs]=useState<{sample:string;lane:string;layout:Layout;page:number;decision:number}>(()=>{
  try{const p=JSON.parse(localStorage.getItem(storageKey)||'null');if(p&&['lanes','parallel','agents'].includes(p.layout))return p}catch{}
  return {sample:board.snapshots[0].id,lane:'',layout:forcedLayout||'parallel',page:0,decision:0};
 });
 const [feedback,setFeedback]=useState('');const [detailId,setDetailId]=useState<string|null>(null);const [showSources,setShowSources]=useState(false);
 useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(prefs))}catch{}},[prefs,storageKey]);
 const sample=board.snapshots.find(s=>s.id===(forcedSnapshot||prefs.sample))||board.snapshots[0];
 const layout=designControls||forcedLayout?prefs.layout:'lanes';
 const lane=sample.lanes.find(l=>l.id===prefs.lane)?.id||sample.items.find(i=>i.state==='active')?.lane||sample.lanes[0].id;
 const historical=sample.mode==='historical';
 function choose(action:{label:string;prompt:string}){
  if(historical){setFeedback(`Preview choice: ${action.label}`);return;}
  onAction(action.prompt);setFeedback('Added to your draft');
 }
 function link(url:string,children:ReactNode,title?:string,className?:string){return <a href={url} title={title} className={className} onClick={e=>{if(onUrl){e.preventDefault();onUrl(url)}}} target="_blank" rel="noopener noreferrer">{children}</a>}
 const sorted=(items:Item[])=>[...items].sort((a,b)=>Number(a.state==='done')-Number(b.state==='done'));
 function status(item:Item){
  const state=item.state==='blocked'||item.ci==='failed'||item.deployment==='failed'?'blocked':item.state==='active'?'active':item.prState==='merged'&&item.deployment!=='live'?'waiting':item.state==='done'||item.ci==='passed'?'done':item.state;
  const label=item.kind==='pr'?[item.activity,item.ci?`CI ${item.ci}`:'',item.prState==='merged'?`Merged · ${item.deployment||'deployment unknown'}`:''].filter(Boolean).join(' · '):item.state==='active'?'Work in progress':item.state;
  return <span className={`sc-task-dot ${state}`} role="img" aria-label={label} title={`${item.owner.name}: ${label}`}>{state==='done'?'✓':state==='blocked'?'!':''}</span>;
 }
 function itemRow(item:Item){if(item.kind==='metric')return <div className="sc-row sc-metric" key={item.id}><span className="sc-title">{item.url?link(item.url,item.title):item.title}</span><span className="sc-metric-value">{money(item.amount!,item.currency)}{item.activity?<span className="sc-activity"> {item.activity}</span>:null}</span>{item.url?link(item.url,'View',`View ${item.title}`,'sc-action'):null}</div>;return <div className={`sc-row ${item.state==='done'?'sc-done':''}`} key={item.id}>
  {status(item)}<span className="sc-title" title={item.title}>{item.url?link(item.url,item.title):item.title}</span>
  {item.prState==='merged'?<span className="sc-activity">Merged{item.deployment?` · ${item.deployment==='queued'?'deploy queued':item.deployment}`:''}</span>:item.activity&&!(item.kind!=='pr'&&item.state==='active')?<span className="sc-activity" title={`${item.owner.name}: ${item.activity}`}>{item.activity}</span>:null}
  {item.kind==='task'?<span className="sc-chat-pill">{renderChat?renderChat(item.owner):<button className="sc-chat-fallback" title={`Open ${item.owner.name} chat`} onClick={()=>onThread(item.owner.threadId)}>{item.owner.name}</button>}</span>:item.kind==='run'&&item.url?link(item.url,'View',`View ${item.title}`,'sc-action'):null}{item.action?<button className="sc-action" onClick={()=>choose(item.action!)}>{item.action.label}</button>:null}
 </div>}
 const laneItems=sorted(sample.items.filter(i=>i.lane===lane));
 const groups=layout==='parallel'?sample.lanes.map(l=>({key:l.id,name:l.name,items:sorted(sample.items.filter(i=>i.lane===l.id))})).filter(g=>g.items.length):Array.from(new Set(sample.items.map(i=>i.owner.threadId))).map(id=>({key:id,name:sample.items.find(i=>i.owner.threadId===id)!.owner.name,items:sorted(sample.items.filter(i=>i.owner.threadId===id))}));
 groups.sort((a,b)=>Number(a.items.every(i=>i.state==='done'))-Number(b.items.every(i=>i.state==='done')));
 const decisions=layout==='lanes'?sample.decisions.filter(d=>d.lane===lane):sample.decisions;
 const entries:({kind:'item';value:Item}|{kind:'decision';value:Decision}|{kind:'group';value:typeof groups[number]})[]=layout==='lanes'?[...laneItems.filter(i=>i.state!=='done').map(value=>({kind:'item' as const,value})),...decisions.map(value=>({kind:'decision' as const,value})),...laneItems.filter(i=>i.state==='done').map(value=>({kind:'item' as const,value}))]:[...decisions.map(value=>({kind:'decision' as const,value})),...groups.map(value=>({kind:'group' as const,value}))];
 const count=entries.length;
 const visibleCount=showSources?sample.items.length:count;
 const page=0;
 const detail=decisions.find(d=>d.id===detailId);
 const workers=new Set(sample.items.filter(i=>i.state==='active').map(i=>i.owner.threadId)).size;
 const totalWorkers=new Set(sample.items.map(i=>i.owner.threadId)).size;
 function moreInfo(d:Decision){choose({label:'More info',prompt:`I need more information before deciding: ${d.question}. Explain the options, recommendation, and consequences.`})}
 function decisionRow(d:Decision){return <div className="sc-row sc-decision-row" key={`decision-${d.id}`}><span className="sc-decision-mark" aria-label="Decision">?</span><span className="sc-title">{d.question}</span><button className="sc-action" onClick={()=>onDetails?onDetails(d,sample):setDetailId(d.id)}>Details</button></div>}
 function decisionDetails(d:Decision){return <div className="sc-detail" aria-label="Decision context"><div className="sc-detail-heading"><button className="sc-action" onClick={()=>setDetailId(null)}>Back</button><span className="sc-title" title={d.question}>{d.question}</span></div><p title={d.context||d.evidence.quote}>{d.context||d.evidence.quote}</p><div className="sc-options">{d.options.map(o=><button key={o.label} onClick={()=>choose(o)}>{o.label}</button>)}<button onClick={()=>moreInfo(d)}>More info</button><button onClick={()=>onThread(d.evidence.threadId)}>Source</button></div></div>}

 return <div className="sc-root">
  {designControls?<div className="sc-controls"><select aria-label="Historical example" value={sample.id} onChange={e=>{setPrefs({...prefs,sample:e.target.value,lane:'',page:0,decision:0});setFeedback('');setShowSources(false);setDetailId(null)}}>{board.snapshots.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select><div className="sc-modes" role="group" aria-label="Layout">{layouts.map(l=><button key={l.id} aria-pressed={layout===l.id} title={l.description} onClick={()=>setPrefs({...prefs,layout:l.id,page:0})}>{l.label}</button>)}</div></div>:forcedLayout&&layout!==forcedLayout?<button className="sc-back" onClick={()=>setPrefs({...prefs,layout:forcedLayout,page:0})}>← {layouts.find(l=>l.id===forcedLayout)?.label}</button>:null}
  <div className="sc-card">
   <div className="sc-lanes" role="tablist" aria-label="Work lanes">{sample.lanes.map(l=>{const n=needsAttention(sample,l.id),state=sample.decisions.some(d=>d.lane===l.id&&d.priority==='urgent')?'urgent':sample.decisions.some(d=>d.lane===l.id&&d.priority==='important')?'important':sample.decisions.some(d=>d.lane===l.id)?'active':laneState(sample,l.id),num=sample.items.filter(i=>i.lane===l.id&&i.state==='active').length;return <button key={l.id} className={l.summary?'sc-summary-tab':undefined} role="tab" aria-selected={layout==='lanes'&&lane===l.id} aria-label={`${l.name}: ${state}, ${num} active items, ${n} actions need you`} onClick={()=>{setPrefs({...prefs,lane:l.id,layout:'lanes',page:0,decision:0});setShowSources(false);setDetailId(null)}}><span className={`sc-status ${state} ${n?'sc-number':''}`} title={n?`${n} actions need you`:state}>{n||''}</span><span>{l.name}</span>{l.summary?<span className="sc-tab-value">{money(l.summary.amount,l.summary.currency)}</span>:null}{num>1?<small>{num}</small>:null}</button>})}</div>
   <div className="sc-work" role="tabpanel" aria-label={showSources?'Sources':layout==='lanes'?lane:layout}>
   {detail?decisionDetails(detail):entries.slice(page*3,page*3+3).map(entry=>{if(entry.kind==='decision')return decisionRow(entry.value);if(entry.kind==='item')return itemRow(entry.value);const g=entry.value;const first=g.items[0],active=g.items.filter(i=>i.state==='active').length;return <div key={g.key} className={`sc-row sc-overview ${g.items.every(i=>i.state==='done')?'sc-done':''}`}>
    <button className="sc-group" title={layout==='agents'?'Open agent thread':'Inspect lane'} onClick={()=>layout==='agents'?onThread(g.key):setPrefs({...prefs,lane:g.key,layout:'lanes',page:0})}>{g.name}</button>
    <button className="sc-summary" title={g.items.map(i=>`${i.title}: ${i.activity||i.ci||i.state}`).join('\n')} onClick={()=>setPrefs({...prefs,lane:first.lane,layout:'lanes',page:0})}>{g.items.slice(0,2).map(i=>i.title).join(' · ')}{g.items.length>2?` +${g.items.length-2}`:''}</button>
    <span className="sc-activity">{active?`${active} working`:first.prState==='merged'?'Deploy queued':first.activity||first.state}</span>
    {first.action?<button className="sc-action" onClick={()=>choose(first.action!)}>{first.action.label}</button>:null}
   </div>})}
   </div>

  </div>
  {feedback?<span className="sc-feedback" role="status">{feedback}</span>:null}
 </div>
}
