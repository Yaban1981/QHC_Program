// admin/app.js — QHC Admin (GitHub Pages) + Apps Script API (JSONP)
// API supports actions: ping, login, list, status, delete, email

(() => {
  // ✅ Paste your Apps Script /exec URL here
  const API_BASE = "https://script.google.com/macros/s/AKfycbw3ry7QA7HHlFcsP7HLDmp4DPqXt0qTQaF23ffvoRzFjxq3eFvfBpanKkqkjNrBCE0/exec";

  const LS_TOKEN_KEY = "qhc_admin_token";
  const LS_EXPIRES_KEY = "qhc_admin_expiresAt";

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text || "";
  }

  function nowMs() { return Date.now(); }

  function getToken() {
    return localStorage.getItem(LS_TOKEN_KEY) || "";
  }

  function setToken(token, expiresAtIso) {
    localStorage.setItem(LS_TOKEN_KEY, token || "");
    if (expiresAtIso) localStorage.setItem(LS_EXPIRES_KEY, expiresAtIso);
  }

  function clearToken() {
    localStorage.removeItem(LS_TOKEN_KEY);
    localStorage.removeItem(LS_EXPIRES_KEY);
  }

  function isTokenExpired() {
    const expIso = localStorage.getItem(LS_EXPIRES_KEY);
    if (!expIso) return false;
    const t = Date.parse(expIso);
    if (Number.isNaN(t)) return false;
    return nowMs() > t;
  }

  function toQuery(obj) {
    const parts = [];
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null) continue;
      parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(v)));
    }
    return parts.join("&");
  }

  // JSONP call: inject script tag with callback
  function jsonp(action, params = {}) {
    return new Promise((resolve, reject) => {
      const cbName = "__qhc_cb_" + Math.random().toString(36).slice(2);
      const timeoutMs = 20000;

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("JSONP timeout"));
      }, timeoutMs);

      function cleanup() {
        clearTimeout(timer);
        delete window[cbName];
        if (script && script.parentNode) script.parentNode.removeChild(script);
      }

      window[cbName] = (data) => {
        cleanup();
        resolve(data);
      };

      const q = toQuery({
        action,
        callback: cbName,
        ...params,
      });

      const url = API_BASE + (API_BASE.includes("?") ? "&" : "?") + q;
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onerror = () => {
        cleanup();
        reject(new Error("JSONP network error"));
      };
      document.head.appendChild(script);
    });
  }

  function detectPage() {
    const path = location.pathname.toLowerCase();
    return {
      isLogin: path.endsWith("/login.html") || path.endsWith("/admin/login.html"),
      isDashboard: path.endsWith("/dashboard.html") || path.endsWith("/admin/dashboard.html"),
    };
  }

  // ---------- LOGIN PAGE ----------
  async function initLogin() {
    const pwd = $("pwd");
    const btnLogin = $("btnLogin");
    const btnClear = $("btnClear");
    const msgId = "msg";

    if (getToken() && !isTokenExpired()) {
      location.href = "./dashboard.html";
      return;
    }

    btnClear?.addEventListener("click", () => {
      if (pwd) pwd.value = "";
      setText(msgId, "");
      pwd?.focus();
    });

    btnLogin?.addEventListener("click", async () => {
      setText(msgId, "");
      const password = (pwd?.value || "").trim();
      if (!password) {
        setText(msgId, "Entre le mot de passe.");
        pwd?.focus();
        return;
      }

      btnLogin.disabled = true;
      setText(msgId, "Connexion...");

      try {
        const res = await jsonp("login", { password });
        if (!res || !res.success) {
          setText(msgId, (res && res.error) ? res.error : "Login refusé.");
          btnLogin.disabled = false;
          return;
        }

        setToken(res.token, res.expiresAt);
        setText(msgId, "OK. Redirection...");
        location.href = "./dashboard.html";
      } catch (err) {
        setText(msgId, "Erreur API: " + String(err && err.message ? err.message : err));
        btnLogin.disabled = false;
      }
    });

    pwd?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btnLogin?.click();
    });

    pwd?.focus();
  }

  // ---------- DASHBOARD PAGE ----------
  let ALL_HEADERS = [];
  let ALL_PLAYERS = [];
  let AVAIL_KEYS = [];

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseDispo(json) {
    try { return JSON.parse(json || "{}"); } catch { return {}; }
  }

  function getSelectedIds() {
    return Array.from(document.querySelectorAll(".row-checkbox:checked")).map(cb => cb.dataset.id);
  }

  function toggleAll() {
    const v = $("checkAll")?.checked;
    document.querySelectorAll(".row-checkbox").forEach(cb => cb.checked = !!v);
  }

  async function loadPlayers() {
    setText("err", "");
    const token = getToken();
    if (!token || isTokenExpired()) {
      clearToken();
      location.href = "./login.html";
      return;
    }

    setText("loading", "Chargement des données...");
    if ($("table-container")) $("table-container").style.display = "none";

    try {
      const res = await jsonp("list", { token });
      if (!res || !res.success) {
        setText("err", ((res && res.error) ? res.error : "Erreur list()") + "\n" + ((res && res.stack) ? res.stack : ""));
        return;
      }

      ALL_HEADERS = res.headers || [];
      ALL_PLAYERS = res.players || [];

      buildDynamicAvailabilityKeys();
      buildFilters();
      renderTable(applyFilters());
      setText("loading", "");
      if ($("table-container")) $("table-container").style.display = "block";
    } catch (err) {
      setText("err", "Erreur API: " + String(err && err.message ? err.message : err));
    }
  }

  function buildDynamicAvailabilityKeys() {
    const keys = new Set();
    for (const p of ALL_PLAYERS) {
      const dispo = parseDispo(p.disponibilites_json);
      Object.keys(dispo).forEach(k => keys.add(k));
    }
    AVAIL_KEYS = Array.from(keys).sort();
  }

  function resetHeader() {
    const headerRow = document.querySelector("#table-header tr");
    if (!headerRow) return;
    headerRow.innerHTML = `
      <th class="checkbox-col"><input type="checkbox" id="checkAll"></th>
      <th>Nom</th>
      <th>Année</th>
      <th>Ville</th>
      <th>Email</th>
      <th>Poste</th>
      <th>Confiance</th>
    `;
    $("checkAll")?.addEventListener("change", toggleAll);

    for (const k of AVAIL_KEYS) {
      const th = document.createElement("th");
      th.textContent = k;
      headerRow.insertBefore(th, headerRow.lastElementChild);
    }
  }

  function buildFilters() {
    const by = $("filtreAnneeNaissance");
    const ys = Array.from(new Set(ALL_PLAYERS.map(p => p.birth_year).filter(Boolean))).sort();
    if (by) {
      by.innerHTML = `<option value="">Toutes</option>` + ys.map(y => `<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`).join("");
    }

    const sy = $("filtreAnneeSoumission");
    const syears = Array.from(new Set(ALL_PLAYERS.map(p => {
      const ts = p.Timestamp || p.timestamp;
      const d = ts instanceof Date ? ts : new Date(ts);
      return isNaN(d.getTime()) ? null : d.getFullYear();
    }).filter(Boolean))).sort();

    if (sy) {
      sy.innerHTML = `<option value="">Toutes</option>` + syears.map(y => `<option value="${y}">${y}</option>`).join("");
    }

    const dyn = $("dynamic-filters-container");
    if (dyn) {
      dyn.innerHTML = "";
      for (const k of AVAIL_KEYS) {
        const div = document.createElement("div");
        div.className = "dynamic-filter";
        div.innerHTML = `
          <label>${escapeHtml(k)} :</label>
          <select class="filtre-dispo" data-key="${escapeHtml(k)}">
            <option value="">Tous</option>
            <option value="Yes">Oui</option>
            <option value="No">Non</option>
            <option value="TBD">À confirmer</option>
          </select>
        `;
        dyn.appendChild(div);
      }
    }

    ["filtreAnneeNaissance", "filtrePoste", "recherche", "filtreAnneeSoumission"].forEach(id => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", () => renderTable(applyFilters()));
      if (id === "recherche") el.addEventListener("input", () => renderTable(applyFilters()));
    });

    document.querySelectorAll(".filtre-dispo").forEach(el => {
      el.addEventListener("change", () => renderTable(applyFilters()));
    });

    resetHeader();
  }

  function applyFilters() {
    const annee = $("filtreAnneeNaissance")?.value || "";
    const poste = $("filtrePoste")?.value || "";
    const recherche = ($("recherche")?.value || "").toLowerCase();
    const anneeSoum = $("filtreAnneeSoumission")?.value || "";

    const dispoFiltres = {};
    document.querySelectorAll(".filtre-dispo").forEach(sel => {
      const key = sel.dataset.key;
      const val = sel.value;
      if (val) dispoFiltres[key] = val;
    });

    return ALL_PLAYERS.filter(p => {
      if (annee && String(p.birth_year) !== String(annee)) return false;
      if (poste && String(p.primary_position || "") !== String(poste)) return false;

      if (anneeSoum) {
        const ts = p.Timestamp || p.timestamp;
        const d = ts instanceof Date ? ts : new Date(ts);
        if (isNaN(d.getTime())) return false;
        if (String(d.getFullYear()) !== String(anneeSoum)) return false;
      }

      if (recherche) {
        const nom = String(p.player_name || "").toLowerCase();
        const ville = String(p.city || "").toLowerCase();
        if (!nom.includes(recherche) && !ville.includes(recherche)) return false;
      }

      const dispo = parseDispo(p.disponibilites_json);
      for (const [k, v] of Object.entries(dispoFiltres)) {
        if (String(dispo[k] || "") !== String(v)) return false;
      }

      return true;
    });
  }

  function renderTable(list) {
    const tbody = $("table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    for (const p of list) {
      const dispo = parseDispo(p.disponibilites_json);
      const id = String(p.Timestamp || p.timestamp || "");
      const tr = document.createElement("tr");

      let html = `
        <td class="checkbox-col"><input type="checkbox" class="row-checkbox" data-id="${escapeHtml(id)}"></td>
        <td>${escapeHtml(p.player_name || "")}</td>
        <td>${escapeHtml(p.birth_year || "")}</td>
        <td>${escapeHtml(p.city || "")}</td>
        <td>${escapeHtml(p.parent_email || "")}</td>
        <td>${escapeHtml(p.primary_position || "")}</td>
      `;

      for (const k of AVAIL_KEYS) {
        html += `<td>${escapeHtml(dispo[k] || "")}</td>`;
      }

      html += `<td>${escapeHtml(p.confidence_pct || "")}%</td>`;

      tr.innerHTML = html;
      tbody.appendChild(tr);
    }

    $("checkAll")?.addEventListener("change", toggleAll);
  }

  async function setStatus(status) {
    const ids = getSelectedIds();
    if (!ids.length) return alert("Aucun sélectionné.");
    const token = getToken();

    setText("err", "");
    try {
      const res = await jsonp("status", { token, ids: JSON.stringify(ids), status });
      if (!res || !res.success) {
        setText("err", ((res && res.error) ? res.error : "Erreur status()") + "\n" + ((res && res.stack) ? res.stack : ""));
        return;
      }
      await loadPlayers();
    } catch (err) {
      setText("err", "Erreur API: " + String(err && err.message ? err.message : err));
    }
  }

  async function deleteSelected() {
    const ids = getSelectedIds();
    if (!ids.length) return alert("Aucun sélectionné.");
    if (!confirm(`Supprimer définitivement ${ids.length} joueur(s) ?`)) return;

    const token = getToken();
    setText("err", "");
    try {
      const res = await jsonp("delete", { token, ids: JSON.stringify(ids) });
      if (!res || !res.success) {
        setText("err", ((res && res.error) ? res.error : "Erreur delete()") + "\n" + ((res && res.stack) ? res.stack : ""));
        return;
      }
      await loadPlayers();
    } catch (err) {
      setText("err", "Erreur API: " + String(err && err.message ? err.message : err));
    }
  }

  async function emailSelected() {
    const ids = getSelectedIds();
    if (!ids.length) return alert("Aucun sélectionné.");

    const subject = prompt("Sujet de l'email :", "Québec HC");
    if (!subject) return;

    const message = prompt("Message :", "");
    if (!message) return;

    const token = getToken();
    setText("err", "");
    try {
      const res = await jsonp("email", { token, ids: JSON.stringify(ids), subject, message });
      if (!res || !res.success) {
        setText("err", ((res && res.error) ? res.error : "Erreur email()") + "\n" + ((res && res.stack) ? res.stack : ""));
        return;
      }
      alert(`Email envoyé à ${res.count} destinataire(s).`);
    } catch (err) {
      setText("err", "Erreur API: " + String(err && err.message ? err.message : err));
    }
  }

  async function logout() {
    clearToken();
    location.href = "./login.html";
  }

  function hookDashboardButtons() {
    window.ouvrirModalEmail = emailSelected;
    window.marquerInteressant = () => setStatus("Interessant");
    window.marquerEcarte = () => setStatus("Ecarté");
    window.supprimerSelection = deleteSelected;
    window.deconnexion = logout;
    window.toggleAll = toggleAll;
  }

  async function initDashboard() {
    if (!getToken() || isTokenExpired()) {
      clearToken();
      location.href = "./login.html";
      return;
    }
    hookDashboardButtons();
    await loadPlayers();
  }

  const page = detectPage();
  if (page.isLogin) initLogin();
  if (page.isDashboard) initDashboard();
})();





