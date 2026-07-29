const ALLOWED_ORIGINS = new Set([
  "https://gmejilla.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
]);
const VERSION = "3.1.0";
const TIMEOUT_MS = 8500;
const ROUTE_OK_TTL = 900;
const ROUTE_FAIL_TTL = 60;
const FLIGHTS_TTL = 15;
const WEATHER_TTL = 600;
const RATE_LIMIT = 120;
const rateBuckets = new Map();

function cors(request) {
  const origin = request.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://gmejilla.github.io",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function reply(request, body, status=200, ttl=0) {
  return new Response(JSON.stringify(body), {status, headers:{
    ...cors(request), "Content-Type":"application/json; charset=utf-8",
    "Cache-Control": ttl ? `public, max-age=${ttl}` : "no-store"
  }});
}
function limited(request) {
  const ip=request.headers.get("CF-Connecting-IP")||"unknown";
  const minute=Math.floor(Date.now()/60000), key=`${ip}:${minute}`;
  const count=(rateBuckets.get(key)||0)+1; rateBuckets.set(key,count);
  if (rateBuckets.size>1000) for (const k of rateBuckets.keys()) if (!k.endsWith(`:${minute}`)) rateBuckets.delete(k);
  return count>RATE_LIMIT;
}
async function fetchJson(url, timeout=TIMEOUT_MS) {
  const c=new AbortController(), timer=setTimeout(()=>c.abort(),timeout);
  try {
    const r=await fetch(url,{signal:c.signal,headers:{Accept:"application/json","User-Agent":"FlightWall/3.1"}});
    const text=await r.text(); let data=null; try{data=JSON.parse(text)}catch{}
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    if(data===null) throw new Error("non-JSON response");
    return data;
  } catch(e) { if(e.name==="AbortError") throw new Error(`timeout after ${timeout}ms`); throw e; }
  finally { clearTimeout(timer); }
}
function num(v,d=0){v=Number(v);return Number.isFinite(v)?v:d}
function rad(d){return d*Math.PI/180}
function distanceMiles(a,b,c,d){const R=3958.7613,dl=rad(c-a),dn=rad(d-b);const x=Math.sin(dl/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dn/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function bearing(a,b,c,d){const y=Math.sin(rad(d-b))*Math.cos(rad(c));const x=Math.cos(rad(a))*Math.sin(rad(c))-Math.sin(rad(a))*Math.cos(rad(c))*Math.cos(rad(d-b));return (Math.atan2(y,x)*180/Math.PI+360)%360}
function cardinal(v){return ["N","NE","E","SE","S","SW","W","NW"][Math.round(((v%360)+360)%360/45)%8]}
function normalizeAircraft(raw,lat,lon){
  const latitude=num(raw.lat,NaN), longitude=num(raw.lon,NaN); if(!Number.isFinite(latitude)||!Number.isFinite(longitude)) return null;
  const callsign=String(raw.flight||raw.callsign||"").trim().toUpperCase();
  const altitude=raw.alt_baro==="ground"?0:num(raw.alt_geom,num(raw.alt_baro,0));
  const vr=num(raw.geom_rate,num(raw.baro_rate,0)), onGround=raw.alt_baro==="ground"||Boolean(raw.ground);
  const brg=bearing(lat,lon,latitude,longitude);
  return {id:String(raw.hex||raw.icao||callsign||crypto.randomUUID()).replace(/^~/,""),icao24:String(raw.hex||raw.icao||"---").replace(/^~/,""),callsign,flightNumber:callsign,
    airline:"",origin:"---",destination:"---",aircraft:raw.t||raw.desc||raw.type||"AIRCRAFT TYPE UNKNOWN",country:raw.ownOp||raw.r||"Unknown",
    latitude,longitude,altitudeFt:Math.round(altitude),speedMph:Math.round(num(raw.gs)*1.15078),heading:num(raw.track,num(raw.true_heading,num(raw.mag_heading))),
    distanceMi:Math.round(distanceMiles(lat,lon,latitude,longitude)*10)/10,bearingDegrees:brg,bearing:cardinal(brg),verticalRateFpm:Math.round(vr),
    status:onGround?"ON GROUND":vr>250?"CLIMBING":vr<-250?"DESCENDING":"LEVEL",squawk:raw.squawk||"---",onGround,lastContact:Date.now()-Math.max(0,num(raw.seen))*1000};
}
async function cached(request,key,ttl,loader){
  const cache=caches.default, req=new Request(`https://flightwall-cache.invalid/${key}`); const hit=await cache.match(req);
  if(hit){const body=await hit.json();body.cached=true;return reply(request,body,hit.status,ttl)}
  const {body,status=200}=await loader(); const response=reply(request,body,status,ttl);
  await cache.put(req,new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":`public,max-age=${ttl}`}})); return response;
}
async function flights(request,url){
  const lat=num(url.searchParams.get("lat"),NaN),lon=num(url.searchParams.get("lon"),NaN),radius=Math.max(1,Math.min(250,num(url.searchParams.get("radius"),35))),max=Math.max(1,Math.min(100,num(url.searchParams.get("max"),16)));
  if(!Number.isFinite(lat)||!Number.isFinite(lon)) return reply(request,{success:false,error:"lat and lon are required"},400);
  const nm=radius/1.15078; const providers=[
    ["ADSB.FI",`https://opendata.adsb.fi/api/v3/lat/${lat}/lon/${lon}/dist/${nm.toFixed(1)}`],
    ["AIRPLANES.LIVE",`https://api.airplanes.live/v2/point/${lat}/${lon}/${nm.toFixed(1)}`],
    ["ADSB.LOL",`https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${nm.toFixed(1)}`]
  ];
  return cached(request,`flights/${lat.toFixed(3)}/${lon.toFixed(3)}/${radius}/${max}`,FLIGHTS_TTL,async()=>{
    const errors=[];
    for(const [name,endpoint] of providers){try{const p=await fetchJson(endpoint);const rows=Array.isArray(p.ac)?p.ac:Array.isArray(p.aircraft)?p.aircraft:[];const list=rows.map(x=>normalizeAircraft(x,lat,lon)).filter(Boolean).filter(x=>x.distanceMi<=radius).sort((a,b)=>a.distanceMi-b.distanceMi).slice(0,max);if(!list.length)throw new Error("no aircraft returned");console.log(JSON.stringify({event:"flights",provider:name,count:list.length}));return {body:{success:true,provider:name,providerReason:`${name} returned live nearby aircraft.`,flights:list,cached:false}}}catch(e){errors.push(`${name}: ${e.message}`)}}
    return {status:502,body:{success:false,error:"LIVE DATA UNAVAILABLE",providerReason:errors.join(" · "),flights:[],cached:false}};
  });
}
async function weather(request,url){
  const params=new URLSearchParams(url.searchParams); const lat=params.get("latitude")||params.get("lat"),lon=params.get("longitude")||params.get("lon");
  if(!lat||!lon)return reply(request,{success:false,error:"latitude and longitude are required"},400);
  params.set("latitude",lat);params.set("longitude",lon);params.delete("lat");params.delete("lon");
  return cached(request,`weather/${encodeURIComponent(params.toString())}`,WEATHER_TTL,async()=>({body:await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`)}));
}
function clean(v){return String(v||"").trim().toUpperCase()}
function legacy(result){return {...result,route:{origin:result.origin,destination:result.destination,airline:result.airline?{name:result.airline}:null,airline_name:result.airline,callsign_icao:result.callsign,callsign_iata:null}}}
function parseAirLabs(p,q){const rows=Array.isArray(p?.response)?p.response:p?.response?[p.response]:[];if(!rows.length)return null;const r=rows.find(x=>clean(x.flight_icao)===q||clean(x.flight_iata)===q)||rows[0];const oi=clean(r.dep_iata),oo=clean(r.dep_icao),di=clean(r.arr_iata),dd=clean(r.arr_icao);if(!(oi||oo)||!(di||dd))return null;return legacy({success:true,provider:"airlabs",providerReason:"AirLabs returned a usable route.",callsign:clean(r.flight_icao||r.flight_iata||q),origin:{iata:oi||null,icao:oo||null,name:r.dep_name||r.dep_airport||null},destination:{iata:di||null,icao:dd||null,name:r.arr_name||r.arr_airport||null},registration:r.reg_number||null,hex:clean(r.hex)||null,aircraft:r.aircraft_icao||r.aircraft_model||null,airline:r.airline_name||r.airline_icao||r.airline_iata||null,status:r.status||null,confidence:95,cached:false})}
function parseAdsb(p,q,reason){const r=p?.response?.flightroute||p?.flightroute||p?.route;if(!r)return null;const o=r.origin||r.departure||{},d=r.destination||r.arrival||{};const oi=clean(o.iata_code||o.iata),oo=clean(o.icao_code||o.icao),di=clean(d.iata_code||d.iata),dd=clean(d.icao_code||d.icao);if(!(oi||oo)||!(di||dd))return null;return legacy({success:true,provider:"adsbdb",providerReason:`ADSBDB fallback used because ${reason}`,callsign:q,origin:{iata:oi||null,icao:oo||null,name:o.name||o.municipality||null},destination:{iata:di||null,icao:dd||null,name:d.name||d.municipality||null},registration:null,hex:null,aircraft:null,airline:null,status:null,confidence:70,cached:false})}
async function route(request,env,flight){
  flight=clean(flight);if(!/^[A-Z0-9]{2,10}$/.test(flight))return reply(request,{success:false,error:"Invalid flight parameter"},400);
  return cached(request,`route/${flight}`,ROUTE_OK_TTL,async()=>{let reason="AirLabs returned no usable route.";try{if(!env.AIRLABS_API_KEY)throw new Error("AIRLABS_API_KEY is not configured");const p=await fetchJson(`https://airlabs.co/api/v9/flight?api_key=${encodeURIComponent(env.AIRLABS_API_KEY)}&flight_icao=${encodeURIComponent(flight)}`);const r=parseAirLabs(p,flight);if(r)return {body:r};}catch(e){reason=`AirLabs failed: ${e.message}.`}try{const p=await fetchJson(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(flight)}`);const r=parseAdsb(p,flight,reason);if(r)return {body:r};}catch(e){reason+=` ADSBDB failed: ${e.message}.`}return {status:404,body:{success:false,provider:null,providerReason:reason,callsign:flight,route:null,confidence:0,cached:false,error:"ROUTE UNAVAILABLE"}}});
}
const AIRPORTS={KPHL:{iata:"PHL",icao:"KPHL",name:"Philadelphia International Airport",city:"Philadelphia",latitude:39.8744,longitude:-75.2424,timezone:"America/New_York"},KLAS:{iata:"LAS",icao:"KLAS",name:"Harry Reid International Airport",city:"Las Vegas",latitude:36.084,longitude:-115.1537,timezone:"America/Los_Angeles"},KSFO:{iata:"SFO",icao:"KSFO",name:"San Francisco International Airport",city:"San Francisco",latitude:37.6213,longitude:-122.379,timezone:"America/Los_Angeles"}};
export default {async fetch(request,env){
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(request)});if(request.method!=="GET")return reply(request,{success:false,error:"Method not allowed"},405);if(limited(request))return reply(request,{success:false,error:"Rate limit exceeded"},429,60);
  const url=new URL(request.url),path=url.pathname.replace(/\/+$/,"")||"/";
  if(path==="/health")return reply(request,{success:true,service:"flightwall-api",version:VERSION,airlabsConfigured:Boolean(env.AIRLABS_API_KEY),endpoints:["/flights","/route","/v0/callsign/:flight","/weather","/airport"]});
  if(path==="/flights")return flights(request,url);if(path==="/weather")return weather(request,url);
  if(path==="/airport"){const code=clean(url.searchParams.get("icao")||url.searchParams.get("iata"));const a=Object.values(AIRPORTS).find(x=>x.icao===code||x.iata===code);return a?reply(request,{success:true,airport:a},200,86400):reply(request,{success:false,error:"Airport not found in compact database"},404)}
  const m=path.match(/^\/(?:v0\/)?callsign\/([A-Za-z0-9]{2,10})$/);const q=url.searchParams.get("flight");if(m||q||path==="/route")return route(request,env,m?.[1]||q);
  return reply(request,{success:false,error:"Not found"},404);
}};
