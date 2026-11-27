const { chromium, webkit } = require('playwright');
(async()=>{
 let failed=false;
 for(const [name,browserType] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await browserType.launch({headless:true});
  for(const test of ['ocr-smoke.html','card-detect.html']){
   const page=await browser.newPage();
   page.on('console',m=>console.log(name+'/'+test+' console '+m.type()+': '+m.text()));
   page.on('pageerror',e=>console.log(name+'/'+test+' PAGEERROR: '+(e.stack||e.message)));
   page.on('requestfailed',r=>console.log(name+'/'+test+' REQUESTFAILED: '+r.url()+' '+(r.failure()?.errorText||'')));
   try{
    await page.goto('http://127.0.0.1:4173/tests/'+test);
    await page.waitForFunction(()=>document.body.dataset.result==='pass'||document.body.dataset.result==='fail',{timeout:120000});
    const result=await page.locator('#log').innerText();
    console.log('===== '+name+' '+test+' RESULT =====\\n'+result);
    if(await page.locator('body').getAttribute('data-result')!=='pass')failed=true;
   }catch(e){console.log(name+'/'+test+' TEST FAILURE: '+(e.stack||e.message));failed=true;}
   await page.close();
  }
  await browser.close();
 }
 if(failed)process.exit(1);
})();