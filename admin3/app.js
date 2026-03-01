// admin3/app.js — QHC Admin V3 (CLEAN, PRO)
// Requires API actions: login, meta, players, inscriptions, team_members, mutate
(() => {
  const API_BASE = "https://script.google.com/macros/s/AKfycbw3ry7QA7HHlFcsP7HLDmp4DPqXt0qTQaF23ffvoRzFjxq3eFvfBpanKkqkjNrBCE0/exec";
  const LS_TOKEN = "qhc_admin_token";
  const LS_EXP   = "qhc_admin_expiresAt";

  const $ = (id) => document.getElementById(id);
  const setText = (id, t) => { const el = $(id); if (el) el.textContent = t || ""; };

  function jsonp(action, params = {}) {
    return new Promise((resolve, reject) => {
      const cb = "__qhc_cb_" + Math.random().toString(36).slice(2);
      const timer = setTimeout(() => { cleanup(); reject(new Error("JSONP timeout")); }, 25000);

      function cleanup() {
        clearTimeout(timer);
        delete window[cb];
        if (script && script.parentNode) script.parentNode.removeChild(script);
      }

      window[cb] = (data) => { cleanup(); resolve(data); };

      const q = new URLSearchParams({ action, callback: cb, ...params });
      const script = document.createElement("script");
      script.src = `${API_BASE}?${q.toString()}`;
      script.async = true;
      script.onerror = () => { cleanup(); reject(new Error("JSONP network error")); };
      document.head.appendChild(script);
    });
  }

  function token() { return localStorage.getItem(LS_TOKEN) || ""; }
  function expired() {
    const iso = localStorage.getItem(LS_EXP);
    if (!iso) return false;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? Date.now() > ms : false;
  }
  function setToken(tok, expIso) { localStorage.setItem(LS_TOKEN, tok || ""); localStorage.setItem(LS_EXP, expIso || ""); }
  function clearToken() { localStorage.removeItem(LS_TOKEN); localStorage.removeItem(LS_EXP); }

  function pageKind() {
    const p = location.pathname.toLowerCase();
    return {
      login: p.endsWith("/admin3/login.html"),
      dash:  p.endsWith("/admin3/dashboard.html"),
    };
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ---------------- LOGIN ----------------
  async function initLogin() {
    if (token() && !expired()) { location.href = "./dashboard.html"; return; }

    const pwd = $("pwd");
    $("btnClear")?.addEventListener("click", () => {
      pwd.value = "";
      setText("msg", "");
      pwd.focus();
    });

    $("btnLogin")?.addEventListener("click", async () => {
      setText("msg", "Connexion...");
      try {
        const res = await jsonp("login", { password: (pwd.value || "").trim() });
        if (!res || !res.success) {
          setText("msg", res?.error || res?.message || "Login refusé");
          return;
        }
        setToken(res.token, res.expiresAt);
        location.href = "./dashboard.html";
      } catch (e) {
        setText("msg", "Erreur API: " + (e.message || String(e)));
      }
    });

    pwd?.addEventListener("keydown", (e) => { if (e.key === "Enter") $("btnLogin")?.click(); });
    pwd?.focus();
  }

  // ---------------- DASHBOARD STATE ----------------
  let META = null;
  const STATE = {
    page: 1,
    pageSize: 100,
    year: "",
    statut: "",
    search: "",
    tournoi_id: "",
    equipe_id: "",
    sortBy: "player_name",
    sortDir: "asc",
    showArchived: false,

    players: [],
    inscriptionsMap: {},
    teamMembers: null,
    totalPages: 1
  };

  function selectedIds() {
    return Array.from(document.querySelectorAll(".rowcb:checked")).map(x => x.dataset.id);
  }
  function updateSelCount() { setText("selCount", String(selectedIds().length)); }

  async function api(action, params = {}) {
    const tok = token();
    const res = await jsonp(action, { token: tok, ...params });
    if (!res || !res.success) throw new Error(res?.error || `API ${action} failed`);
    return res;
  }

  function fillSelect(sel, values, placeholder) {
    if (!sel) return;
    sel.innerHTML = "";
    if (placeholder !== undefined) {
      const o = document.createElement("option");
      o.value = "";
      o.textContent = placeholder;
      sel.appendChild(o);
      values = values.filter(v => v !== "");
    }
    for (const v of values) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    }
  }

  function fillSelectObj(sel, arr, key, labelKey) {
    if (!sel) return;
    sel.innerHTML = "";
    for (const it of arr) {
      const o = document.createElement("option");
      o.value = String(it[key] || "");
      o.textContent = String(it[labelKey] || it[key] || "");
      sel.appendChild(o);
    }
  }

  async function loadMeta() {
    META = await api("meta");

    fillSelect($("yearFilter"), ["", ...((META.years || []).map(String))], "Toutes");
    fillSelect($("statusFilter"), ["", ...((META.statuts || []).map(String))], "Tous statuts");

    // statusApply dropdown
    const sApply = $("statusApply");
    if (sApply) {
      sApply.innerHTML = "";
      const o0 = document.createElement("option");
      o0.value = "";
      o0.textContent = "Choisir statut…";
      sApply.appendChild(o0);

      for (const s of (META.statuts || [])) {
        const o = document.createElement("option");
        o.value = String(s);
        o.textContent = String(s);
        sApply.appendChild(o);
      }
    }

    const tournois = [{ tournoi_id:"", nom_complet:"Tous tournois" }].concat(META.tournois || []);
    fillSelectObj($("tournoiSelect"), tournois, "tournoi_id", "nom_complet");

    const equipes = [{ equipe_id:"", nom_equipe:"Toutes équipes" }].concat(META.equipes || []);
    fillSelectObj($("teamSelect"), equipes, "equipe_id", "nom_equipe");
  }

  async function loadPlayers() {
    const res = await api("players", {
      page: String(STATE.page),
      page_size: String(STATE.pageSize),
      year: STATE.year,
      statut: STATE.statut,
      search: STATE.search,
      sort_by: STATE.sortBy,
      sort_dir: STATE.sortDir,
      show_archived: STATE.showArchived ? "TRUE" : ""
    });

    STATE.players = res.players || [];
    STATE.totalPages = res.total_pages || 1;
    setText("pageNum", String(res.page || STATE.page));
    setText("pageTotal", String(STATE.totalPages));
  }

  async function loadInscriptions() {
    STATE.inscriptionsMap = {};
    if (!STATE.tournoi_id) return;
    const res = await api("inscriptions", { tournoi_id: STATE.tournoi_id });
    STATE.inscriptionsMap = res.map || {};
  }

  async function loadTeamMembers() {
    STATE.teamMembers = null;
    if (!STATE.equipe_id) return;
    const res = await api("team_members", { equipe_id: STATE.equipe_id });
    STATE.teamMembers = new Set((res.timestamps || []).map(String));
  }

  function buildHeader() {
    const tr = $("theadRow");
    if (!tr) return;
    tr.innerHTML = "";

    const cols = [
      { k:"_sel", label:"" },
      { k:"player_name", label:"Nom" },
      { k:"birth_year", label:"Année" },
      { k:"city", label:"Ville" },
      { k:"parent_email", label:"Email" },
      { k:"primary_position", label:"Poste" },
      { k:"_sides", label:"Côté(s)" },
      { k:"statut", label:"Statut" },
      { k:"notes", label:"Notes" }
    ];
    if (STATE.tournoi_id) cols.push({ k:"_rep", label:`Réponse (${STATE.tournoi_id})` });

    for (const c of cols) {
      const th = document.createElement("th");

      if (c.k === "_sel") {
        th.innerHTML = `<input type="checkbox" id="cbAll">`;
      } else {
        th.textContent = c.label;
        th.style.cursor = c.k.startsWith("_") ? "default" : "pointer";
        if (!c.k.startsWith("_")) {
          th.onclick = () => {
            if (STATE.sortBy === c.k) STATE.sortDir = (STATE.sortDir === "asc" ? "desc" : "asc");
            else { STATE.sortBy = c.k; STATE.sortDir = "asc"; }
            STATE.page = 1;
            refresh();
          };
        }
      }
      tr.appendChild(th);
    }

    $("cbAll")?.addEventListener("change", (e) => {
      const v = e.target.checked;
      document.querySelectorAll(".rowcb").forEach(cb => cb.checked = v);
      updateSelCount();
    });
  }

  function playerSides(p) {
    const left = String(p.side_left || "").toLowerCase() === "yes" || String(p.side_left || "").toLowerCase() === "on";
    const right = String(p.side_right || "").toLowerCase() === "yes" || String(p.side_right || "").toLowerCase() === "on";
    return (left ? "L" : "") + (right ? (left ? "/R" : "R") : "");
  }

  function renderDesktopTable() {
    buildHeader();
    const tb = $("tbody");
    if (!tb) return;
    tb.innerHTML = "";

    for (const p of STATE.players) {
      const jt = String(p.Timestamp || p.timestamp || "");
      if (!jt) continue;
      if (STATE.teamMembers && !STATE.teamMembers.has(jt)) continue;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input class="rowcb" type="checkbox" data-id="${esc(jt)}"></td>
        <td>${esc(p.player_name || "")}</td>
        <td>${esc(p.birth_year || "")}</td>
        <td>${esc(p.city || "")}</td>
        <td>${esc(p.parent_email || "")}</td>
        <td>${esc(p.primary_position || "")}</td>
        <td>${esc(playerSides(p))}</td>
        <td>${esc(p.statut || "")}</td>
        <td>${esc(p.notes || "")}</td>
      `;

      if (STATE.tournoi_id) {
        const rep = STATE.inscriptionsMap[jt] || "";
        const td = document.createElement("td");
        td.innerHTML = `
          <select class="repSel" data-jt="${esc(jt)}">
            <option value="" ${rep===""?"selected":""}></option>
            <option value="Yes" ${rep==="Yes"?"selected":""}>Yes</option>
            <option value="No" ${rep==="No"?"selected":""}>No</option>
            <option value="TBD" ${rep==="TBD"?"selected":""}>TBD</option>
          </select>
        `;
        tr.appendChild(td);
      }

      tb.appendChild(tr);
    }

    document.querySelectorAll(".rowcb").forEach(cb => cb.addEventListener("change", updateSelCount));
    updateSelCount();

    if (STATE.tournoi_id) {
      document.querySelectorAll(".repSel").forEach(sel => {
        sel.addEventListener("change", async (e) => {
          const jt = e.target.dataset.jt;
          const val = e.target.value;
          try {
            setText("err","");
            await api("mutate", { op: "set_inscription_reponse", payload: JSON.stringify({ joueur_timestamp: jt, tournoi_id: STATE.tournoi_id, reponse: val }) });
            await loadInscriptions();
          } catch (err) {
            setText("err", err.message || String(err));
          }
        });
      });
    }
  }

  function renderMobileCards() {
    const wrap = $("cards");
    if (!wrap) return;
    wrap.innerHTML = "";

    for (const p of STATE.players) {
      const jt = String(p.Timestamp || p.timestamp || "");
      if (!jt) continue;
      if (STATE.teamMembers && !STATE.teamMembers.has(jt)) continue;

      const rep = STATE.tournoi_id ? (STATE.inscriptionsMap[jt] || "") : "";
      const card = document.createElement("div");
      card.className = "pcard";
      card.innerHTML = `
        <div class="top">
          <input class="rowcb" type="checkbox" data-id="${esc(jt)}" style="margin-top:3px">
          <div style="flex:1">
            <div class="name">${esc(p.player_name || "")}</div>
            <div class="line">${esc(p.birth_year || "")} • ${esc(p.city || "")}</div>
            <div class="line">${esc(p.primary_position || "")} • ${esc(playerSides(p) || "—")}</div>
          </div>
        </div>
        <div class="badges">
          <span class="badge">${esc(p.parent_email || "")}</span>
          ${p.statut ? `<span class="badge gold">${esc(p.statut)}</span>` : `<span class="badge">Statut: —</span>`}
          ${p.notes ? `<span class="badge">${esc(p.notes)}</span>` : ``}
          ${STATE.tournoi_id ? `<span class="badge gold">${esc(STATE.tournoi_id)}</span><span class="badge">${esc(rep || "—")}</span>` : ``}
        </div>
        ${STATE.tournoi_id ? `
          <div class="inlineSel">
            <label>Réponse</label>
            <select class="repSel" data-jt="${esc(jt)}">
              <option value="" ${rep===""?"selected":""}></option>
              <option value="Yes" ${rep==="Yes"?"selected":""}>Yes</option>
              <option value="No" ${rep==="No"?"selected":""}>No</option>
              <option value="TBD" ${rep==="TBD"?"selected":""}>TBD</option>
            </select>
          </div>
        ` : ""}
      `;
      wrap.appendChild(card);
    }

    document.querySelectorAll(".rowcb").forEach(cb => cb.addEventListener("change", updateSelCount));
    updateSelCount();

    if (STATE.tournoi_id) {
      document.querySelectorAll(".repSel").forEach(sel => {
        sel.addEventListener("change", async (e) => {
          const jt = e.target.dataset.jt;
          const val = e.target.value;
          try {
            setText("err","");
            await api("mutate", { op: "set_inscription_reponse", payload: JSON.stringify({ joueur_timestamp: jt, tournoi_id: STATE.tournoi_id, reponse: val }) });
            await loadInscriptions();
          } catch (err) {
            setText("err", err.message || String(err));
          }
        });
      });
    }
  }

  function render() {
    renderDesktopTable();
    renderMobileCards();
  }

  async function refresh() {
    try {
      setText("err", "");
      setText("loading", "Chargement…");
      await loadPlayers();
      await loadInscriptions();
      await loadTeamMembers();
      render();
      setText("loading", "");
    } catch (e) {
      setText("err", e.message || String(e));
      setText("loading", "");
    }
  }

  // ---- actions ----
  function copyEmails() {
    const ids = selectedIds();
    const sep = $("emailSep")?.value || ",";
    const emails = STATE.players
      .filter(p => ids.includes(String(p.Timestamp || p.timestamp || "")))
      .map(p => String(p.parent_email || "").trim())
      .filter(Boolean);
    const unique = Array.from(new Set(emails));
    navigator.clipboard.writeText(unique.join(sep));
    alert(`Copié: ${unique.length} emails`);
  }

  async function setStatus(statut) {
    const ids = selectedIds();
    if (!ids.length) return alert("Aucun sélectionné.");
    await api("mutate", { op: "set_player_status", payload: JSON.stringify({ ids, statut }) });
    await refresh();
  }

  async function addToTournoiTbd() {
    if (!STATE.tournoi_id) return alert("Choisis un tournoi.");
    const ids = selectedIds();
    if (!ids.length) return alert("Aucun sélectionné.");
    await api("mutate", { op: "add_to_tournoi", payload: JSON.stringify({ ids, tournoi_id: STATE.tournoi_id, reponse: "TBD" }) });
    await refresh();
  }

  async function createTeam() {
    const ids = selectedIds();
    if (!ids.length) return alert("Sélectionne des joueurs.");
    const nom = prompt("Nom de l'équipe:", "QHC Elite");
    if (!nom) return;
    const tid = STATE.tournoi_id || prompt("tournoi_id (ex: jaypeak_2026):", "");
    if (!tid) return;
    await api("mutate", { op: "create_team", payload: JSON.stringify({ nom_equipe: nom, tournoi_id: tid, ids }) });
    await loadMeta();
    await refresh();
    alert("Équipe créée.");
  }

  async function archivePlayers() {
    const ids = selectedIds();
    if (!ids.length) return alert("Aucun sélectionné.");
    const reason = prompt("Raison d'archivage (optionnel):", "") || "";
    await api("mutate", { op: "archive_players", payload: JSON.stringify({ ids, reason }) });
    await refresh();
  }

  async function restorePlayers() {
    const ids = selectedIds();
    if (!ids.length) return alert("Aucun sélectionné.");
    await api("mutate", { op: "restore_players", payload: JSON.stringify({ ids }) });
    await refresh();
  }

  async function setNotes() {
    const ids = selectedIds();
    if (!ids.length) return alert("Aucun sélectionné.");
    const note = prompt("Notes (remplace la note actuelle):", "") ?? "";
    await api("mutate", { op: "set_player_notes", payload: JSON.stringify({ ids, notes: note }) });
    await refresh();
  }

  // ---------------- DASH INIT ----------------
  async function initDash() {
    if (!token() || expired()) { clearToken(); location.href = "./login.html"; return; }

    setText("today", new Date().toLocaleString("fr-CA"));

    $("btnLogout")?.addEventListener("click", () => { clearToken(); location.href = "./login.html"; });

    $("showArchived") && ($("showArchived").onchange = (e) => { STATE.showArchived = !!e.target.checked; STATE.page = 1; refresh(); });

    $("pageSize") && ($("pageSize").onchange = (e) => { STATE.pageSize = Number(e.target.value); STATE.page = 1; refresh(); });
    $("searchFilter") && ($("searchFilter").oninput = (e) => { STATE.search = e.target.value; STATE.page = 1; refresh(); });
    $("yearFilter") && ($("yearFilter").onchange = (e) => { STATE.year = e.target.value; STATE.page = 1; refresh(); });
    $("statusFilter") && ($("statusFilter").onchange = (e) => { STATE.statut = e.target.value; STATE.page = 1; refresh(); });
    $("tournoiSelect") && ($("tournoiSelect").onchange = (e) => { STATE.tournoi_id = e.target.value; STATE.page = 1; refresh(); });
    $("teamSelect") && ($("teamSelect").onchange = (e) => { STATE.equipe_id = e.target.value; STATE.page = 1; refresh(); });

    $("btnReset") && ($("btnReset").onclick = () => {
      STATE.page = 1;
      STATE.year = "";
      STATE.statut = "";
      STATE.search = "";
      STATE.tournoi_id = "";
      STATE.equipe_id = "";
      STATE.showArchived = false;

      if ($("yearFilter")) $("yearFilter").value = "";
      if ($("statusFilter")) $("statusFilter").value = "";
      if ($("searchFilter")) $("searchFilter").value = "";
      if ($("tournoiSelect")) $("tournoiSelect").value = "";
      if ($("teamSelect")) $("teamSelect").value = "";
      if ($("showArchived")) $("showArchived").checked = false;

      refresh();
    });

    $("btnPrev") && ($("btnPrev").onclick = () => { if (STATE.page > 1) { STATE.page--; refresh(); } });
    $("btnNext") && ($("btnNext").onclick = () => { if (STATE.page < STATE.totalPages) { STATE.page++; refresh(); } });

    $("btnCopyEmails") && ($("btnCopyEmails").onclick = copyEmails);
    $("btnAddToTournoi") && ($("btnAddToTournoi").onclick = addToTournoiTbd);
    $("btnCreateTeam") && ($("btnCreateTeam").onclick = createTeam);

    $("btnApplyStatus") && ($("btnApplyStatus").onclick = () => {
      const s = $("statusApply")?.value || "";
      if (!s) return alert("Choisis un statut.");
      setStatus(s);
    });
    $("btnQuickInteressant") && ($("btnQuickInteressant").onclick = () => setStatus("Interessant"));
    $("btnQuickEcarte") && ($("btnQuickEcarte").onclick = () => setStatus("Ecarte"));

    $("btnArchive") && ($("btnArchive").onclick = archivePlayers);
    $("btnRestore") && ($("btnRestore").onclick = restorePlayers);
    $("btnNotes") && ($("btnNotes").onclick = setNotes);

    await loadMeta();
    await refresh();
  }

  // ---------------- BOOT ----------------
  const kind = pageKind();
  if (kind.login) initLogin();
  if (kind.dash) initDash();
})();
