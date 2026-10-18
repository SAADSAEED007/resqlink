import { test, expect } from '@playwright/test';
test('map selection survives safety responses and optional details stay intact', async ({page})=>{
  await page.goto('/sos'); await page.getByRole('button',{name:'SOS',exact:true}).click(); await page.getByRole('button',{name:'Flood',exact:true}).click();
  await page.getByText('Choose on Map',{exact:true}).click();
  const map=page.getByRole('group',{name:'Emergency location map',exact:true});
  await expect(page.getByRole('button',{name:'Use map center',exact:true})).toBeEnabled();
  await map.click({position:{x:100,y:100}});
  await page.getByRole('button',{name:'Confirm selected location',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Location selected on map');
  await page.screenshot({path:'test-results/sos-location-confirmed.png',fullPage:true});
  await page.getByRole('radio',{name:'Yes, immediate danger',exact:true}).check();
  await expect(page.getByRole('button',{name:'Confirm selected location',exact:true})).not.toBeVisible();
  await page.getByText('Choose on Map',{exact:true}).click();
  await expect(page.locator('.rqSosMapMarker')).toHaveCount(1);
  await page.getByText('Additional Information',{exact:false}).click(); await page.getByLabel('Your name',{exact:true}).fill('Test reporter');
  await page.getByText('Additional Information',{exact:false}).click(); await page.getByText('Additional Information',{exact:false}).click(); await expect(page.getByLabel('Your name',{exact:true})).toHaveValue('Test reporter');
});
test('API failure retains the report and translations preserve the safety response', async ({page})=>{
  await page.route('http://localhost:4000/api/incidents',route=>route.fulfill({status:500,json:{success:false}}));
  await page.goto('/sos'); await page.getByRole('button',{name:'SOS',exact:true}).click(); await page.getByRole('button',{name:'Flood',exact:true}).click();
  await page.getByRole('radio',{name:'Yes, immediate danger',exact:true}).check();
  await page.getByRole('button',{name:'اردو',exact:true}).click(); await expect(page.getByRole('radio',{name:'ہاں، فوری خطرہ ہے',exact:true})).toBeChecked();
  await page.getByRole('button',{name:'سنڌي',exact:true}).click(); await expect(page.getByRole('radio',{name:'ها، فوري خطرو آهي',exact:true})).toBeChecked();
  await page.getByRole('button',{name:'English',exact:true}).click();
  await page.getByPlaceholder('Village, district, road, mosque or school').fill('Test landmark');
  await page.getByRole('button',{name:'Send SOS Report',exact:true}).click(); await page.getByRole('button',{name:'Send SOS Report',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'Your report was not recorded'})).toBeVisible();
  await page.getByRole('button',{name:'Edit report',exact:true}).click();
  await expect(page.getByRole('radio',{name:'Yes, immediate danger',exact:true})).toBeChecked();
  await expect(page.getByPlaceholder('Village, district, road, mosque or school')).toHaveValue('Test landmark');
});
test('optional safety check precedes location and submit; switching categories clears answers', async ({page}) => {
  await page.goto('/sos'); await page.getByRole('button',{name:'SOS',exact:true}).click();
  await page.getByRole('button',{name:'Flood',exact:true}).click();
  const group=page.getByRole('group',{name:'Is anyone in immediate danger?'});
  await expect(group).toBeVisible();
  await page.getByRole('radio',{name:'Yes, immediate danger',exact:true}).check();
  await page.getByPlaceholder('Village, district, road, mosque or school').fill('Test village');
  await page.getByRole('button',{name:'Fire',exact:true}).click();
  await expect(page.getByRole('radio',{name:'Yes, immediate danger',exact:true})).not.toBeChecked();
  await expect(page.getByPlaceholder('Village, district, road, mosque or school')).toHaveValue('Test village');
  await expect(group).toContainText('spreading fire');
  await page.getByRole('radio',{name:"I'm not sure",exact:true}).check();
  await page.getByRole('button',{name:'Clear answer',exact:true}).click();
  expect(await page.locator('.rqSafetyOptions input:checked').count()).toBe(0);
  expect(await page.evaluate(()=>{const safety=document.querySelector('.rqSafetyInline')!; const location=document.querySelector('.rqQuickLocation')!; const send=document.querySelector('.rqQuickSend')!; return !!(safety.compareDocumentPosition(location)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(location.compareDocumentPosition(send)&Node.DOCUMENT_POSITION_FOLLOWING);})).toBe(true);
  for(const width of [320,360,375,390,430,768,1440]) { await page.setViewportSize({width,height:900}); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); if([390,1440].includes(width)) await page.screenshot({path:`test-results/sos-${width}.png`,fullPage:true}); }
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await group.evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});
test('minimal and danger reports preserve the existing payload and successful response flow', async ({page,context})=>{
  await context.grantPermissions(['geolocation']); await context.setGeolocation({latitude:24.9065,longitude:67.1608});
  const payloads: Record<string,unknown>[]=[];
  await page.route('http://localhost:4000/api/incidents', async route=>{payloads.push(route.request().postDataJSON()); await route.fulfill({json:{success:true,data:{_id:'661200000000000000000099'}}});});
  for(const danger of [false,true]) {
    await page.goto('/sos'); await page.getByRole('button',{name:'SOS',exact:true}).click(); await page.getByRole('button',{name:'Flood',exact:true}).click();
    if(danger) await page.getByRole('radio',{name:'Yes, immediate danger',exact:true}).check();
    await page.getByRole('button',{name:'Share My Location',exact:true}).click(); await expect(page.getByRole('status')).toHaveText('Location captured');
    await page.getByRole('button',{name:'Send SOS Report',exact:true}).click(); await page.getByRole('button',{name:'Send SOS Report',exact:true}).click();
    await expect(page.getByRole('heading',{name:'SOS Report Submitted',exact:true})).toBeVisible();
    expect(payloads.at(-1)).toMatchObject({emergencyType:'FLOOD',safetyAnswer:danger?'YES':'UNANSWERED',location:{latitude:24.9065,longitude:67.1608}});
    expect(payloads.at(-1)).not.toHaveProperty('reporterName'); expect(payloads.at(-1)).not.toHaveProperty('peopleAffected');
  }
  expect(payloads).toHaveLength(2);
});
