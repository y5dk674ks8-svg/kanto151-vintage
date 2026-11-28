/* Kanto 151 visual card-art matcher. Compares the photographed artwork with TCGdex reference images. */
(function(){
 'use strict';
 const featureCache=new Map(),STORAGE_KEY='kanto151_visual_features_v3';let stored={};
 try{stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch(e){}
 function loadImage(url){
  return new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.decoding='async';img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Referentieafbeelding niet bereikbaar: '+url));img.src=url+'/low.webp'});
 }
 function crop(source,b){
  const c=document.createElement('canvas');c.width=128;c.height=128;
  c.getContext('2d',{willReadFrequently:true}).drawImage(source,source.width*b[0],source.height*b[1],source.width*(b[2]-b[0]),source.height*(b[3]-b[1]),0,0,128,128);return c;
 }
 function hash(ctx){
  const n=32,k=8,d=ctx.getImageData(0,0,n,n).data,g=new Float64Array(n*n),tmp=new Float64Array(n*n),out=new Float64Array(k*k);
  for(let i=0;i<n*n;i++)g[i]=.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2];
  const cos=Array.from({length:k},(_,u)=>Float64Array.from({length:n},(_,x)=>Math.cos((2*x+1)*u*Math.PI/(2*n))));
  for(let y=0;y<n;y++)for(let u=0;u<k;u++){let s=0;for(let x=0;x<n;x++)s+=g[y*n+x]*cos[u][x];tmp[y*n+u]=s}
  let z=0;for(let v=0;v<k;v++)for(let u=0;u<k;u++){let s=0;for(let y=0;y<n;y++)s+=tmp[y*n+u]*cos[v][y];out[z++]=s}
  const sorted=Array.from(out.slice(1)).sort((a,b)=>a-b),med=sorted[Math.floor(sorted.length/2)];let bits=0n;
  for(let i=0;i<64;i++)if(out[i+1]>med)bits|=1n<<BigInt(i);return bits.toString(16).padStart(16,'0');
 }
 function hist(ctx){
  const d=ctx.getImageData(0,0,128,128).data,b=new Float32Array(20);
  for(let i=0;i<d.length;i+=4){const r=d[i]/255,g=d[i+1]/255,bl=d[i+2]/255,mx=Math.max(r,g,bl),mn=Math.min(r,g,bl),delta=mx-mn;let h=0;
   if(delta){if(mx===r)h=((g-bl)/delta)%6;else if(mx===g)h=(bl-r)/delta+2;else h=(r-g)/delta+4;h=(h*60+360)%360}
   b[Math.min(11,Math.floor(h/30))]++;b[12+Math.min(3,Math.floor((mx?delta/mx:0)*4))]++;b[16+Math.min(3,Math.floor(mx*4))]++;
  }
  for(let i=0;i<b.length;i++)b[i]/=16384;return Array.from(b);
 }
 function feature(c){
  const small=document.createElement('canvas');small.width=32;small.height=32;const sx=small.getContext('2d',{willReadFrequently:true});sx.drawImage(c,0,0,32,32);
  const tiles=[];
  for(let ty=0;ty<2;ty++)for(let tx=0;tx<2;tx++){
   const tile=document.createElement('canvas');tile.width=32;tile.height=32;
   const tc=tile.getContext('2d',{willReadFrequently:true});
   tc.drawImage(c,tx*64,ty*64,64,64,0,0,32,32);tiles.push(hash(tc));tile.width=0;tile.height=0;
  }
  const f={hash:hash(sx),tiles,hist:hist(c.getContext('2d',{willReadFrequently:true}))};small.width=0;small.height=0;return f;
 }
 function hamming(a,b){let x=BigInt('0x'+a)^BigInt('0x'+b),n=0;while(x){n++;x&=x-1n}return n}
 function similarity(a,b){
  let diff=0;for(let i=0;i<a.hist.length;i++)diff+=Math.abs(a.hist[i]-b.hist[i]);
  const ph=1-hamming(a.hash,b.hash)/64,hs=Math.max(0,1-diff/2);
  let tile=0;for(let i=0;i<4;i++)tile+=1-hamming(a.tiles[i],b.tiles[i])/64;tile/=4;
  return Math.max(0,Math.min(1,.25*ph+.55*tile+.20*hs));
 }
 async function refFeature(base){
  if(featureCache.has(base))return featureCache.get(base);if(stored[base]){featureCache.set(base,stored[base]);return stored[base]}
  const task=(async()=>{const img=await loadImage(base);const art=crop(img,[.18,.23,.82,.66]);const f=feature(art);featureCache.set(base,f);stored[base]=f;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(stored))}catch(e){}art.width=0;art.height=0;return f})();
  featureCache.set(base,task);try{return await task}catch(e){featureCache.delete(base);throw e}
 }
 async function rank(cardCanvas,candidates,onProgress){
  if(!cardCanvas||!candidates?.length)return {matches:candidates||[],compared:0,failed:0};
  const art=crop(cardCanvas,[.18,.23,.82,.66]),query=feature(art);art.width=0;art.height=0;
  const results=new Array(candidates.length);let cursor=0,done=0,failed=0;
  async function run(){while(cursor<candidates.length){const i=cursor++,c=candidates[i];try{if(!c.image)throw Error('Geen referentieafbeelding');const f=await refFeature(c.image);results[i]={...c,visualScore:similarity(query,f),visualMatch:true}}catch(e){failed++;results[i]={...c,visualMatch:false,visualError:e.message}}done++;if(onProgress)onProgress(done,candidates.length)}}
  await Promise.all(Array.from({length:Math.min(4,candidates.length)},run));
  return {matches:results.filter(Boolean).sort((a,b)=>(b.visualScore??-1)-(a.visualScore??-1)),compared:candidates.length-failed,failed};
 }
 window.KantoVisualMatch={rank};
})();