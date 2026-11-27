/* Kanto 151 offline data layer. Metadata is stored on this device in IndexedDB. */
(function(){
 const DB='kanto151-offline-v1', STORE='api';
 let dbPromise;
 function db(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
   const req=indexedDB.open(DB,1);
   req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:'url'});};
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });return dbPromise;
 }
 async function get(url){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction(STORE).objectStore(STORE).get(url);r.onsuccess=()=>resolve(r.result?.data??null);r.onerror=()=>reject(r.error);});}
 async function put(url,data){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).put({url,data,savedAt:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
 async function count(){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction(STORE).objectStore(STORE).count();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 window.KantoOffline={
  get,put,count,
  async downloadCatalog(onProgress){
   const langs=['en','ja'], base='https://api.tcgdex.net/v2/';
   const names={
    en:['Base Set','Jungle','Fossil','Base Set 2','Team Rocket','Gym Heroes','Gym Challenge','Neo Genesis','Neo Discovery','Neo Revelation','Neo Destiny','Legendary Collection','Expedition','Aquapolis','Skyridge','Southern Islands'],
    ja:['拡張パック','ポケモンジャングル','化石の秘密','ロケット団','リーダーズスタジアム','闇からの挑戦','金、銀、新世界へ','遺跡をこえて','めざめる伝説','闇、そして光へ','ポケモンカード★VS','ポケモンカード★web','基本拡張パック','地図にない町','海からの風','裂けた大地','神秘なる山']
   };
   let done=0,total=0;
   const fetchSave=async url=>{let cached=await get(url);if(cached!==null)return cached;const res=await fetch(url);if(!res.ok)throw Error('TCGdex '+res.status+' bij '+url);const data=await res.json();await put(url,data);return data;};
   const catalog=[];
   for(const lang of langs){
    const all=await fetchSave(base+lang+'/sets');
    const chosen=all.filter(s=>names[lang].some(n=>n.toLowerCase()===String(s.name||'').toLowerCase()));
    for(const brief of chosen){
     const set=await fetchSave(base+lang+'/sets/'+encodeURIComponent(brief.id));
     const year=Number(String(set.releaseDate||'').slice(0,4));
     if(year<1996||year>2002)continue;
     catalog.push({lang,id:set.id,name:set.name,releaseDate:set.releaseDate,cards:(set.cards||[]).length});
     total+=(set.cards||[]).length;
    }
   }
   for(const item of catalog){
    const set=await fetchSave(base+item.lang+'/sets/'+encodeURIComponent(item.id));
    const cards=set.cards||[];
    for(let i=0;i<cards.length;i+=5){
     await Promise.all(cards.slice(i,i+5).map(async card=>{
      const url=base+item.lang+'/cards/'+encodeURIComponent(card.id);
      try{await fetchSave(url);}catch(e){/* one missing card must not abort the complete pack */}
      done++;if(onProgress)onProgress({done,total,set:item.name,lang:item.lang});
     }));
    }
   }
   return {sets:catalog.length,cards:done,totalCached:await count()};
  }
 };
})();