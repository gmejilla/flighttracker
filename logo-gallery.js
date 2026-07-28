(() => {
 const grid=document.getElementById("grid"),filter=document.getElementById("filter"),summary=document.getElementById("summary");
 function render(items){const term=filter.value.trim().toLowerCase();const visible=items.filter(x=>[x.name,x.iata,x.icao,x.country].some(v=>String(v||"").toLowerCase().includes(term)));summary.textContent=`${visible.length} of ${items.length} local airline logos`;grid.innerHTML=visible.map(x=>`<article class="card"><div class="logo-box"><img src="${x.iconUrl}" alt="${x.name} logo"></div><div><div class="name">${x.name}</div><div class="codes">${x.iata||"—"} · ${x.icao}</div></div></article>`).join("");}
 window.AirlineLogos.ready().then(()=>{const items=window.AirlineLogos.list();filter.addEventListener("input",()=>render(items));render(items);});
})();