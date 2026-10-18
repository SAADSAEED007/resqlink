import {test,expect,type Page} from '@playwright/test';
import {applyDemoAction,createDemoEnvironment,eligibleDemoTeam} from '../src/components/dashboard/demo-environment';
import {filterDemoIncidents} from '../src/components/dashboard/incident-filters';
import {MOCK_INCIDENTS,MOCK_RESCUE_TEAMS} from '../src/components/dashboard/mock-data';
import type {Incident,RescueTeam} from '../src/types/api';

async function auth(page:Page) {
  const writes:string[]=[];
  await page.route('http://localhost:4000/v1/**',r=>r.fulfill({json:{success:true,data:{_id:'012345678901234567890123',name:'QA Coordinator',role:'admin',email:'qa@example.com'}}}));
  await page.route('http://localhost:4000/api/**',r=>{if(r.request().method()!=='GET')writes.push(r.request().url());return r.fulfill({json:{success:true,data:{items:[],pagination:{page:1,limit:20,total:0,totalPages:1}}}});});
  return writes;
}
test('demo transitions are atomic, reject busy/offline teams, and reset isolated fixtures',()=>{
  const state=createDemoEnvironment(); const incident=state.incidents.find(i=>i.status==='PENDING'&&i.emergencyType==='STRANDED')!;
  const team=state.teams.find(t=>eligibleDemoTeam(incident,t))!;
  const assigned=applyDemoAction(state,{type:'assign',incidentId:incident._id,teamId:team._id});
  expect(state.incidents.find(i=>i._id===incident._id)?.status).toBe('PENDING');
  expect(assigned.incidents.find(i=>i._id===incident._id)?.status).toBe('ASSIGNED');
  expect(assigned.teams.find(t=>t._id===team._id)?.status).toBe('BUSY');
  expect(()=>applyDemoAction(assigned,{type:'assign',incidentId:incident._id,teamId:team._id})).toThrow();
  expect(()=>applyDemoAction(assigned,{type:'availability',teamId:team._id,status:'AVAILABLE'})).toThrow();
  expect(()=>applyDemoAction(assigned,{type:'status',incidentId:incident._id,status:'RESOLVED'})).toThrow();
  const progressing=applyDemoAction(assigned,{type:'status',incidentId:incident._id,status:'IN_PROGRESS'});
  const resolved=applyDemoAction(progressing,{type:'status',incidentId:incident._id,status:'RESOLVED'});
  expect(resolved.teams.find(t=>t._id===team._id)).toMatchObject({status:'AVAILABLE',currentIncident:null});
  expect(resolved.assignments.find(a=>a.incidentId===incident._id)).toMatchObject({status:'COMPLETED'});
  expect(resolved.activity).toHaveLength(3);
  expect(applyDemoAction(resolved,{type:'reset'}).activity).toHaveLength(0);
});
test('filters combine with AND, missing verification is not verified, priority order is explicit',()=>{
  const records=createDemoEnvironment().incidents;
  expect(filterDemoIncidents(records,{search:'flood',status:'PENDING',priority:'CRITICAL',verification:'VERIFIED'})).toHaveLength(0);
  const verified=records.map(i=>({...i,verification:{status:'VERIFIED' as const,requiresManualReview:false,isPotentialDuplicate:false,potentialDuplicateIncidents:[],missingFields:[],warnings:[]}}));
  const result=filterDemoIncidents(verified,{search:'flood',status:'PENDING',priority:'CRITICAL',verification:'VERIFIED'});
  expect(result.length).toBeGreaterThan(0);for(const i of result)expect(i).toMatchObject({status:'PENDING',priorityLevel:'CRITICAL',verification:{status:'VERIFIED'}});
  expect(filterDemoIncidents(records,{search:'zzzz'})).toHaveLength(0);
  const sorted=filterDemoIncidents(records,{sort:'priority'});expect(sorted[0].priorityLevel).toBe('CRITICAL');
});
test('default demo permits full incident workflow, updates assignments and teams, and sends no API mutations',async({page})=>{
  const writes=await auth(page);await page.goto('/dashboard'); await expect(page.getByText('Demo Mode Active',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Incidents',exact:true}).click();
  const row=page.locator('.rqIncidentRow').filter({hasText:'Shah Faisal'});await row.click();
  await expect(page.getByRole('heading',{name:'Incident Details',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Adjust Priority',exact:false}).click();
  await page.getByLabel('New priority',{exact:true}).selectOption('HIGH');await page.getByLabel('Override explanation',{exact:true}).fill('Simulated coordinator review');
  await page.getByRole('button',{name:'Review priority change',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm change',exact:true}).click();
  await expect(page.getByText('Simulation updated successfully.',{exact:true})).toBeVisible();
  await page.locator('.rqVerificationSummary').click();
  await page.getByLabel('Verification decision',{exact:true}).selectOption('VERIFIED');await page.getByLabel('Review notes',{exact:true}).fill('Simulated evidence reviewed');await page.getByRole('button',{name:'Record verification',exact:true}).click();
  await expect(page.locator('.rqHeroVerification')).toHaveText('VERIFIED');
  const select=page.getByLabel('Select rescue team',{exact:true});expect(await select.locator('option').count()).toBeGreaterThan(1);await select.selectOption({index:1});
  const selectedName=(await select.locator('option:checked').innerText()).split('(')[0].trim();
  await page.getByRole('button',{name:'Assign Team',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm assignment',exact:true}).click();
  await expect(page.locator('.rqAssignedSummary')).toBeVisible();
  for(const status of ['IN_PROGRESS','RESOLVED']) {await page.getByLabel('New incident status',{exact:true}).selectOption(status);await page.getByRole('button',{name:'Confirm status change',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm change',exact:true}).click();}
  await expect(page.locator('.rqStatusNode.is-current')).toContainText('RESOLVED');
  await page.screenshot({path:'test-results/demo-resolved.png',fullPage:true});
  await page.getByRole('link',{name:'Assignments',exact:true}).first().click();await expect(page.getByText('Demo Mode · Simulated records and actions. No production writes.',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Rescue Teams',exact:true}).first().click();
  await expect(page.locator('.rtDirectoryRow').filter({hasText:selectedName})).toContainText('Available');
  expect(writes).toHaveLength(0);
});
test('drawer scrolls with wheel and locks the underlying page, then restores scrolling',async({page})=>{
  await auth(page);await page.setViewportSize({width:1280,height:650});await page.goto('/dashboard');await page.locator('.rqCommandIncident').first().click();
  const drawer=page.getByRole('dialog');await expect(drawer).toBeVisible();
  const body=page.locator('.rqQuickPreviewBody');await body.hover();await page.mouse.wheel(0,600);await expect.poll(()=>body.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>document.body.style.overflow)).toBe('hidden');
  await page.keyboard.press('Escape');await expect(drawer).not.toBeVisible();expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
});
test('real assignment waits for backend confirmation and rejected priority does not fabricate success',async({page})=>{
  await auth(page);
  let record:Incident={...structuredClone(MOCK_INCIDENTS[6]),isSimulated:false,reporterName:null,description:null,assignedTeam:null,status:'PENDING'};
  let team:RescueTeam={...structuredClone(MOCK_RESCUE_TEAMS[3]),isSimulated:false};let writes=0;
  await page.route('http://localhost:4000/api/**',async route=>{
    const url=new URL(route.request().url()); const path=url.pathname;const reply=(data:unknown,status=200)=>route.fulfill({status,json:{success:status<400,data}});
    if(route.request().method()!=='GET') {writes++;if(path.endsWith('/priority'))return reply(null,409);if(path.endsWith('/assignments')){record={...record,status:'ASSIGNED',assignedTeam:team._id};team={...team,status:'BUSY',currentIncident:record._id};return reply({_id:'661200000000000000000999'},201);}}
    if(path.endsWith('/recommendations')) return reply({manualSelectionRequired:true,distanceType:'APPROXIMATE_STRAIGHT_LINE_KM',message:'Verified API fixture',items:[{team,approximateDistanceKm:2,capacityWarning:null}]});
    if(path.endsWith(record._id))return reply(record);return reply({items:path.endsWith('/incidents')?[record]:path.endsWith('/rescue-teams')?[team]:[],pagination:{page:1,limit:20,total:1,totalPages:1}});
  });
  await page.goto(`/dashboard/incidents/${record._id}?demo=false`);await expect(page.getByRole('heading',{name:'Incident Details',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Adjust Priority',exact:true}).click();await page.getByLabel('New priority',{exact:true}).selectOption('LOW');await page.getByLabel('Override explanation',{exact:true}).fill('Real API rejection fixture');await page.getByRole('button',{name:'Review priority change',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm change',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('This record has changed');await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Assign Team',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm assignment',exact:true}).click();await expect(page.locator('.rqAssignedSummary')).toBeVisible();expect(writes).toBe(2);
});
test('availability confirmations have readable labels and mutate simulation only',async({page})=>{
  const writes=await auth(page);await page.goto('/dashboard/rescue-teams');await expect(page.getByRole('heading',{name:'Rescue Team Management'})).toBeVisible();
  await page.locator('.rtDirectoryRow').filter({hasText:'Golf-7'}).click();await page.getByRole('button',{name:'Set Offline',exact:true}).click();
  const confirm=page.getByRole('dialog').getByRole('button',{name:'Set Offline',exact:true});await expect(confirm).toBeVisible();await confirm.click();await expect(page.getByRole('button',{name:'Set Available',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Set Available',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Set Available',exact:true}).click();await expect(page.getByRole('button',{name:'Set Offline',exact:true})).toBeVisible();expect(writes).toHaveLength(0);
});
test('directory combined filters and count are consistent in demo, real search is server-side',async({page})=>{
  await auth(page);await page.goto('/dashboard/incidents');await page.getByRole('textbox',{name:'Search incidents'}).fill('flood');
  await page.getByLabel('Filter by status').selectOption('PENDING');await page.getByLabel('Filter by priority').selectOption('CRITICAL');await page.getByLabel('Filter by verification').selectOption('VERIFIED');await expect(page.locator('.rqIncidentRow')).toHaveCount(0);await expect(page.locator('.rqIncidentPagination')).toContainText('0 records');
  const requests:string[]=[];page.on('request',r=>{if(r.url().includes('/api/incidents?')) requests.push(r.url());});
  await page.goto('/dashboard/incidents?demo=false');await page.getByRole('textbox',{name:'Search incidents'}).fill('evac');await expect.poll(()=>requests.some(url=>url.includes('search=evac')&&url.includes('isSimulated=false'))).toBe(true);
});
