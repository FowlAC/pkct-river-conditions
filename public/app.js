const $ = id => document.getElementById(id);
const TZ = 'America/Los_Angeles';
const localTime = iso => iso && !Number.isNaN(Date.parse(iso)) ? new Intl.DateTimeFormat('en-US', {timeZone:TZ, month:'short', day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(iso)) : 'unknown';
const number = (n,d=1) => new Intl.NumberFormat('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const isFresh = obs => obs && Number.isFinite(Number(obs.value)) && obs.dateTime && Date.now()-Date.parse(obs.dateTime) <= 6*3600000 && Date.now()-Date.parse(obs.dateTime)>=-5*60000;
function setMetric(name,obs,display,where) {
  const valid = isFresh(obs);
  $(name).textContent = valid ? display(Number(obs.value)) : 'Unavailable';
  $(name+'-time').textContent = `${where} · ${obs?.dateTime ? localTime(obs.dateTime) : 'no reading'}${valid ? '' : ' · stale or missing'}`;
}
function drawStageChart(history) {
  const target = $('chart');
  const now = Date.now(), begin = now - 24*3600000;
  const data = (Array.isArray(history) ? history : []).filter(p=>Number.isFinite(Number(p.value)) && Number.isFinite(Date.parse(p.dateTime)) && Date.parse(p.dateTime)>=begin && Date.parse(p.dateTime)<=now+60000).sort((a,b)=>Date.parse(a.dateTime)-Date.parse(b.dateTime));
  if(data.length<2){$('chart-status').textContent='No recent chart data';target.textContent='Not enough readings to draw a 24-hour graph.';return}
  const W=850,H=255,L=60,R=18,T=20,B=42;
  const vals=data.map(p=>Number(p.value));let lo=Math.min(...vals),hi=Math.max(...vals);
  const margin=Math.max((hi-lo)*.15,.15);lo-=margin;hi+=margin;
  const x=t=>L+(t-begin)/(24*3600000)*(W-L-R);
  const y=v=>T+(hi-v)/(hi-lo)*(H-T-B);
  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','USGS 24-hour river stage chart');
  const add=(tag,attrs,content)=>{const el=document.createElementNS(svgNS,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);if(content!==undefined)el.textContent=content;svg.appendChild(el);return el};
  for(let i=0;i<=4;i++){
    const level=lo+(hi-lo)*i/4,py=y(level);
    add('line',{x1:L,y1:py,x2:W-R,y2:py,stroke:'#dfe7ee','stroke-width':'1'});
    add('text',{x:L-10,y:py+4,'text-anchor':'end',fill:'#536170','font-size':'13'},number(level,1));
  }
  for(let i=0;i<=4;i++){
    const t=begin+i*6*3600000,px=x(t);
    add('text',{x:px,y:H-12,'text-anchor':i===0?'start':i===4?'end':'middle',fill:'#536170','font-size':'13'},new Intl.DateTimeFormat('en-US',{timeZone:TZ,hour:'numeric'}).format(new Date(t)));
  }
  // Segment the path at transmission gaps so missing values are not interpolated.
  let d='',previous=null;
  for(const point of data){const t=Date.parse(point.dateTime);const separated=previous!==null && t-previous>90*60000;d+=(previous===null||separated?'M':'L')+x(t).toFixed(1)+','+y(Number(point.value)).toFixed(1)+' ';previous=t}
  add('path',{d,fill:'none',stroke:'#1d7db5','stroke-width':'3','stroke-linejoin':'round','stroke-linecap':'round'});
  $('chart-status').textContent=`${data.length} observations`;
  target.replaceChildren(svg);
}
async function loadConditions() {
  $('status').textContent='Loading river conditions…';
  try {
    const response=await fetch('/api/conditions',{cache:'no-store'});
    if(!response.ok)throw new Error('API returned '+response.status);
    const data=await response.json();if(data.error)throw new Error(data.error);
    if(data.stationId!=='14211720')throw new Error('Unexpected USGS station');
    setMetric('temperature',data.temperature,v=>number(v*9/5+32,1)+' °F','USGS');
    setMetric('stage',data.stage,v=>number(v,2)+' ft','Morrison Bridge');
    setMetric('discharge',data.discharge,v=>number(v,0)+' CFS','USGS');
    // 72255: mean velocity at Broadway Bridge. Preserve sign to show flow reversals.
    setMetric('velocity',data.velocity,v=>number(v*0.681818,2)+' mph','Broadway Bridge');
    drawStageChart(data.stageHistory);
    $('status').textContent='Last checked '+localTime(data.fetchedAt);
  } catch(error) {
    $('status').textContent='Data currently unavailable';
    for(const name of ['temperature','stage','discharge','velocity']){$(name).textContent='Unavailable';$(name+'-time').textContent='No current reading'}
    $('chart-status').textContent='Unavailable';$('chart').textContent='Unable to load observations.';
    console.error(error);
  }
}
document.addEventListener('DOMContentLoaded',loadConditions);

// Refresh Sellwood River Camera every five minutes

const cameraEl = document.getElementById('river-camera');

function refreshRiverCamera() {
  if (!cameraEl) return;

  const imageUrl =
    'https://portlandrowingclub.com/wp-content/now.jpg';

  cameraEl.src = `${imageUrl}?t=${Date.now()}`;
}

if (cameraEl) {
  setInterval(refreshRiverCamera, 5 * 60 * 1000);
}
