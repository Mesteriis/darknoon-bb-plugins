import { describe,it,expect } from 'vitest';
import { boardSchema,itemSchema,needsAttention } from './model';
import examples from './examples.json';
describe('grounded snapshot contract',()=>{
 it('accepts five timestamped snapshots in the requested 24-hour window',()=>{
  const board=boardSchema.parse({snapshots:examples});expect(board.snapshots).toHaveLength(5);
  const end=Date.parse('2026-11-11T21:45:33Z');
  for(const s of board.snapshots){expect(Date.parse(s.asOf)).toBeGreaterThan(end-86400000);expect(Date.parse(s.asOf)).toBeLessThan(end);for(const i of s.items)expect(Date.parse(i.evidence.at)).toBeLessThanOrEqual(Date.parse(s.asOf));}
 });
 it('retains non-PR parallel work, owners, completed history, deploy backlog and merge actions',()=>{
  const b=boardSchema.parse({snapshots:examples});const prep=b.snapshots[0];expect(prep.items.every(i=>i.kind==='task')).toBe(true);expect(new Set(prep.items.map(i=>i.owner.threadId)).size).toBe(2);
  const last=b.snapshots[4];expect(last.items.find(i=>i.id==='reward')).toMatchObject({prState:'merged',deployment:'queued'});expect(last.items.find(i=>i.id==='usage')?.action?.label).toBe('Merge');expect(needsAttention(last,'Judge')).toBe(2);expect(last.items.some(i=>i.lane==='Inkling'&&i.state==='done')).toBe(true);
 });
 it('rejects nonexistent lanes, future evidence, duplicate rows and Merge on a merged PR',()=>{
  const b=boardSchema.parse({snapshots:examples});const s=structuredClone(b.snapshots[0]);s.items[0].lane='missing';expect(boardSchema.safeParse({snapshots:[s]}).success).toBe(false);
  s.items[0].lane='Trainer';s.items[0].evidence.at='2030-01-01T00:00:00Z';expect(boardSchema.safeParse({snapshots:[s]}).success).toBe(false);
  const original=b.snapshots[0];expect(boardSchema.safeParse({snapshots:[{...original,items:[original.items[0],original.items[0]]}]}).success).toBe(false);
  const merged=b.snapshots[4].items.find(i=>i.prState==='merged')!;expect(itemSchema.safeParse({...merged,action:{label:'Merge',prompt:'Merge again'}}).success).toBe(false);
 });
});
