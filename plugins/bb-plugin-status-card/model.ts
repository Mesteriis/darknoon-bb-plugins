import { z } from 'zod';
const id = z.string().min(1).max(80);
const text = z.string().trim().min(1).max(160);
const threadId = z.string().regex(/^thr_[a-z0-9]+$/);
const url = z.string().url().refine(v => /^https?:\/\//.test(v), 'HTTP(S) links only');
export const evidenceSchema = z.object({ threadId, messageSeq: z.number().int().positive(), at: z.string().datetime({offset:true}), quote: z.string().min(1).max(1500) }).strict();
export const actionSchema = z.object({ label: z.string().min(1).max(40), prompt: z.string().min(1).max(2000) }).strict();
export const itemSchema = z.object({
  id, lane:id, kind:z.enum(['task','pr','run','metric']), title:text, activity:z.string().max(80),
  state:z.enum(['active','queued','waiting','review','done','blocked']),
  owner:z.object({threadId,name:z.string().min(1).max(40)}).strict(),
  evidence:evidenceSchema, url:url.optional(), ci:z.enum(['passed','queued','running','failed']).optional(),
  prState:z.enum(['open','merged','closed']).optional(), deployment:z.enum(['queued','deploying','live','failed']).optional(),
  action:actionSchema.optional(), amount:z.number().finite().nonnegative().optional(), currency:z.string().regex(/^[A-Z]{3}$/).optional(),
}).strict().superRefine((v,ctx)=>{
 if(v.kind==='metric'&&v.amount===undefined)ctx.addIssue({code:'custom',message:'Metrics need an amount'});
 if(v.kind==='pr'&&(!v.url||!v.prState))ctx.addIssue({code:'custom',message:'PRs need their URL and lifecycle state'});
 if(v.kind!=='pr'&&v.prState)ctx.addIssue({code:'custom',message:'Only PRs have a PR state'});
 if(v.prState&&v.prState!=='open'&&v.action?.label==='Merge')ctx.addIssue({code:'custom',message:'A merged or closed PR cannot offer Merge'});
});
export const decisionSchema = z.object({id,lane:id,question:text,priority:z.enum(['normal','important','urgent']).optional(),context:z.string().max(300).optional(),options:z.array(actionSchema).min(1).max(3),evidence:evidenceSchema}).strict();
export const snapshotSchema = z.object({id,title:text,asOf:z.string().datetime({offset:true}),mode:z.enum(['historical','live']),sourceThreadId:threadId,
 lanes:z.array(z.object({id,name:z.string().min(1).max(24),summary:z.object({amount:z.number().finite().nonnegative(),currency:z.string().regex(/^[A-Z]{3}$/).default('USD')}).strict().optional()}).strict()).min(1).max(8),
 items:z.array(itemSchema).max(80),decisions:z.array(decisionSchema).max(16),
}).strict().superRefine((v,ctx)=>{
 const lanes=new Set(v.lanes.map(l=>l.id));
 if(lanes.size!==v.lanes.length)ctx.addIssue({code:'custom',message:'Duplicate lane IDs'});
 for(const list of [v.items,v.decisions]){
  if(new Set(list.map(i=>i.id)).size!==list.length)ctx.addIssue({code:'custom',message:'Duplicate item or decision IDs'});
  for(const item of list){
   if(!lanes.has(item.lane))ctx.addIssue({code:'custom',message:`Unknown lane: ${item.lane}`});
   if(Date.parse(item.evidence.at)>Date.parse(v.asOf))ctx.addIssue({code:'custom',message:'Evidence cannot postdate its snapshot'});
  }
 }
});
export const boardSchema=z.object({snapshots:z.array(snapshotSchema).min(1).max(8)}).strict().refine(v=>new Set(v.snapshots.map(s=>s.id)).size===v.snapshots.length,'Duplicate snapshot IDs');
export const storedSchema=boardSchema.safeExtend({revision:z.number().int().nonnegative()});
export type Snapshot=z.infer<typeof snapshotSchema>;
export type Item=z.infer<typeof itemSchema>;
export type Decision=z.infer<typeof decisionSchema>;
export type Board=z.infer<typeof boardSchema>;
export type Stored=z.infer<typeof storedSchema>;
export type Layout='lanes'|'parallel'|'agents';
export const needsAttention=(snapshot:Snapshot,lane:string)=>snapshot.decisions.filter(d=>d.lane===lane).length+snapshot.items.filter(i=>i.lane===lane&&i.action).length;
export function laneState(snapshot:Snapshot,lane:string){const items=snapshot.items.filter(i=>i.lane===lane);return items.some(i=>i.state==='blocked')?'blocked':items.some(i=>i.state==='active')?'active':items.some(i=>['queued','waiting','review'].includes(i.state))?'waiting':items.length?'done':'unknown'}
