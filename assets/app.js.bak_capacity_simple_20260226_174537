(() => {
  "use strict";

  const CONFIG = {
    DATA_URL: "data/events.json",
    LOGO_BASE: "logos/",
    LOGO_EXTS: ["png","webp","jpg","jpeg","svg"],
    PLACEHOLDER: "logos/_placeholder.svg",

    PAGINATION_PAGE_SIZE: 12,
    PAGINATION_THRESHOLD: 40,

    CLUSTER_THRESHOLD: 40,

    MAP_DEFAULT_CENTER: [45.0, -60.0],
    MAP_DEFAULT_ZOOM: 4,
    MAP_FIT_PADDING: 0.22
  };

  const $ = (sel, root=document) => root.querySelector(sel);

  // ---------- UTC date helpers ----------
  function isoToUTCDate(iso){
    const m = (iso||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m) return null;
    const dt = new Date(Date.UTC(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10)));
    return isNaN(dt.getTime()) ? null : dt;
  }
  function todayUTC(){
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  }
  function daysUntilUTC(startISO){
    const sd = isoToUTCDate(startISO);
    if(!sd) return null;
    const t = todayUTC();
    return Math.ceil((sd.getTime() - t.getTime()) / 86400000);
  }
  function badgeJ(startISO){
    const d = daysUntilUTC(startISO);
    if(d === null) return "J-—";
    if(d < 0) return null;
    if(d === 0) return "Aujourd’hui";
    return `J-${d}`;
  }
  function dateBadge(ev){
    const sd = ev.start_date || "";
    const ed = ev.end_date || "";
    const ms = sd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const me = ed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(ms && me && ms[1]===me[1] && ms[2]===me[2]){
      return `${ms[3]}–${me[3]}.${ms[2]}.${ms[1]}`;
    }
    const fmt = (iso) => {
      const m = (iso||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
    };
    return `${fmt(sd)} → ${fmt(ed)}`;
  }

  function seasonIcon(season){
    const s = (season||"").toLowerCase().trim();
    if(s==="winter") return "❄️";
    if(s==="spring") return "🌱";
    if(s==="summer") return "☀️";
    if(s==="fall")   return "🍂";
    return "📅";
  }

  function normalizeLevel(v){
    v = (v||"").toLowerCase().trim();
    if(v === "élite") v = "elite";
    return v;
  }
  function levelMatches(evLevel, selected){
    const el = normalizeLevel(evLevel);
    const sl = normalizeLevel(selected);
    if(!sl) return true;
    if(el === "both") return true;
    return el === sl;
  }
  function yearsContains(yearsArr, y){
    return Array.isArray(yearsArr) && yearsArr.includes(y);
  }
  function isTravel(ev){ return (ev.region||"").toLowerCase().trim() === "travel"; }

  function validateEvent(ev){
    const required = ["id","type","title_fr","start_date","end_date","season","region","years","level","city","country","logo","source_url","player_price","currency","availability_field"];
    for(const k of required){
      if(ev[k] === undefined || ev[k] === null || ev[k] === "") return false;
    }
    if(!Array.isArray(ev.years) || ev.years.length === 0) return false;
    const sd = isoToUTCDate(ev.start_date);
    const ed = isoToUTCDate(ev.end_date);
    if(!sd || !ed) return false;
    if(sd.getTime() > ed.getTime()) return false; // start <= end
    return true;
  }

  // ---------- Logo fallback ----------
  function splitNameAndExt(name){
    const s=(name||"").toString().trim(); if(!s) return {base:"", ext:""};
    const noPath=s.split("/").pop();
    const m=noPath.match(/^(.*)\.([^.]+)$/);
    return m?{base:m[1], ext:(m[2]||"").toLowerCase()}:{base:noPath, ext:""};
  }
  function candidateLogoUrls(baseName){
    const {base, ext} = splitNameAndExt(baseName);
    if(!base) return [CONFIG.PLACEHOLDER];
    const out = [];
    if(ext){
      out.push(`${CONFIG.LOGO_BASE}${base}.${ext}`);
      for(const e of CONFIG.LOGO_EXTS) if(e!==ext) out.push(`${CONFIG.LOGO_BASE}${base}.${e}`);
    } else {
      for(const e of CONFIG.LOGO_EXTS) out.push(`${CONFIG.LOGO_BASE}${base}.${e}`);
    }
    out.push(CONFIG.PLACEHOLDER);
    return out;
  }
  function escapeHtml(s){
    return (s||"").toString()
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function escapeAttr(s){ return escapeHtml(s).replace(/"/g,"%22"); }

  function setImgWithFallback(img, baseName, alt){
    const urls = candidateLogoUrls(baseName);
    let i = 0;
    img.alt = alt || "";
    img.loading = "lazy";
    img.decoding = "async";
    img.style.visibility = "visible";
    img.src = urls[i];
    img.onerror = () => { i++; if(i < urls.length) img.src = urls[i]; else img.style.visibility="hidden"; };
  }

  // ---------- DOM ----------
  const els = {
    yearChips: null,
    levelChips: null,
    travelToggle: null,
    vtList: null,
    vtMap: null,
    list: null,
    tplCard: null,
    mapWrap: null,
    programMsg: null,
    programErr: null,

    birthYear: null,
    playerLevel: null,
    parentEmail: null,
    emailAlias: null,
    conf: null,
    confVal: null,

    availList: null,
    tplAvail: null,
    form: null,

    // pagination
    paginationWrap: null,
    loadMoreBtn: null,
    pageMeta: null,
  };

  const state = {
    year: "",
    level: "",
    includeTravel: false,
    view: "list",
    page: 1
  };

  let ALL = [];

  // ---------- Messages ----------
  function showMsg(text){
    els.programMsg.style.display = "";
    els.programMsg.textContent = text;
    els.programMsg.setAttribute("aria-live","polite");
  }
  function hideMsg(){
    els.programMsg.style.display = "none";
    els.programMsg.textContent = "";
  }
  function showError(text){
    els.programErr.style.display = "";
    els.programErr.textContent = text;
    els.programErr.setAttribute("aria-live","assertive");
  }
  function hideError(){
    els.programErr.style.display = "none";
    els.programErr.textContent = "";
  }

  // ---------- Chips ----------
  function setActiveChip(container, value){
    Array.from(container.querySelectorAll(".chip")).forEach(btn => {
      btn.classList.toggle("active", btn.dataset.value === value);
    });
  }
  function setYear(val, syncToForm){
    state.year = (val||"").trim();
    state.page = 1; // reset pagination on filter change
    setActiveChip(els.yearChips, state.year);
    if(syncToForm && els.birthYear) els.birthYear.value = state.year;
    apply();
  }
  function setLevel(val, syncToForm){
    state.level = (val||"").trim();
    state.page = 1; // reset pagination
    setActiveChip(els.levelChips, state.level);
    if(syncToForm && els.playerLevel) els.playerLevel.value = state.level;
    apply();
  }

  function renderYearChips(events){
    const yearsSet = new Set();
    events.forEach(ev => ev.years.forEach(y => yearsSet.add(y)));
    const years = Array.from(yearsSet).sort((a,b)=>a-b);

    els.yearChips.innerHTML = "";
    years.forEach(y => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = String(y);
      b.dataset.value = String(y);
      b.setAttribute("aria-label", `Year ${y}`);
      b.addEventListener("click", () => setYear(String(y), true));
      els.yearChips.appendChild(b);
    });

    const initial = (els.birthYear && els.birthYear.value) ? els.birthYear.value : (years[0] ? String(years[0]) : "");
    setYear(initial, true);
  }

  function renderLevelChips(events){
    const levelsSet = new Set();
    events.forEach(ev => levelsSet.add(normalizeLevel(ev.level)));
    const levels = Array.from(levelsSet).filter(l => l && l !== "both");
    const order = ["elite","aaa"];
    const finalLevels = order.filter(l => levels.includes(l));

    els.levelChips.innerHTML = "";
    finalLevels.forEach(lvl => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.dataset.value = lvl;
      b.textContent = (lvl === "elite") ? "Élite / Elite" : "AAA";
      b.setAttribute("aria-label", `Level ${lvl}`);
      b.addEventListener("click", () => setLevel(lvl, true));
      els.levelChips.appendChild(b);
    });

    const initial = (els.playerLevel && els.playerLevel.value) ? els.playerLevel.value : "elite";
    setLevel(initial, true);
  }

  // ---------- Filtering / sorting ----------
  function filteredEvents(){
    const y = parseInt(state.year,10);
    const lvl = normalizeLevel(state.level);
    const t = todayUTC();

    return ALL
      .filter(ev => {
        const start = isoToUTCDate(ev.start_date);
        if(!start) return false;
        if(start.getTime() <= t.getTime()) return false; // future only
        if(!yearsContains(ev.years, y)) return false;
        if(lvl && !levelMatches(ev.level, lvl)) return false;
        if(isTravel(ev) && !state.includeTravel) return false;
        return true;
      })
      .sort((a,b) => isoToUTCDate(a.start_date).getTime() - isoToUTCDate(b.start_date).getTime());
  }

  // ---------- Pagination ----------
  function applyPagination(allEvents){
    // enable pagination only if total > threshold
    if(allEvents.length <= CONFIG.PAGINATION_THRESHOLD){
      return { slice: allEvents, total: allEvents.length, showing: allEvents.length, paginated: false };
    }
    const pageSize = CONFIG.PAGINATION_PAGE_SIZE;
    const showing = Math.min(allEvents.length, state.page * pageSize);
    const slice = allEvents.slice(0, showing);
    return { slice, total: allEvents.length, showing, paginated: true };
  }

  function updatePaginationUI(info){
    if(!els.paginationWrap) return;
    els.paginationWrap.style.display = info.paginated ? "" : "none";
    if(!info.paginated) return;

    els.pageMeta.textContent = `${info.showing} / ${info.total}`;
    const canMore = info.showing < info.total;
    els.loadMoreBtn.disabled = !canMore;
  }

  // ---------- Render cards ----------
  function renderCards(info){
    const events = info.slice;

    els.list.innerHTML = "";

    if(!state.year){
      showMsg("Sélectionnez une année. / Select a year.");
      updatePaginationUI({paginated:false,total:0,showing:0,slice:[]});
      return;
    }

    if(events.length === 0){
      showMsg("Aucun événement ne correspond à vos critères. / No events match your filters.");
      updatePaginationUI({paginated:false,total:0,showing:0,slice:[]});
      return;
    }
    hideMsg();

    events.forEach(ev => {
      const node = els.tplCard.content.cloneNode(true);
      const link = node.querySelector(".ecard-link");
      const img  = node.querySelector(".ecard-logo");
      const bSeason = node.querySelector(".badge-season");
      
      const bLevel  = node.querySelector(".badge-level");
const bJ = node.querySelector(".badge-j");
      const bDate = node.querySelector(".badge-date");
      const bExtra = node.querySelector(".badge-extra");

      const title = ev.title_fr || ev.id;
      link.href = ev.source_url || "#";
      link.title = title;

      setImgWithFallback(img, ev.logo || ev.id, title);

      bSeason.textContent = seasonIcon(ev.season);

      if(bLevel){
        const lvl = (ev.level||"").toLowerCase().trim();
        bLevel.classList.remove("elite","aaa");
        if(lvl === "aaa"){
          bLevel.textContent = "AAA";
          bLevel.classList.add("aaa");
        } else if(lvl === "both"){
          bLevel.textContent = "ÉLITE / AAA";
          bLevel.classList.add("elite");
        } else {
          bLevel.textContent = "ÉLITE";
          bLevel.classList.add("elite");
        }
      }const jtxt = badgeJ(ev.start_date);
      bJ.textContent = jtxt || "";
      bDate.textContent = dateBadge(ev);

      let extra = "";
      if(isTravel(ev)) extra += "✈️";
      if((ev.type||"").toLowerCase().trim()==="camp") extra += (extra ? " " : "") + "🏕️";
      if(extra){
        bExtra.style.display = "";
        bExtra.textContent = extra;
      } else {
        bExtra.style.display = "none";
      }

      els.list.appendChild(node);
    });

    updatePaginationUI(info);
  }

  // ---------- Render availability ----------
  function renderAvailability(events){
    els.availList.innerHTML = "";

    events.forEach(ev => {
      const node = els.tplAvail.content.cloneNode(true);
      const titleEl = node.querySelector(".avail-title");
      const infoEl  = node.querySelector(".avail-info");
      const radios  = node.querySelectorAll('input[type="radio"]');

      const title = ev.title_fr || ev.id;
      titleEl.textContent = `${ev.city} — ${title}`;

      const price = (ev.player_price === "TBD" || ev.player_price === null) ? "TBD" : `${ev.player_price} ${ev.currency||"CAD"}`;
      infoEl.textContent = `• ${dateBadge(ev)} • Prix (info): ${price}`;

      const field = ev.availability_field || `avail__${ev.id}`;
      radios.forEach(r => { r.name = field; });

      const tbd = Array.from(radios).find(r => r.value === "TBD");
      if(tbd) tbd.checked = true;

      els.availList.appendChild(node);
    });
  }

  // ---------- MAP (clustering + fallback tiles) ----------
  let map = null;
  let oms = null;
  let markers = [];
  let clusterLayer = null;

  function ensureMap(){
    if(map) return;
    if(typeof window.L === "undefined") return;

    map = window.L.map("map", { zoomControl:true, worldCopyJump:true }).setView(CONFIG.MAP_DEFAULT_CENTER, CONFIG.MAP_DEFAULT_ZOOM);

    // Primary tiles: CARTO Dark
    const carto = window.L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { detectRetina: true, maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
    });

    // Fallback tiles: OSM
    const osm = window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    });

    carto.addTo(map);

    // If CARTO fails, switch silently to OSM and show a soft message
    carto.on("tileerror", () => {
      if(map && !map.hasLayer(osm)){
        try{ map.removeLayer(carto); }catch(e){}
        osm.addTo(map);
        showMsg("Carte: tuiles alternatives activées. / Map: fallback tiles enabled.");
      }
    });

    if(typeof window.OverlappingMarkerSpiderfier !== "undefined"){
      oms = new window.OverlappingMarkerSpiderfier(map, { keepSpiderfied:true, nearbyDistance:30, circleSpiralSwitchover:9 });
      oms.addListener("click", m => m.openPopup());
    }

    window.addEventListener("resize", () => { try{ map.invalidateSize(true); }catch(e){} });
  }

  function makeLogoIcon(ev){
    const title = ev.title_fr || ev.id;
    const urls = candidateLogoUrls(ev.logo || ev.id);
    const imgSrc = urls[0] || CONFIG.PLACEHOLDER;
    const html = `<div class="logo-marker" title="${escapeAttr(title)}"><img src="${escapeAttr(imgSrc)}" alt="${escapeAttr(title)}" onerror="this.style.display='none'"></div>`;
    return window.L.divIcon({ className:"", html, iconSize:[46,46], iconAnchor:[23,23], popupAnchor:[0,-18] });
  }

  function clearMapLayers(){
    if(!map) return;
    markers.forEach(m => { try{ map.removeLayer(m);}catch(e){} });
    markers = [];
    if(clusterLayer){
      try{ map.removeLayer(clusterLayer); }catch(e){}
      clusterLayer = null;
    }
  }

  function updateMap(events){
    if(!map) return;

    clearMapLayers();

    // Reference marker: Québec HC (always visible)
    try{
      const qhcTitle = "Québec HC";
      const qhcIcon = makeLogoIcon({ id: "qhc", logo: "qhc.jpg", title_fr: qhcTitle }, qhcTitle);
      const qhcMarker = window.L.marker([46.8139, -71.2080], { icon: qhcIcon })
        .bindPopup('<div style="min-width:200px"><div style="font-weight:800">Québec HC</div><div style="opacity:.85">Québec, QC</div></div>');
      if(clusterLayer){ clusterLayer.addLayer(qhcMarker); }
      else { qhcMarker.addTo(map); markers.push(qhcMarker); if(oms) oms.addMarker(qhcMarker); }
    }catch(e){}

    const pts = [];
    const points = events
  .map(ev => {
    const lat = Number(ev.lat);
    const lng = Number(ev.lng);
    return (Number.isFinite(lat) && Number.isFinite(lng)) ? ({ ...ev, lat, lng }) : null;
  })
  .filter(Boolean);

    // if many markers => cluster
    const useCluster = points.length > CONFIG.CLUSTER_THRESHOLD && typeof window.L.markerClusterGroup === "function";

    if(useCluster){
      clusterLayer = window.L.markerClusterGroup();
    }

    points.forEach(ev => {
      pts.push([ev.lat, ev.lng]);

      const title = ev.title_fr || ev.id;
      const popup = `<div style="min-width:220px">
        <div style="font-weight:800; margin-bottom:6px">${escapeHtml(title)}</div>
        <div style="opacity:.85">${escapeHtml(ev.city||"")}${ev.country ? ", " + escapeHtml(ev.country) : ""}</div>
        <div style="opacity:.85">Dates: ${escapeHtml(dateBadge(ev))}</div>
        <div style="opacity:.85">${escapeHtml(badgeJ(ev.start_date) || "")}</div>
        <div style="margin-top:8px"><a href="${escapeAttr(ev.source_url||"#")}" target="_blank" rel="noopener">Page officielle</a></div>
      </div>`;

      const marker = window.L.marker([ev.lat, ev.lng], { icon: makeLogoIcon(ev) }).bindPopup(popup);

      if(useCluster){
        clusterLayer.addLayer(marker);
      } else {
        marker.addTo(map);
        markers.push(marker);
        if(oms) oms.addMarker(marker);
      }
    });

    if(useCluster && clusterLayer){
      clusterLayer.addTo(map);
    }

        // QHC_FIT_POINT: always include Québec reference in fitBounds
    pts.push([46.8139, -71.2080]);

    if(pts.length){
      const b = window.L.latLngBounds(pts);
      map.fitBounds(b.pad(CONFIG.MAP_FIT_PADDING));
    }
  }

  function setView(view){
    state.view = view;
    if(view === "map"){
      els.vtMap.classList.add("active");
      els.vtList.classList.remove("active");
      els.mapWrap.style.display = "";
      $("#events_list_wrap").style.display = "none";

      ensureMap();
      setTimeout(() => {
        try{ map.invalidateSize(true); }catch(e){}
        updateMap(filteredEvents());
      }, 120);

    } else {
      els.vtList.classList.add("active");
      els.vtMap.classList.remove("active");
      els.mapWrap.style.display = "none";
      $("#events_list_wrap").style.display = "";
    }
  }

  // ---------- Apply ----------
  function apply(){
    if(!state.year){
      renderCards({slice:[], total:0, showing:0, paginated:false});
      renderAvailability([]);
      return;
    }

    const evsAll = filteredEvents();
    const pageInfo = applyPagination(evsAll);

    renderCards(pageInfo);
    renderAvailability(evsAll);

    if(state.view === "map"){
      ensureMap();
      setTimeout(() => {
        try{ map.invalidateSize(true); }catch(e){}
        updateMap(evsAll);
      }, 120);
    }
  }

  // ---------- Form helpers ----------
  function updateConfidenceUI(){
    if(!els.conf || !els.confVal) return;
    els.confVal.textContent = `${els.conf.value}%`;
    els.conf.setAttribute("aria-valuenow", els.conf.value);
  }
  function syncEmailAlias(){
    if(!els.parentEmail || !els.emailAlias) return;
    els.emailAlias.value = (els.parentEmail.value||"").trim();
  }

  // businessOk
  window.businessOk = function(){
    const form = els.form || $("#qhc-form");
    if(!form) return true;

    if(!form.checkValidity()){
      form.reportValidity();
      return false;
    }

    const conf = parseInt(els.conf ? els.conf.value : "0", 10);
    if(isNaN(conf) || conf < 80){
      alert("Confiance ≥ 80 % / Confidence ≥ 80%.");
      return false;
    }

    const primary = form.querySelector('input[name="primary_position"]:checked')?.value || "";
    const isGoalie = (primary||"").toLowerCase().includes("goal");
    if(!isGoalie){
      const right = form.querySelector('[name="side_right"]')?.checked;
      const left  = form.querySelector('[name="side_left"]')?.checked;
      if(!right && !left){
        alert("Sélectionnez au moins un côté (Droit/Gauche). / Select at least one side.");
        return false;
      }
    }

    syncEmailAlias();
    return true;
  };

  // ---------- Boot ----------
  async function init(){
    els.yearChips = $("#year_chips");
    els.levelChips = $("#level_chips");
    els.travelToggle = $("#travel_toggle");
    els.vtList = $("#vt_list");
    els.vtMap = $("#vt_map");
    els.list = $("#events_list");
    els.tplCard = $("#tpl_event_card");
    els.mapWrap = $("#map_wrap");
    els.programMsg = $("#program_msg");
    els.programErr = $("#program_error");

    els.birthYear = $("#birth_year");
    els.playerLevel = $("#player_level");
    els.parentEmail = $("#parent_email");
    els.emailAlias = $("#emailAlias");
    els.conf = $("#confidence_pct");
    els.confVal = $("#confVal");
    els.availList = $("#availability_list");
    els.tplAvail = $("#tpl_avail_row");
    els.form = $("#qhc-form");

    // pagination UI (inject once)
    const listWrap = $("#events_list_wrap");
    els.paginationWrap = document.createElement("div");
    els.paginationWrap.className = "pagination";
    els.paginationWrap.style.display = "none";
    els.paginationWrap.innerHTML = `
      <button type="button" class="load-more" id="load_more">Voir plus / Load more</button>
      <div class="meta" id="page_meta"></div>
    `;
    listWrap.appendChild(els.paginationWrap);
    els.loadMoreBtn = $("#load_more");
    els.pageMeta = $("#page_meta");

    els.loadMoreBtn.addEventListener("click", () => {
      state.page += 1;
      apply();
    });

    // hero logo fallback
    const hero = $("#hero_logo");
    if(hero){
      const raw = (hero.getAttribute("src")||"qhc").replace(/^logos\//i,"");
      setImgWithFallback(hero, raw, "Logo Québec HC");
    }

    // slider UI
    if(els.conf){
      els.conf.addEventListener("input", updateConfidenceUI);
      updateConfidenceUI();
    }

    // email alias
    if(els.parentEmail){
      els.parentEmail.addEventListener("input", syncEmailAlias);
      syncEmailAlias();
    }

    // view buttons
    els.vtList.addEventListener("click", () => { setView("list"); apply(); });
    els.vtMap.addEventListener("click", () => { setView("map"); apply(); });

    // toggle travel
    els.travelToggle.addEventListener("change", () => {
      state.includeTravel = !!els.travelToggle.checked;
      state.page = 1;
      apply();
    });

    // sync year/level from form -> chips
    els.birthYear.addEventListener("change", () => setYear(els.birthYear.value, false));
    els.playerLevel.addEventListener("change", () => setLevel(els.playerLevel.value, false));

    // load JSON
    hideError();
    try{
      const res = await fetch(`${CONFIG.DATA_URL}?v=${Date.now()}`, { cache:"no-store" });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      const arr = Array.isArray(raw.events) ? raw.events : [];
      ALL = arr.filter(validateEvent);

      renderYearChips(ALL);
      renderLevelChips(ALL);

      setView("list");
      apply();
    }catch(e){
      console.error("Failed to load events.json:", e);
      showError("Impossible de charger la programmation. Veuillez réessayer. / Unable to load schedule. Please retry.");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();









