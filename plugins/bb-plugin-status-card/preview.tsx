import React,{useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {StatusView,layouts,timeLabel} from './View';
import {boardSchema} from './model';
import data from './examples.json';
const board={...boardSchema.parse({snapshots:data}),revision:1};
declare global{interface Window{__statusPlaygroundRoot?:Root;__statusPreviewState?:{current:number}}}
function Playground(){
 const [sample,setSample]=useState(()=>localStorage.getItem('status-playground-sample')||board.snapshots[window.__statusPreviewState?.current??0]?.id||board.snapshots[0].id);
 const [sources,setSources]=useState(false);
 const snapshot=board.snapshots.find(s=>s.id===sample)||board.snapshots[0];
 return <main><div className="playground-grid">{layouts.map((l,i)=><section key={l.id}><h2>{String.fromCharCode(65+i)} · {l.label}</h2><p>{l.description}</p><StatusView board={board} storageKey={`status-playground-${l.id}`} forcedLayout={l.id} forcedSnapshot={snapshot.id} onAction={()=>{}} onThread={()=>{}}/></section>)}</div>
 {sources?<section className="playground-evidence"><h2>Evidence · {timeLabel(snapshot.asOf)}</h2>{[...snapshot.items,...snapshot.decisions].map(i=><article key={i.id}><strong>{'title' in i?i.title:i.question}</strong><div>{timeLabel(i.evidence.at)} · @thread:{i.evidence.threadId}#msg={i.evidence.messageSeq}</div><blockquote>{i.evidence.quote}</blockquote></article>)}</section>:null}
</main>
}
let element=document.getElementById('status-playground');if(!element){document.querySelectorAll('.controls,#grid,.feedback,#toast').forEach(e=>e.remove());element=document.createElement('div');element.id='status-playground';document.body.appendChild(element)}
window.__statusPlaygroundRoot??=createRoot(element);window.__statusPlaygroundRoot.render(<Playground/>);
