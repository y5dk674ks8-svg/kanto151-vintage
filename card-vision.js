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
  // Ensure the second point is the upper-right rather than lower-left.
  if(out[1].y>out[3].y)return [out[0],out[3],out[2],out[1]];
  return out;
 }
 async function detect(sourceCanvas){
  const cv=await loadOpenCV();
  const maxEdge=1000,scale=Math.min(1,maxEdge/Math.max(sourceCanvas.width,sourceCanvas.height));
  const input=document.createElement('canvas');input.width=Math.round(sourceCanvas.width*scale);input.height=Math.round(sourceCanvas.height*scale);
  input.getContext('2d').drawImage(sourceCanvas,0,0,input.width,input.height);
  const src=cv.imread(input),rgb=new cv.Mat(),hsv=new cv.Mat(),mask=new cv.Mat(),closed=new cv.Mat(),kernel=cv.getStructuringElement(cv.MORPH_RECT,new cv.Size(9,9)),contours=new cv.MatVector(),hierarchy=new cv.Mat();
  let best=null,approx=null,srcPts=null,dstPts=null,transform=null,warped=null,lower=null,upper=null;
  try{
   cv.cvtColor(src,rgb,cv.COLOR_RGBA2RGB);cv.cvtColor(rgb,hsv,cv.COLOR_RGB2HSV);
   lower=new cv.Mat(hsv.rows,hsv.cols,hsv.type(),new cv.Scalar(12,65,65,0));
   upper=new cv.Mat(hsv.rows,hsv.cols,hsv.type(),new cv.Scalar(48,255,255,255));
   cv.inRange(hsv,lower,upper,mask);
   cv.morphologyEx(mask,closed,cv.MORPH_CLOSE,kernel);
   cv.findContours(closed,contours,hierarchy,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE);
   const imageArea=src.cols*src.rows;
   for(let i=0;i<contours.size();i++){
    const contour=contours.get(i),area=cv.contourArea(contour);
    if(area<imageArea*.045){contour.delete();continue}
    const rect=cv.minAreaRect(contour),rw=rect.size.width,rh=rect.size.height,ratio=Math.min(rw,rh)/Math.max(rw,rh);
    if(ratio<.57||ratio>.86){contour.delete();continue}
    const score=area*(1-Math.abs(ratio-.716));
    if(!best||score>best.score){if(best)best.contour.delete();best={contour,area,ratio,score,rect}}
    else contour.delete();
   }
   if(!best)return {found:false,reason:'Geen duidelijke gele Pokémon-kaartcontour gevonden.'};
   approx=new cv.Mat();cv.approxPolyDP(best.contour,approx,cv.arcLength(best.contour,true)*.018,true);
   let points=[];
   if(approx.rows===4){
    const data=approx.data32S;
    for(let i=0;i<4;i++)points.push({x:data[i*2],y:data[i*2+1]});
   }else{
    const r=best.rect,cx=r.center.x,cy=r.center.y,w=r.size.width,h=r.size.height,a=r.angle*Math.PI/180;
    for(const [lx,ly] of [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]])points.push({x:cx+lx*Math.cos(a)-ly*Math.sin(a),y:cy+lx*Math.sin(a)+ly*Math.cos(a)});
   }
   points=orderPoints(points);
   // The card must be portrait-shaped after perspective correction.
   const top=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y),side=Math.hypot(points[3].x-points[0].x,points[3].y-points[0].y);
   if(top>side){points=[points[3],points[0],points[1],points[2]]}
   const W=744,H=1039;
   srcPts=cv.matFromArray(4,1,cv.CV_32FC2,points.flatMap(p=>[p.x,p.y]));
   dstPts=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,W-1,0,W-1,H-1,0,H-1]);
   transform=cv.getPerspectiveTransform(srcPts,dstPts);warped=new cv.Mat();
   cv.warpPerspective(src,warped,transform,new cv.Size(W,H),cv.INTER_CUBIC,cv.BORDER_REPLICATE,new cv.Scalar());
   const output=document.createElement('canvas');output.width=W;output.height=H;cv.imshow(output,warped);
   return {found:true,canvas:output,confidence:Math.min(1,best.area/imageArea*2),ratio:best.ratio,points:points.map(p=>({x:p.x/scale,y:p.y/scale}))};
  }finally{
   [src,rgb,hsv,mask,closed,kernel,contours,hierarchy,approx,srcPts,dstPts,transform,warped,lower,upper].forEach(m=>{if(m&&m.delete)try{m.delete()}catch(e){}});
   if(best&&best.contour)try{best.contour.delete()}catch(e){}
  }
 }
 window.KantoCardVision={loadOpenCV,detect};
})();