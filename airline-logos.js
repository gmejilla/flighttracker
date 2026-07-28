(() => {
  "use strict";
  const PACKAGE_VERSION = "flightwall-local-png-v3.0.0";
  const LOGO_ROOT = "./logos";
  const records = new Map();
  const iataToIcao = new Map();
  const imageCache = new Map();
  let readyPromise;

  const normalize = value => String(value || "").trim().toUpperCase();
  const compact = value => normalize(value).replace(/[^A-Z0-9]/g, "");

  function ready() {
    if (readyPromise) return readyPromise;
    const items = Array.isArray(window.FLIGHTWALL_AIRLINE_LOGOS)
      ? window.FLIGHTWALL_AIRLINE_LOGOS
      : [];
    for (const item of items) {
      const icao = compact(item.icao);
      if (!icao) continue;
      const record = { ...item, icao, path: `${LOGO_ROOT}/${icao}.png` };
      records.set(icao, record);
      const iata = compact(item.iata);
      if (iata) iataToIcao.set(iata, icao);
    }
    readyPromise = Promise.resolve(items);
    return readyPromise;
  }

  function candidates(flight) {
    const raw = compact(flight?.callsign || flight?.flightNumber || flight?.displayFlightNumber || "");
    const values = [flight?.icaoAirline, flight?.operatorCode, flight?.airlineCode, flight?.iata]
      .map(compact).filter(Boolean);
    if (raw.length >= 3) values.push(raw.slice(0,3));
    if (raw.length >= 2) values.push(raw.slice(0,2));
    return [...new Set(values)];
  }

  function resolve(flight) {
    for (const code of candidates(flight)) {
      if (records.has(code)) return records.get(code);
      const icao = iataToIcao.get(code);
      if (icao && records.has(icao)) return records.get(icao);
    }
    return null;
  }

  function entryFor(airline) {
    if (!airline) return null;
    if (imageCache.has(airline.icao)) return imageCache.get(airline.icao);
    const entry={ airline, image:new Image(), loaded:false, failed:false, loading:true, naturalWidth:1, naturalHeight:1 };
    entry.image.decoding="async";
    entry.image.onload=()=>{ entry.loaded=true; entry.failed=false; entry.loading=false; entry.naturalWidth=entry.image.naturalWidth||1; entry.naturalHeight=entry.image.naturalHeight||1; };
    entry.image.onerror=()=>{ entry.failed=true; entry.loading=false; console.warn(`Missing local airline logo: ${airline.path}`); };
    entry.image.src=airline.path;
    imageCache.set(airline.icao,entry);
    return entry;
  }

  function preload(flight) { return entryFor(resolve(flight)); }
  function measure(ctx,flight) { const a=resolve(flight),e=entryFor(a); return !a?null:{width:e?.naturalWidth||160,height:e?.naturalHeight||90,topOffset:0,loading:!e?.loaded}; }

  function drawFit(ctx,flight,box,options={}) {
    const airline=resolve(flight); if(!airline) return null;
    const e=entryFor(airline); if(!e?.loaded) return { ...box, airline, loading:true };
    const x=Number(box?.x||0),y=Number(box?.y||0),width=Math.max(1,Number(box?.width||1)),height=Math.max(1,Number(box?.height||1));
    const padding=Math.max(0,Number(options.padding||0)), iw=Math.max(1,width-padding*2), ih=Math.max(1,height-padding*2);
    const scale=Math.min(iw/e.naturalWidth,ih/e.naturalHeight), dw=Math.max(1,e.naturalWidth*scale), dh=Math.max(1,e.naturalHeight*scale);
    const dx=x+(width-dw)/2,dy=y+(height-dh)/2;
    ctx.save(); ctx.globalAlpha=Number(options.alpha??1)*Number(options.brightness??1); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high";
    ctx.beginPath();ctx.rect(x,y,width,height);ctx.clip();ctx.drawImage(e.image,dx,dy,dw,dh);ctx.restore();
    return {x:dx,y:dy,width:dw,height:dh,airline,loaded:true};
  }
  function draw(ctx,flight,x,y,options={}) { const size=Math.max(1,Number(options.size||80)); return drawFit(ctx,flight,{x,y,width:size*2.2,height:size},options)?.width||0; }
  function list(){ return [...records.values()].map(a=>({...a,iconUrl:a.path,logoUrl:a.path})); }

  ready();
  window.AirlineLogos=Object.freeze({ready,resolve,preload,measure,draw,drawFit,list,count:()=>records.size,packageVersion:PACKAGE_VERSION,source:"Local ICAO PNG logo pack",assetRoot:LOGO_ROOT});
})();