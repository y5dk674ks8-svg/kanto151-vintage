(function(){
 const visionScriptUrl=document.currentScript&&document.currentScript.src?document.currentScript.src:document.baseURI;
 let cvPromise=null;
 function loadOpenCV(){
  if(window.cv&&window.cv.Mat)return Promise.resolve(window.cv);
  if(cvPromise)return cvPromise;
  cvPromise=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=new URL('./assets/opencv.js',visionScriptUrl).href;script.async=true;
   const fail=setTimeout(()=>reject(new Error('OpenCV initialisatie duurde langer dan 30 seconden.')),30000);
   script.onload=()=>{
    const c=window.cv;
    if(c&&c.Mat){clearTimeout(fail);resolve(c);return}
    if(c&&typeof c.then==='function'){c.then(v=>{clearTimeout(fail);resolve(v)},e=>{clearTimeout(fail);reject(e)});return}
    if(c){const previous=c.onRuntimeInitialized;c.onRuntimeInitialized=()=>{if(previous)previous();clearTimeout(fail);resolve(window.cv||c)}}
    else{clearTimeout(fail);reject(new Error('OpenCV is geladen, maar de cv-module ontbreekt.'))}
   };
   script.onerror=()=>{clearTimeout(fail);reject(new Error('OpenCV-bestand kon niet lokaal worden geladen.'))};
   document.head.appendChild(script);
  });
  return cvPromise;
 }
 function orderPoints(points){
  const cx=points.reduce((s,p)=>s+p.x,0)/4,cy=points.reduce((s,p)=>s+p.y,0)/4;
  const ordered=points.slice().sort((a,b)=>Math.atan2(a.y-cy,a.x-cx)-Math.atan2(b.y-cy,b.x-cx));
  let start=0,best=Infinity;
  for(let i=0;i<4;i++){const v=ordered[i].x+ordered[i].y;if(v<best){best=v;start=i}}
  const out=[0,1,2,3].map(i=>ordered[(start+i)%4]);
  if(out[1].y>out[3].y)return [out[0],out[3],out[2],out[1]];
  return out;
 }
 async function detect(sourceCanvas){
  const cv=await loadOpenCV();
  const maxEdge=1100,scale=Math.min(1,maxEdge/Math.max(sourceCanvas.width,sourceCanvas.height));
  const input=document.createElement('canvas');input.width=Math.round(sourceCanvas.width*scale);input.height=Math.round(sourceCanvas.height*scale);
  input.getContext('2d').drawImage(sourceCanvas,0,0,input.width,input.height);
  const src=cv.imread(input),gray=new cv.Mat();
  let best=null,srcPts=null,dstPts=null,transform=null,warped=null;
  const imageArea=src.cols*src.rows;
  // Several edge scales/thresholds are needed for sleeves, holographic glare and cards
  // that overlap neighboring cards. The former single Canny pass missed the Machamp test photo.
  const passes=[
   {blur:3,low:30,high:90,kernel:3,eps:[.015,.025,.04,.05]},
   {blur:5,low:30,high:90,kernel:3,eps:[.015,.025,.04,.05]},
   {blur:5,low:40,high:120,kernel:5,eps:[.015,.025,.04,.05]},
   {blur:3,low:20,high:60,kernel:3,eps:[.015,.025,.04,.05]},
   {blur:7,low:40,high:120,kernel:5,eps:[.015,.03,.05]}
  ];
  try{
   cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);
   for(const pass of passes){
    const blurred=new cv.Mat(),edges=new cv.Mat(),closed=new cv.Mat();
    const kernel=cv.getStructuringElement(cv.MORPH_RECT,new cv.Size(pass.kernel,pass.kernel));
    const contours=new cv.MatVector(),hierarchy=new cv.Mat();
    try{
     cv.GaussianBlur(gray,blurred,new cv.Size(pass.blur,pass.blur),0,0,cv.BORDER_DEFAULT);
     cv.Canny(blurred,edges,pass.low,pass.high);
     cv.morphologyEx(edges,closed,cv.MORPH_CLOSE,kernel,new cv.Point(-1,-1),2);
     cv.findContours(closed,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
     for(let i=0;i<contours.size();i++){
      const contour=contours.get(i),area=cv.contourArea(contour),rect=cv.boundingRect(contour);
      if(area<imageArea*.055||area>imageArea*.90||rect.width<src.cols*.34||rect.height<src.rows*.38){
       contour.delete();continue;
      }
      // Ignore the photo/background boundary; it often forms a convincing but false quadrilateral.
      const touches=(rect.x<2)+(rect.y<2)+(rect.x+rect.width>src.cols-2)+(rect.y+rect.height>src.rows-2);
      if(touches>=3){contour.delete();continue}
      const perimeter=cv.arcLength(contour,true);
      let accepted=null;
      for(const eps of pass.eps){
       const approx=new cv.Mat();
       cv.approxPolyDP(contour,approx,perimeter*eps,true);
       if(approx.rows===4&&cv.isContourConvex(approx)){accepted=approx;break}
       approx.delete();
      }
      if(!accepted){contour.delete();continue}
      const data=accepted.data32S,points=[];
      for(let p=0;p<4;p++)points.push({x:data[p*2],y:data[p*2+1]});
      const ordered=orderPoints(points);
      const top=Math.hypot(ordered[1].x-ordered[0].x,ordered[1].y-ordered[0].y);
      const bottom=Math.hypot(ordered[2].x-ordered[3].x,ordered[2].y-ordered[3].y);
      const left=Math.hypot(ordered[3].x-ordered[0].x,ordered[3].y-ordered[0].y);
      const right=Math.hypot(ordered[2].x-ordered[1].x,ordered[2].y-ordered[1].y);
      const ratio=((top+bottom)/2)/Math.max(1,(left+right)/2);
      const minSide=Math.min(top,bottom,left,right);
      const rectangularity=area/Math.max(1,rect.width*rect.height);
      // A Pokémon card has a physical width/height ratio close to 0.714.
      // Reject broad, clipped or merged contours (e.g. the previous 0.863 Machamp false quad).
      if(ratio<.58||ratio>.84||minSide<Math.min(src.cols,src.rows)*.09||rectangularity<.30){
       accepted.delete();contour.delete();continue;
      }
      // Strongly prioritize the real card aspect ratio so a larger, merged neighboring contour
      // cannot win merely because it encloses more pixels.
      const ratioFit=Math.exp(-Math.abs(Math.log(ratio/.714))*7);
      const score=area*ratioFit*rectangularity;
      if(!best||score>best.score){
       best={points:ordered,area,ratio,score,rectangularity};
      }
      accepted.delete();contour.delete();
     }
    }finally{
     [blurred,edges,closed,kernel,contours,hierarchy].forEach(m=>{if(m&&m.delete)try{m.delete()}catch(e){}});
    }
   }
   if(!best)return {found:false,reason:'Geen betrouwbare kaartcontour gevonden na meerdere detectiepogingen.'};
   const points=best.points,W=744,H=1039;
   srcPts=cv.matFromArray(4,1,cv.CV_32FC2,points.flatMap(p=>[p.x,p.y]));
   dstPts=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,W-1,0,W-1,H-1,0,H-1]);
   transform=cv.getPerspectiveTransform(srcPts,dstPts);warped=new cv.Mat();
   cv.warpPerspective(src,warped,transform,new cv.Size(W,H),cv.INTER_CUBIC,cv.BORDER_REPLICATE,new cv.Scalar());
   const output=document.createElement('canvas');output.width=W;output.height=H;cv.imshow(output,warped);
   return {found:true,canvas:output,confidence:Math.min(1,best.area/imageArea*2),ratio:best.ratio,rectangularity:best.rectangularity,points:points.map(p=>({x:p.x/scale,y:p.y/scale})),method:'multi-pass-contour-ratio-validated'};
  }finally{
   [src,gray,srcPts,dstPts,transform,warped].forEach(m=>{if(m&&m.delete)try{m.delete()}catch(e){}});
  }
 }
 window.KantoCardVision={loadOpenCV,detect};
})();