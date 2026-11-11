// @vitest-environment jsdom
import { afterEach,it,expect,vi } from 'vitest';
import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import { StatusView } from './View';
import { boardSchema } from './model';
import examples from './examples.json';
const board={...boardSchema.parse({snapshots:examples}),revision:1};
afterEach(()=>{cleanup();localStorage.clear()});
function mount(){const onAction=vi.fn();const result=render(<StatusView designControls board={board} storageKey="test" onAction={onAction} onThread={()=>{}}/>);return {...result,onAction}}
it('shows distinct agent ownership and numeric attention, without pretending tasks are agents',()=>{
 mount();expect(screen.queryByText(/working \/.*agents/)).toBeNull();fireEvent.click(screen.getByText('By agent'));expect(screen.getByRole('tabpanel').children).toHaveLength(2);
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'outage'}});const judge=screen.getByRole('tab',{name:/Judge:/});expect(judge.textContent).toContain('2');fireEvent.click(judge);expect(screen.getByRole('button',{name:'Merge'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Details'}));expect(screen.getByRole('button',{name:'More info'})).toBeTruthy();expect(screen.queryByText('Wait')).toBeNull();
});
it('historical Merge is a simulation, live Merge only drafts a request and does not remove the row',()=>{
 const {onAction,rerender}=mount();fireEvent.change(screen.getByRole('combobox'),{target:{value:'outage'}});fireEvent.click(screen.getByRole('tab',{name:/Judge:/}));fireEvent.click(screen.getByRole('button',{name:'Merge'}));expect(onAction).not.toHaveBeenCalled();expect(screen.getByText(/Preview choice: Merge/)).toBeTruthy();
 const live={...board,snapshots:[{...board.snapshots[4],mode:'live' as const}]};rerender(<StatusView designControls board={live} storageKey="test" onAction={onAction} onThread={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'Merge'}));expect(onAction).toHaveBeenCalledOnce();expect(screen.getByText('#459 · Recalibration usage')).toBeTruthy();
});
it('persists internal layout and sample without exposing evidence controls',()=>{
 const view=mount();fireEvent.change(screen.getByRole('combobox'),{target:{value:'outage'}});fireEvent.click(screen.getByText('By agent'));view.unmount();mount();expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('outage');expect(screen.getByRole('button',{name:'By agent'}).getAttribute('aria-pressed')).toBe('true');
 expect(screen.queryByText(/History ·/)).toBeNull();
});

it('task progress uses an outlined status marker and a named chat pill targets the owning agent',()=>{
 const onThread=vi.fn();render(<StatusView board={board} storageKey="task-test" onAction={()=>{}} onThread={onThread}/>);
 expect(screen.getByRole('img',{name:'Work in progress'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Trainer'}));expect(onThread).toHaveBeenCalledWith('thr_zjdtb9ci9b');
});

it('run items align with tasks and View opens their platform page; completion has a check',()=>{
 const current={...board,snapshots:[board.snapshots[3]]};render(<StatusView board={current} storageKey="run-test" onAction={()=>{}} onThread={()=>{}}/>);
 fireEvent.click(screen.getByRole('tab',{name:/Trainer:/}));
 expect(screen.getByRole('link',{name:'View'}).getAttribute('href')).toBe('https://data.fieldwork.software/manage/training/rl_b0c32366');
 expect(screen.getByRole('img',{name:'done'}).textContent).toBe('✓');
});
it('Spend keeps the total in its tab, shows the sourced breakdown and links Run Two without task rings',()=>{
 const current={...board,snapshots:[board.snapshots[4]]};render(<StatusView board={current} storageKey="spend-test" onAction={()=>{}} onThread={()=>{}}/>);
 const tab=screen.getByRole('tab',{name:/Spend:/});expect(tab.textContent).toBe('Spend$679.93');expect(tab.querySelector('.sc-status.done')).not.toBeNull();fireEvent.click(tab);
 expect(screen.getByText('Tinker')).toBeTruthy();expect(screen.getByText('$428.09')).toBeTruthy();expect(screen.getByText('$251.83')).toBeTruthy();expect(screen.getByText('final')).toBeTruthy();expect(screen.getByRole('link',{name:'View'}).getAttribute('href')).toContain('/training/rl_b0c32366');expect(screen.getByRole('tabpanel').querySelector('.sc-task-dot')).toBeNull();
});

it('decisions share the normal list and context replaces its fixed work area',()=>{
 const {container}=mount();fireEvent.change(screen.getByRole('combobox'),{target:{value:'outage'}});fireEvent.click(screen.getByRole('tab',{name:/Judge:/}));
 const work=screen.getByRole('tabpanel');expect(work.querySelector('.sc-decision-row')).toBeTruthy();expect(container.querySelector('.sc-card > .sc-decision')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Details'}));expect(screen.getByText(/About a dozen manual stages/)).toBeTruthy();expect(screen.getByRole('button',{name:'More info'})).toBeTruthy();expect(screen.getByRole('tabpanel')).toBe(work);
 fireEvent.click(screen.getByRole('button',{name:'Back'}));expect(screen.getByRole('button',{name:'Merge'})).toBeTruthy();
});

it('PR status occupies the leading position with no extra CI mark near Merge',()=>{
 render(<StatusView board={{...board,snapshots:[board.snapshots[4]]}} storageKey="pr-test" onAction={()=>{}} onThread={()=>{}}/>);
 fireEvent.click(screen.getByRole('tab',{name:/Platform:/}));
 const rows=screen.getByRole('tabpanel').querySelectorAll('.sc-row');
 for(const row of Array.from(rows)){expect(row.firstElementChild?.classList.contains('sc-task-dot')).toBe(true);expect(row.querySelector('.sc-ci')).toBeNull()}
});
it('delegates Details to the native panel without replacing card rows',()=>{
 const onDetails=vi.fn();render(<StatusView board={{...board,snapshots:[board.snapshots[4]]}} storageKey="panel-test" onAction={()=>{}} onThread={()=>{}} onDetails={onDetails}/>);
 fireEvent.click(screen.getByRole('tab',{name:/Judge:/}));fireEvent.click(screen.getByRole('button',{name:'Details'}));
 expect(onDetails).toHaveBeenCalledOnce();expect(screen.getByRole('button',{name:'Merge'})).toBeTruthy();expect(screen.queryByRole('button',{name:'Back'})).toBeNull();
});
