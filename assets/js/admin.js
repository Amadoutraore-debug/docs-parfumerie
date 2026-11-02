/* =====================================================================
   ESPACE GÉRANTE — produits, stock, promos, commandes, clients
   ===================================================================== */
(function () {
  const CFG = window.APP_CONFIG;
  const { fmt, esc, promoActive, unitPrice, discount, variantsOf, retailPrice, roundPrice, productVisual, bottleSVG, icon, toast, waLink, relTime } = window.U;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const state = { view: "dashboard", products: [], orders: [], settings: { wholesale_min_qty: CFG.wholesaleMinQty || 10 }, orderFilter: "nouvelle", orderQuery: "", productQuery: "", productCat: "Tous" };
  const STATUS = { nouvelle: "Nouvelle", confirmee: "Confirmée", livree: "Livrée", annulee: "Annulée" };
  const VIEWS = {
    dashboard: ["Tableau de bord", "Vue d'ensemble de votre boutique"],
    orders: ["Commandes", "Contactez vos clients et suivez les livraisons"],
    products: ["Produits", "Ajoutez vos parfums, photos et gérez le stock"],
    promos: ["Promotions", "Mettez des produits en promo en quelques secondes"],
    clients: ["Clients", "Vos clients fidèles et le client de la semaine"],
  };

  const clientWa = (phone) => { const d = String(phone).replace(/\D/g, ""); return d.length === 10 ? "225" + d : d; };
  const toLocalInput = (iso) => { if (!iso) return ""; const d = new Date(iso); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const weekStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
  const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
  const byId = (id) => state.products.find((p) => p.id === id);
  const vShort = (v) => (v.volume_ml ? `${v.volume_ml} ml` : v.label.replace(/ de parfum$/, ""));
  const lowVariants = () => state.products.filter((p) => p.active).flatMap((p) => variantsOf(p).filter((v) => +v.stock <= CFG.lowStockThreshold).map((v) => ({ p, v }))).sort((a, b) => a.v.stock - b.v.stock);

  // ------------------------------------------------------------ connexion
  function brandHTML(full) {
    const B = CFG.brand;
    if (full) return U.logoFull ? U.logoFull("logo-full") : `<img class="logo-full" src="${esc(B.logoFull)}" alt="${esc(B.name)}">`;
    const mark = U.logoMark ? U.logoMark("logo-mark-svg") : `<img src="${esc(B.logo)}" alt="">`;
    return `${mark}<span>${esc(B.name)}<small>${esc(B.signature || "")}</small></span>`;
  }

  async function boot() {
    document.title = `Espace gérante — ${CFG.brand.name}`;
    $("#loginLogo").innerHTML = brandHTML(true);
    $("#sideLogo").innerHTML = brandHTML();
    $$("[data-ico]").forEach((el) => el.insertAdjacentHTML("afterbegin", icon(el.dataset.ico, 20)));
    if (Store.mode === "demo") {
      $("#demoHint").hidden = false;
      $("#demoHint").innerHTML = `<b>Mode démo</b> — n'importe quel e-mail, mot de passe : <code>${Store.demoPassword}</code>`;
    }
    const session = await Store.getSession();
    session ? startApp() : showLogin();
  }

  function showLogin() {
    $("#login").hidden = false; $("#app").hidden = true;
    $("#loginForm").onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button[type=submit]");
      btn.disabled = true; btn.textContent = "Connexion…";
      try {
        await Store.signIn(e.target.email.value.trim(), e.target.password.value);
        startApp();
      } catch (err) { toast(esc(err.message), "error"); }
      btn.disabled = false; btn.textContent = "Se connecter";
    };
  }

  async function startApp() {
    $("#login").hidden = true; $("#app").hidden = false;
    $("#modeBadge").textContent = Store.mode === "demo" ? "Mode démo" : "En ligne";
    $("#modeBadge").classList.toggle("demo", Store.mode === "demo");
    if ("Notification" in window && Notification.permission === "granted") $("#notifBtn").hidden = true;
    bind();
    await reload();
    Store.onNewOrder(onNewOrder);
    if (Store.mode === "demo") Store.onProductsChange(() => reload(true));
    else Store.onProductsChange(() => refreshProductsOnly());
    // filet de sécurité : rafraîchit toutes les 60 s
    setInterval(() => reload(true), 60000);
  }

  async function reload(silent) {
    try {
      [state.products, state.orders, state.settings] = await Promise.all([Store.getProducts({ all: true }), Store.getOrders(), Store.getSettings().catch(() => state.settings)]);
      updateBadge();
      if (!silent || !$(".modal.open")) render();
    } catch (e) { toast(esc(Store.humanError(e)), "error"); }
  }
  let rp; function refreshProductsOnly() { clearTimeout(rp); rp = setTimeout(async () => { state.products = await Store.getProducts({ all: true }); if (!$(".modal.open")) render(); }, 400); }

  function updateBadge() {
    const n = state.orders.filter((o) => o.status === "nouvelle").length;
    $("#newCount").hidden = !n; $("#newCount").textContent = n;
    document.title = (n ? `(${n}) ` : "") + `Espace gérante — ${CFG.brand.name}`;
  }

  // ------------------------------------------------------------ alerte nouvelle commande
  function chime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [[880, 0], [1318.5, .16], [1760, .32]].forEach(([f, t]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0, ctx.currentTime + t);
        g.gain.linearRampToValueAtTime(.25, ctx.currentTime + t + .02);
        g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + t + .6);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .65);
      });
    } catch (e) {}
  }
  async function onNewOrder(o) {
    chime();
    toast(`${icon("bell", 16)} Nouvelle commande ${esc(o.code)} — ${esc(o.customer_name)} · ${fmt(o.total)}`, "success");
    if ("Notification" in window && Notification.permission === "granted") {
      const n = new Notification(`Nouvelle commande ${o.code}`, { body: `${o.customer_name} · ${fmt(o.total)} · ${o.city || ""}`, tag: o.code });
      n.onclick = () => { window.focus(); go("orders"); };
    }
    if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate([120, 60, 120]);
    await reload(true);
    const el = $(`[data-order="${o.id}"]`); if (el) el.classList.add("flash");
  }

  // ------------------------------------------------------------ rendu
  function go(view) { state.view = view; $$("#sideNav button").forEach((b) => b.classList.toggle("active", b.dataset.view === view)); render(); window.scrollTo(0, 0); }
  function render() {
    const [t, s] = VIEWS[state.view];
    $("#viewTitle").textContent = t; $("#viewSub").textContent = s;
    $("#view").innerHTML = ({ dashboard, orders, products, promos, clients })[state.view]();
  }

  const statusBadge = (s) => `<span class="status st-${s}">${STATUS[s]}</span>`;
  const thumb = (p) => `<div class="thumb">${productVisual(p)}</div>`;

  // ---- tableau de bord
  function dashboard() {
    const ws = weekStart();
    const valid = state.orders.filter((o) => o.status !== "annulee");
    const week = valid.filter((o) => new Date(o.created_at) >= ws);
    const weekCA = week.filter((o) => o.status !== "nouvelle").reduce((a, o) => a + o.total, 0);
    const pending = state.orders.filter((o) => o.status === "nouvelle");
    const today = valid.filter((o) => isToday(o.created_at));
    const low = lowVariants();
    const stockValue = state.products.reduce((a, p) => a + variantsOf(p).reduce((b, v) => b + v.stock * retailPrice(p, v), 0), 0);
    const best = customers(true)[0];
    return `
      <div class="kpis">
        <div class="kpi dark">${icon("sparkle", 22)}<small>Ventes de la semaine</small><strong>${fmt(weekCA).replace(" FCFA", "")}</strong><span>FCFA · commandes confirmées</span></div>
        <div class="kpi ${pending.length ? "alert" : ""}">${icon("bell", 22)}<small>À traiter</small><strong>${pending.length}</strong><span>nouvelle${pending.length > 1 ? "s" : ""} commande${pending.length > 1 ? "s" : ""}</span></div>
        <div class="kpi">${icon("bag", 22)}<small>Aujourd'hui</small><strong>${today.length}</strong><span>${fmt(today.reduce((a, o) => a + o.total, 0))}</span></div>
        <div class="kpi ${low.length ? "alert" : ""}">${icon("box", 22)}<small>Stock faible</small><strong>${low.length}</strong><span>format${low.length > 1 ? "s" : ""} à réapprovisionner</span></div>
      </div>
      <div class="dash-grid">
        <div>
          <div class="panel">
            <h3>Commandes à traiter <button data-go="orders">Tout voir →</button></h3>
            ${pending.length ? pending.slice(0, 6).map((o) => `
              <div class="list-row">
                <div class="grow"><div class="row-title">${esc(o.customer_name)} · ${fmt(o.total)}</div><div class="row-sub ellipsis">${esc(o.code)} · ${o.items.map((l) => `${l.qty}× ${esc(l.name)}${l.variant ? " " + esc(vShort({ label: l.variant })) : ""}`).join(", ")} · ${relTime(o.created_at)}</div></div>
                <a class="btn btn-wa btn-xs" target="_blank" rel="noopener" href="${waLink(confirmMsg(o), clientWa(o.phone))}">${icon("whatsapp", 14)} Contacter</a>
              </div>`).join("") : `<div class="empty-state">${icon("check", 32)}<p>Aucune commande en attente. Tout est à jour !</p></div>`}
          </div>
          <div class="panel">
            <h3>Dernières commandes <button data-go="orders" data-filter="toutes">Historique →</button></h3>
            ${state.orders.slice(0, 5).map((o) => `
              <div class="list-row"><div class="grow"><div class="row-title">${esc(o.customer_name)}</div><div class="row-sub">${esc(o.code)} · ${relTime(o.created_at)}</div></div><strong>${fmt(o.total)}</strong>${statusBadge(o.status)}</div>`).join("") || `<div class="empty-state">Pas encore de commande.</div>`}
          </div>
        </div>
        <div>
          <div class="panel">
            <h3>Client(e) de la semaine</h3>
            ${best ? `<div class="list-row"><span class="rank rank-1">1</span><div class="grow"><div class="row-title">${esc(best.name)}</div><div class="row-sub">${best.count} commande${best.count > 1 ? "s" : ""} · ${fmt(best.sum)}</div></div><a class="btn btn-soft btn-xs" target="_blank" rel="noopener" href="${waLink(`Bonjour ${best.name.split(" ")[0]} ! Félicitations, vous êtes notre client(e) de la semaine chez ${CFG.brand.name} 👑 Merci pour votre fidélité !`, clientWa(best.phone))}">Féliciter</a></div>`
              : `<p class="muted" style="margin:0;font-size:14px">Personne encore cette semaine. Seules les commandes confirmées ou livrées comptent.</p>`}
          </div>
          <div class="panel">
            <h3>Stock faible <button data-go="products">Gérer →</button></h3>
            ${low.length ? low.slice(0, 8).map(({ p, v }) => `
              <div class="list-row">${thumb(p)}<div class="grow"><div class="row-title ellipsis">${esc(p.name)}</div><div class="row-sub" style="color:${v.stock ? "var(--warn)" : "var(--danger)"}">${esc(v.label)} · ${v.stock ? `plus que ${v.stock}` : "rupture"}</div></div>${stockCtrl(p, v)}</div>`).join("")
              : `<div class="empty-state">${icon("check", 28)}<p>Stock confortable partout.</p></div>`}
          </div>
          <div class="panel">
            <h3>En un coup d'œil</h3>
            <div class="list-row"><span class="grow">Produits en ligne</span><strong>${state.products.filter((p) => p.active).length}</strong></div>
            <div class="list-row"><span class="grow">Promotions actives</span><strong>${state.products.filter(promoActive).length}</strong></div>
            <div class="list-row"><span class="grow">Valeur du stock</span><strong>${fmt(stockValue)}</strong></div>
          </div>
        </div>
      </div>`;
  }

  // ---- commandes
  function confirmMsg(o) {
    const lines = o.items.map((l) => `• ${l.qty} × ${l.name}${l.variant ? " (" + l.variant + ")" : ""}`).join("\n");
    return `Bonjour ${o.customer_name.split(" ")[0]}, ici ${CFG.brand.name} ✨\nNous avons bien reçu votre commande *${o.code}* :\n${lines}\n*Total : ${fmt(o.total)}*\n\nPouvez-vous nous confirmer l'adresse et l'heure de livraison qui vous conviennent ?`;
  }
  function orders() {
    const counts = Object.fromEntries(Object.keys(STATUS).map((s) => [s, state.orders.filter((o) => o.status === s).length]));
    const q = state.orderQuery.toLowerCase();
    const list = state.orders.filter((o) => (state.orderFilter === "toutes" || o.status === state.orderFilter) &&
      (!q || [o.code, o.customer_name, o.phone, o.city].join(" ").toLowerCase().includes(q)));
    return `
      <div class="filters">
        ${[["nouvelle", "Nouvelles"], ["confirmee", "Confirmées"], ["livree", "Livrées"], ["annulee", "Annulées"], ["toutes", "Toutes"]].map(([k, l]) =>
          `<button class="chip ${state.orderFilter === k ? "active" : ""}" data-of="${k}">${l}<span class="n">${k === "toutes" ? state.orders.length : counts[k]}</span></button>`).join("")}
        <label class="search-field">${icon("search", 18)}<input type="search" id="orderSearch" placeholder="Nom, téléphone, code…" value="${esc(state.orderQuery)}"></label>
      </div>
      <div class="orders">
        ${list.length ? list.map(orderCard).join("") : `<div class="panel empty-state">${icon("bag", 34)}<p>Aucune commande ici.</p></div>`}
      </div>`;
  }
  function orderCard(o) {
    const next = { nouvelle: [["confirmee", "Confirmer", "btn-dark"]], confirmee: [["livree", "Marquer livrée", "btn-dark"]], livree: [], annulee: [["nouvelle", "Réactiver", "btn-soft"]] }[o.status];
    return `
      <article class="order is-${o.status}" data-order="${o.id}">
        <div>
          <div class="order-head"><span class="order-code">${esc(o.code)}</span>${statusBadge(o.status)}<span class="order-time">${relTime(o.created_at)}</span></div>
          <div class="order-client" style="margin-top:12px">
            <div><b>Client</b>${esc(o.customer_name)}</div>
            <div><b>Téléphone</b><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a></div>
            <div><b>Lieu</b>${esc(o.city)}${o.address ? ", " + esc(o.address) : ""}</div>
          </div>
        </div>
        <div class="order-total"><strong>${fmt(o.total)}</strong><small>${o.payment_method === "wave" ? "Paiement Wave" : "Paiement à la livraison"}${o.wholesale ? " · <b>tarif de gros</b>" : ""}</small></div>
        <div class="order-items">${o.items.map((l) => `<span class="order-item">${thumb(l)}<b>${l.qty}×</b> ${esc(l.name)}${l.variant ? ` <span class="muted">· ${esc(l.variant)}</span>` : ""} <span class="muted">${fmt(l.price)}</span></span>`).join("")}</div>
        ${o.note ? `<div class="order-note">💬 ${esc(o.note)}</div>` : ""}
        <div class="order-actions">
          <a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="${waLink(confirmMsg(o), clientWa(o.phone))}">${icon("whatsapp", 16)} WhatsApp</a>
          <a class="btn btn-outline btn-sm" href="tel:${esc(o.phone)}">${icon("phone", 16)} Appeler</a>
          <span class="spacer"></span>
          ${next.map(([s, l, c]) => `<button class="btn ${c} btn-sm" data-status="${s}" data-id="${o.id}">${l}</button>`).join("")}
          ${o.status !== "annulee" && o.status !== "livree" ? `<button class="btn btn-danger btn-sm" data-status="annulee" data-id="${o.id}">Annuler</button>` : ""}
          ${o.status === "annulee" ? `<button class="icon-btn" data-del-order="${o.id}" aria-label="Supprimer">${icon("trash", 18)}</button>` : ""}
        </div>
      </article>`;
  }

  // ---- produits
  function stockCtrl(p, v) {
    const cls = v.stock <= 0 ? "out" : v.stock <= CFG.lowStockThreshold ? "low" : "";
    const d = `data-stock="${p.id}" data-vid="${esc(v.id)}"`;
    return `<span class="stock-ctrl ${cls}"><button ${d} data-d="-1" aria-label="Retirer 1">${icon("minus", 14)}</button><input type="number" min="0" value="${v.stock}" data-stock-input="${p.id}" data-vid="${esc(v.id)}" aria-label="Stock ${esc(v.label)}"><button ${d} data-d="1" aria-label="Ajouter 1">${icon("plus", 14)}</button></span>`;
  }
  function products() {
    const q = state.productQuery.toLowerCase();
    const cats = ["Tous", ...CFG.categories];
    const list = state.products.filter((p) => (state.productCat === "Tous" || p.category === state.productCat) && (!q || (p.name + " " + p.brand).toLowerCase().includes(q)));
    return `
      <div class="filters">
        <button class="btn btn-gold btn-sm" data-new>${icon("plus", 16)} Nouveau produit</button>
        <select id="catFilter" class="chip">${cats.map((c) => `<option ${c === state.productCat ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
        <label class="search-field">${icon("search", 18)}<input type="search" id="productSearch" placeholder="Rechercher un produit…" value="${esc(state.productQuery)}"></label>
      </div>
      <div class="panel table-wrap">
        ${list.length ? `<table class="prod-table">
          <thead><tr><th></th><th>Produit</th><th>Prix</th><th>Stock</th><th>En ligne</th><th></th></tr></thead>
          <tbody>${list.map((p) => `
            <tr class="${p.active ? "" : "inactive"}">
              <td class="c-img">${thumb(p)}</td>
              <td class="c-name"><div class="row-title">${esc(p.name)} ${p.featured ? "⭐" : ""}</div><div class="row-sub">${esc(p.category)} · ${variantsOf(p).length} format${variantsOf(p).length > 1 ? "s" : ""}</div></td>
              <td class="c-price price-cell"><small class="muted">dès</small> ${promoActive(p) ? `<span class="promo">${fmt(unitPrice(p))}</span><s>${fmt(p.price)}</s>` : fmt(p.price)}</td>
              <td class="c-stock"><div class="v-stocks">${variantsOf(p).map((v) => `<div class="v-stock"><span>${esc(vShort(v))}</span>${stockCtrl(p, v)}</div>`).join("")}</div></td>
              <td class="c-active"><label class="switch" title="Visible sur le site"><input type="checkbox" data-active="${p.id}" ${p.active ? "checked" : ""}><span></span></label></td>
              <td class="c-actions"><div class="row-actions"><button class="icon-btn" data-edit="${p.id}" aria-label="Modifier">${icon("edit", 18)}</button><button class="icon-btn" data-del-product="${p.id}" aria-label="Supprimer">${icon("trash", 18)}</button></div></td>
            </tr>`).join("")}</tbody></table>`
        : `<div class="empty-state">${icon("box", 34)}<p>Aucun produit. Cliquez sur « Nouveau produit » pour commencer.</p></div>`}
      </div>`;
  }

  // ---- promos
  function promos() {
    const active = state.products.filter(promoActive);
    const expired = state.products.filter((p) => +p.promo_pct > 0 && !promoActive(p));
    return `
      <div class="panel" style="margin-bottom:16px">
        <h3>Prix de gros</h3>
        <form class="quick-promo gros-form" id="grosForm">
          <div class="field"><label>Le prix de gros s'applique dès</label><div class="with-unit"><input name="min" type="number" min="0" max="999" value="${esc(state.settings.wholesale_min_qty)}" required><span>articles dans le panier</span></div></div>
          <p class="hint" style="margin:0">Tous parfums et formats confondus. Mettre 0 pour désactiver le prix de gros. Les prix de gros de chaque format se règlent dans la fiche produit.</p>
          <button class="btn btn-dark" type="submit">${icon("check", 16)} Enregistrer</button>
        </form>
      </div>
      <div class="panel">
        <h3>Promo express</h3>
        <form class="quick-promo" id="quickPromo">
          <div class="field"><label>Produit</label><select name="pid" required><option value="">Choisir un produit…</option>${state.products.filter((p) => p.active).map((p) => `<option value="${p.id}">${esc(p.name)} — dès ${fmt(p.price)}</option>`).join("")}</select></div>
          <div class="field"><label>Réduction</label><div class="with-unit"><input name="pct" type="number" min="1" max="90" value="15" required><span>%</span></div></div>
          <div class="field"><label>Durée</label><select name="days"><option value="1">24 heures</option><option value="3">3 jours</option><option value="7" selected>1 semaine</option><option value="14">2 semaines</option><option value="30">1 mois</option><option value="0">Sans limite</option></select></div>
          <button class="btn btn-dark" type="submit">${icon("tag", 16)} Lancer</button>
        </form>
      </div>
      <h3 class="section-title">Promotions en cours (${active.length})</h3>
      ${active.length ? `<div class="promo-grid">${active.map((p) => `
        <div class="promo-item">${thumb(p)}
          <div class="grow"><div class="row-title ellipsis">${esc(p.name)}</div><div class="row-sub">dès <b style="color:var(--wine)">${fmt(unitPrice(p))}</b> <s>${fmt(p.price)}</s></div><div class="row-sub">${p.promo_until ? "Jusqu'au " + new Date(p.promo_until).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Sans date de fin"}</div></div>
          <div style="text-align:right"><div class="pct">−${discount(p)}%</div><button class="btn btn-soft btn-xs" data-end-promo="${p.id}">Arrêter</button></div>
        </div>`).join("")}</div>` : `<div class="panel empty-state">${icon("tag", 32)}<p>Aucune promo active. Lancez-en une ci-dessus !</p></div>`}
      ${expired.length ? `<h3 class="section-title">Promos terminées</h3><div class="promo-grid">${expired.map((p) => `
        <div class="promo-item" style="opacity:.7">${thumb(p)}<div class="grow"><div class="row-title ellipsis">${esc(p.name)}</div><div class="row-sub">Terminée</div></div><button class="btn btn-soft btn-xs" data-end-promo="${p.id}">Effacer</button></div>`).join("")}</div>` : ""}`;
  }

  // ---- clients
  function customers(weekOnly) {
    const ws = weekStart(), map = {};
    state.orders.filter((o) => (weekOnly ? ["confirmee", "livree"].includes(o.status) && new Date(o.created_at) >= ws : o.status !== "annulee"))
      .forEach((o) => {
        const c = (map[o.phone] ||= { name: o.customer_name, phone: o.phone, city: o.city, count: 0, sum: 0, last: o.created_at });
        c.count++; c.sum += o.total; if (new Date(o.created_at) > new Date(c.last)) { c.last = o.created_at; c.name = o.customer_name; }
      });
    return Object.values(map).sort((a, b) => b.sum - a.sum || b.count - a.count);
  }
  function clients() {
    const week = customers(true), all = customers(false);
    const table = (list, showRank) => `<div class="panel table-wrap"><table class="clients-table">
      <thead><tr>${showRank ? "<th>#</th>" : ""}<th>Client</th><th>Lieu</th><th>Commandes</th><th>Total</th><th>Dernière</th><th></th></tr></thead>
      <tbody>${list.map((c, i) => `<tr>${showRank ? `<td><span class="rank rank-${i + 1}">${i + 1}</span></td>` : ""}
        <td><div class="row-title">${esc(c.name)}</div><div class="row-sub">${esc(c.phone)}</div></td><td>${esc(c.city)}</td><td>${c.count}</td><td><strong>${fmt(c.sum)}</strong></td><td class="row-sub">${relTime(c.last)}</td>
        <td><a class="btn btn-wa btn-xs" target="_blank" rel="noopener" href="${waLink(`Bonjour ${c.name.split(" ")[0]}, ici ${CFG.brand.name} ✨`, clientWa(c.phone))}">${icon("whatsapp", 14)}</a></td></tr>`).join("")}</tbody></table></div>`;
    return `
      <p class="muted" style="margin-top:0;font-size:14px">Le classement de la semaine (affiché sur le site sous la forme « Prénom N. ») ne compte que les commandes <b>confirmées</b> ou <b>livrées</b>, du lundi au dimanche.</p>
      <h3 class="section-title" style="margin-top:10px">👑 Podium de la semaine</h3>
      ${week.length ? table(week.slice(0, 10), true) : `<div class="panel empty-state">${icon("crown", 32)}<p>Aucune commande confirmée cette semaine pour l'instant.</p></div>`}
      <h3 class="section-title">Tous les clients (${all.length})</h3>
      ${all.length ? table(all, false) : `<div class="panel empty-state">Pas encore de clients.</div>`}`;
  }

  // ------------------------------------------------------------ éditeur produit
  let draft = null;
  const DEFAULT_FORMATS = () => (window.CATALOGUE && window.CATALOGUE[0] ? JSON.parse(JSON.stringify(window.CATALOGUE[0].variants)).map((v) => ({ ...v, stock: 0 }))
    : [{ id: "std", label: "Standard", volume_ml: null, price: "", wholesale_price: "", stock: 0 }]);
  function openEditor(p) {
    draft = p ? JSON.parse(JSON.stringify(p)) : { name: "", brand: "", category: CFG.categories[0], variants: DEFAULT_FORMATS(), description: "", notes_top: "", notes_heart: "", notes_base: "", image_url: "", gallery: [], color: "#dba524", featured: true, active: true, promo_pct: null, promo_until: null };
    draft.gallery = draft.gallery || [];
    draft.variants = variantsOf(draft).map((v) => ({ ...v }));
    renderEditor();
    openLayer("#editorModal");
    setTimeout(() => !p && $("#e-name").focus(), 350);
  }
  function renderEditor() {
    const d = draft, promoOn = +d.promo_pct > 0;
    $("#editorPanel").innerHTML = `
      <form id="editorForm" novalidate>
        <div class="editor-head"><h2>${d.id ? "Modifier le produit" : "Nouveau produit"}</h2><button type="button" class="icon-btn" data-close aria-label="Fermer">${icon("x", 22)}</button></div>
        <div class="editor-body">
          <div>
            <label class="dropzone" id="dropzone">
              ${d.image_url ? `<img src="${esc(d.image_url)}" alt="">` : bottleSVG({ ...d, name: d.name || "?" })}
              <span class="dz-label">${icon("image", 16)} ${d.image_url ? "Changer la photo" : "Ajouter la photo principale"}</span>
              <input type="file" accept="image/*" id="mainFile" hidden>
            </label>
            <p class="hint">Photo carrée ou verticale. Elle est compressée automatiquement.</p>
            <div class="gallery">
              ${d.gallery.map((u, i) => `<div><img src="${esc(u)}" alt=""><button type="button" class="g-del" data-gdel="${i}" aria-label="Retirer">${icon("x", 12)}</button></div>`).join("")}
              ${d.gallery.length < 4 ? `<label class="g-add">${icon("plus", 18)}<input type="file" accept="image/*" id="galFile" multiple hidden></label>` : ""}
            </div>
            <p class="hint">Photos supplémentaires (jusqu'à 4).</p>
            ${d.image_url ? `<button type="button" class="btn btn-soft btn-xs" data-remove-main style="margin-top:6px">Retirer la photo principale</button>` : ""}
          </div>
          <div>
            <div class="form-grid">
              <div class="field full"><label for="e-name">Nom du parfum *</label><input id="e-name" name="name" required value="${esc(d.name)}" placeholder="Ex : Tobacco Vanille"></div>
              <div class="field"><label for="e-cat">Catégorie</label><select id="e-cat" name="category">${CFG.categories.map((c) => `<option ${c === d.category ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
              <div class="field"><label for="e-color">Couleur (si pas de photo)</label><input id="e-color" name="color" type="color" value="${esc(d.color || "#dba524")}"></div>
            </div>
            <div class="variants-box">
              <div class="vb-head"><b>Formats, prix et stock</b><button type="button" class="btn btn-soft btn-xs" data-vadd>${icon("plus", 14)} Ajouter un format</button></div>
              <div class="vb-row vb-labels"><span>Format</span><span>Prix détail</span><span>Prix gros</span><span>Stock</span><span></span></div>
              ${d.variants.map((v, i) => `
                <div class="vb-row" data-vrow="${i}">
                  <input name="v_label" value="${esc(v.label)}" placeholder="Ex : Eau de parfum 30 ml" aria-label="Nom du format">
                  <input name="v_price" type="number" min="0" step="50" inputmode="numeric" value="${esc(v.price)}" placeholder="Détail" aria-label="Prix détail">
                  <input name="v_wholesale" type="number" min="0" step="50" inputmode="numeric" value="${esc(v.wholesale_price ?? "")}" placeholder="Gros" aria-label="Prix de gros">
                  <input name="v_stock" type="number" min="0" inputmode="numeric" value="${esc(v.stock)}" aria-label="Stock">
                  <button type="button" class="icon-btn" data-vdel="${i}" aria-label="Retirer ce format" ${d.variants.length < 2 ? "disabled" : ""}>${icon("trash", 16)}</button>
                </div>`).join("")}
              <p class="hint">Prix en FCFA. Le prix de gros s'applique dès ${esc(state.settings.wholesale_min_qty)} articles dans le panier (réglable dans « Promos »).</p>
            </div>
            <div class="form-grid">
              <div class="field full"><label for="e-desc">Description</label><textarea id="e-desc" name="description" rows="3" placeholder="Ce qui rend ce parfum unique…">${esc(d.description)}</textarea></div>
              <div class="field"><label for="e-top">Notes de tête</label><input id="e-top" name="notes_top" value="${esc(d.notes_top)}" placeholder="Bergamote, citron…"></div>
              <div class="field"><label for="e-heart">Notes de cœur</label><input id="e-heart" name="notes_heart" value="${esc(d.notes_heart)}" placeholder="Rose, jasmin…"></div>
              <div class="field full"><label for="e-base">Notes de fond</label><input id="e-base" name="notes_base" value="${esc(d.notes_base)}" placeholder="Vanille, musc, bois…"></div>
            </div>
            <div class="toggles">
              <label class="toggle-line"><span class="switch"><input type="checkbox" name="active" ${d.active ? "checked" : ""}><span></span></span> Visible sur le site</label>
              <label class="toggle-line"><span class="switch"><input type="checkbox" name="featured" ${d.featured ? "checked" : ""}><span></span></span> Afficher dans « Les plus populaires » ⭐</label>
            </div>
            <div class="promo-box ${promoOn ? "on" : ""}" id="promoBox">
              <label class="toggle-line"><span class="switch"><input type="checkbox" id="promoToggle" ${promoOn ? "checked" : ""}><span></span></span> Ce parfum est en promo (tous les formats)</label>
              <div class="promo-fields" ${promoOn ? "" : "hidden"}>
                <div class="field"><label for="e-pct">Réduction</label><div class="with-unit"><input id="e-pct" name="promo_pct" type="number" min="1" max="90" value="${esc(promoOn ? d.promo_pct : 15)}"><span>%</span></div></div>
                <div class="field"><label for="e-puntil">Fin de la promo</label><input id="e-puntil" name="promo_until" type="datetime-local" value="${toLocalInput(d.promo_until)}"></div>
                <p class="promo-preview muted" id="promoPreview"></p>
              </div>
            </div>
          </div>
        </div>
        <div class="editor-foot">
          <button type="button" class="btn btn-outline" data-close>Annuler</button>
          <button type="submit" class="btn btn-dark" id="saveBtn">${icon("check", 18)} Enregistrer</button>
        </div>
      </form>`;
    updatePromoPreview();
  }
  function readForm() {
    const f = $("#editorForm"), v = (n) => f.elements[n].value;
    const int = (x) => (x === "" || x == null ? null : Math.max(0, parseInt(x, 10) || 0));
    const variants = $$(".vb-row[data-vrow]", f).map((row) => {
      const old = draft.variants[+row.dataset.vrow] || {};
      const label = row.querySelector("[name=v_label]").value.trim();
      const ml = (label.match(/(\d+)\s*ml/i) || [])[1];
      return { id: old.id || "f" + Math.random().toString(36).slice(2, 7), label, volume_ml: ml ? +ml : null,
        price: int(row.querySelector("[name=v_price]").value), wholesale_price: int(row.querySelector("[name=v_wholesale]").value),
        stock: int(row.querySelector("[name=v_stock]").value) || 0 };
    });
    Object.assign(draft, {
      name: v("name").trim(), category: v("category"), color: v("color"), variants,
      description: v("description").trim(), notes_top: v("notes_top").trim(), notes_heart: v("notes_heart").trim(), notes_base: v("notes_base").trim(),
      active: f.elements.active.checked, featured: f.elements.featured.checked,
    });
    if ($("#promoToggle").checked && +v("promo_pct") > 0) {
      draft.promo_pct = Math.min(90, Math.max(1, parseInt(v("promo_pct"), 10)));
      draft.promo_until = v("promo_until") ? new Date(v("promo_until")).toISOString() : null;
    } else { draft.promo_pct = null; draft.promo_until = null; }
  }
  function updatePromoPreview() {
    const el = $("#promoPreview"); if (!el) return;
    const pct = +($("#e-pct") || {}).value;
    const ex = draft.variants.find((v) => +v.price > 0);
    el.innerHTML = pct > 0 && ex ? `Exemple : ${esc(ex.label || "format")} à <b style="color:var(--wine)">${fmt(roundPrice(ex.price * (100 - pct) / 100))}</b> au lieu de <s>${fmt(ex.price)}</s> (−${pct}%)${$("#e-puntil").value ? ", avec compte à rebours" : ""}.` : "";
  }
  async function saveEditor() {
    readForm();
    $$("#editorForm .field, #editorForm .vb-row").forEach((f) => f.classList.remove("invalid"));
    let bad = false;
    if (draft.name.length < 2) { $("#e-name").closest(".field").classList.add("invalid"); bad = true; }
    $$(".vb-row[data-vrow]").forEach((row, i) => { const v = draft.variants[i]; if (!v.label || !(v.price > 0)) { row.classList.add("invalid"); bad = true; } });
    if (bad) { toast("Indiquez le nom du parfum, et pour chaque format un nom et un prix.", "error"); return; }
    if (draft.variants.some((v) => v.wholesale_price && v.wholesale_price >= v.price)) { toast("Le prix de gros doit être inférieur au prix au détail.", "error"); return; }
    const btn = $("#saveBtn"); btn.disabled = true; btn.textContent = "Enregistrement…";
    try {
      await Store.saveProduct(draft);
      toast(`${icon("check", 16)} « ${esc(draft.name)} » enregistré`, "success");
      closeLayer("#editorModal");
      await reload();
    } catch (e) { toast(esc(Store.humanError(e)), "error"); btn.disabled = false; btn.innerHTML = `${icon("check", 18)} Enregistrer`; }
  }
  async function handleUpload(files, target) {
    const dz = $("#dropzone");
    try {
      readForm();
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        if (target === "main") { dz.classList.add("dz-loading"); draft.image_url = await Store.uploadImage(file); }
        else if (draft.gallery.length < 4) draft.gallery.push(await Store.uploadImage(file));
      }
      renderEditor();
    } catch (e) { toast(esc(Store.humanError(e)), "error"); dz && dz.classList.remove("dz-loading"); }
  }

  // ------------------------------------------------------------ confirmation
  function confirmBox(title, text, okLabel = "Confirmer", danger = true) {
    return new Promise((resolve) => {
      $("#confirmPanel").innerHTML = `<h3>${title}</h3><p>${text}</p><div class="btns"><button class="btn btn-outline" data-c="0">Retour</button><button class="btn ${danger ? "btn-danger" : "btn-dark"}" data-c="1">${okLabel}</button></div>`;
      openLayer("#confirmModal");
      $("#confirmPanel").onclick = (e) => { const b = e.target.closest("[data-c]"); if (!b) return; closeLayer("#confirmModal"); resolve(b.dataset.c === "1"); };
    });
  }

  function openLayer(sel) { $(sel).classList.add("open"); $(sel).setAttribute("aria-hidden", "false"); document.body.classList.add("locked"); }
  function closeLayer(sel) { $(sel).classList.remove("open"); $(sel).setAttribute("aria-hidden", "true"); if (!$(".modal.open")) document.body.classList.remove("locked"); }

  // ------------------------------------------------------------ événements
  let bound = false;
  function bind() {
    if (bound) return; bound = true;
    $("#sideNav").addEventListener("click", (e) => { const b = e.target.closest("[data-view]"); if (b) go(b.dataset.view); });
    $("#logoutBtn").addEventListener("click", async () => { await Store.signOut(); location.reload(); });
    $("#notifBtn").addEventListener("click", async () => {
      chime();
      if (!("Notification" in window)) { toast("Votre navigateur ne gère pas les notifications. Le son reste actif tant que la page est ouverte."); return; }
      const p = await Notification.requestPermission();
      if (p === "granted") { $("#notifBtn").hidden = true; toast(`${icon("bell", 16)} Alertes activées : vous serez prévenue à chaque commande.`, "success"); }
      else toast("Notifications refusées. Autorisez-les dans les réglages du navigateur.", "error");
    });

    document.addEventListener("click", async (e) => {
      const t = e.target.closest("button, a, label"); if (!t) return;
      const ds = t.dataset;
      if (ds.go) { if (ds.filter) state.orderFilter = ds.filter; go(ds.go); return; }
      if (ds.of) { state.orderFilter = ds.of; render(); return; }
      if (t.hasAttribute("data-new")) { openEditor(null); return; }
      if (ds.edit) { openEditor(byId(ds.edit)); return; }
      if (t.hasAttribute("data-close") && t.closest("#editorModal")) { closeLayer("#editorModal"); return; }
      if (ds.gdel != null) { readForm(); draft.gallery.splice(+ds.gdel, 1); renderEditor(); return; }
      if (t.hasAttribute("data-remove-main")) { readForm(); draft.image_url = ""; renderEditor(); return; }
      if (ds.stock) {
        const p = byId(ds.stock), v = variantsOf(p).find((x) => x.id === ds.vid); if (!v || v.stock + +ds.d < 0) return;
        try { v.stock = await Store.adjustStock(p.id, v.id, +ds.d); render(); } catch (err) { toast(esc(Store.humanError(err)), "error"); }
        return;
      }
      if (t.hasAttribute("data-vadd")) { readForm(); draft.variants.push({ id: "f" + Math.random().toString(36).slice(2, 7), label: "", volume_ml: null, price: "", wholesale_price: "", stock: 0 }); renderEditor(); return; }
      if (ds.vdel != null) { readForm(); if (draft.variants.length > 1) draft.variants.splice(+ds.vdel, 1); renderEditor(); return; }
      if (ds.status) {
        const id = isNaN(ds.id) ? ds.id : +ds.id;
        const o = state.orders.find((x) => String(x.id) === String(ds.id));
        if (ds.status === "annulee" && !(await confirmBox("Annuler la commande ?", `La commande ${esc(o.code)} sera annulée et <b>le stock sera remis automatiquement</b>.`, "Oui, annuler"))) return;
        try {
          await Store.updateOrderStatus(o.id ?? id, ds.status);
          toast(`${icon("check", 16)} Commande ${esc(o.code)} : ${STATUS[ds.status]}`, "success");
          await reload();
        } catch (err) { toast(esc(Store.humanError(err)), "error"); }
        return;
      }
      if (ds.delOrder) {
        const o = state.orders.find((x) => String(x.id) === ds.delOrder);
        if (!(await confirmBox("Supprimer définitivement ?", `La commande ${esc(o.code)} sera effacée de l'historique.`, "Supprimer"))) return;
        await Store.deleteOrder(o.id); await reload(); return;
      }
      if (ds.delProduct) {
        const p = byId(ds.delProduct);
        if (!(await confirmBox("Supprimer ce produit ?", `« ${esc(p.name)} » sera retiré définitivement. Astuce : vous pouvez aussi simplement le masquer avec l'interrupteur « En ligne ».`, "Supprimer"))) return;
        try { await Store.deleteProduct(p.id); toast("Produit supprimé"); await reload(); } catch (err) { toast(esc(Store.humanError(err)), "error"); }
        return;
      }
      if (ds.endPromo) {
        const p = byId(ds.endPromo);
        await Store.saveProduct({ ...p, promo_pct: null, promo_until: null });
        toast(`Promo arrêtée pour « ${esc(p.name)} »`); await reload(); return;
      }
    });

    document.addEventListener("change", async (e) => {
      const t = e.target;
      if (t.dataset.active) {
        const p = byId(t.dataset.active);
        try { await Store.saveProduct({ ...p, active: t.checked }); toast(t.checked ? `« ${esc(p.name)} » est visible sur le site` : `« ${esc(p.name)} » est masqué`); await reload(); }
        catch (err) { t.checked = !t.checked; toast(esc(Store.humanError(err)), "error"); }
      }
      if (t.dataset.stockInput) {
        const p = byId(t.dataset.stockInput), v = variantsOf(p).find((x) => x.id === t.dataset.vid), val = Math.max(0, parseInt(t.value, 10) || 0);
        try { v.stock = await Store.adjustStock(p.id, v.id, val - v.stock); toast(`Stock « ${esc(p.name)} » ${esc(v.label)} : ${v.stock}`); render(); } catch (err) { toast(esc(Store.humanError(err)), "error"); }
      }
      if (t.id === "catFilter") { state.productCat = t.value; render(); }
      if (t.id === "mainFile") handleUpload(t.files, "main");
      if (t.id === "galFile") handleUpload(t.files, "gallery");
      if (t.id === "promoToggle") {
        $("#promoBox").classList.toggle("on", t.checked);
        $("#promoBox .promo-fields").hidden = !t.checked;
        updatePromoPreview();
      }
      if (t.id === "e-puntil") updatePromoPreview();
    });

    document.addEventListener("input", (e) => {
      const t = e.target;
      if (t.id === "orderSearch") { state.orderQuery = t.value; debounceRender(t.id); }
      if (t.id === "productSearch") { state.productQuery = t.value; debounceRender(t.id); }
      if (t.id === "e-pct") updatePromoPreview();
    });

    document.addEventListener("submit", async (e) => {
      if (e.target.id === "editorForm") { e.preventDefault(); saveEditor(); }
      if (e.target.id === "grosForm") {
        e.preventDefault();
        const min = Math.max(0, parseInt(e.target.elements.min.value, 10) || 0);
        try { await Store.saveSettings({ wholesale_min_qty: min }); state.settings.wholesale_min_qty = min; toast(min ? `${icon("check", 16)} Prix de gros dès ${min} articles` : "Prix de gros désactivé", "success"); }
        catch (err) { toast(esc(Store.humanError(err)), "error"); }
      }
      if (e.target.id === "quickPromo") {
        e.preventDefault();
        const f = e.target, p = byId(f.elements.pid.value); if (!p) { toast("Choisissez un produit.", "error"); return; }
        const pct = Math.min(90, Math.max(1, +f.pct.value)), days = +f.days.value;
        await Store.saveProduct({ ...p, promo_pct: pct, promo_until: days ? new Date(Date.now() + days * 86400000).toISOString() : null });
        toast(`${icon("tag", 16)} « ${esc(p.name)} » est en promo (−${pct}%)`, "success");
        await reload();
      }
    });

    // glisser-déposer de photo
    document.addEventListener("dragover", (e) => { const dz = e.target.closest && e.target.closest("#dropzone"); if (dz) { e.preventDefault(); dz.classList.add("drag"); } });
    document.addEventListener("dragleave", (e) => { const dz = e.target.closest && e.target.closest("#dropzone"); if (dz) dz.classList.remove("drag"); });
    document.addEventListener("drop", (e) => { const dz = e.target.closest && e.target.closest("#dropzone"); if (dz) { e.preventDefault(); dz.classList.remove("drag"); handleUpload(e.dataTransfer.files, "main"); } });
    $$(".modal-backdrop[data-close]").forEach((b) => b.addEventListener("click", () => closeLayer("#" + b.parentElement.id)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#editorModal.open")) closeLayer("#editorModal"); });
  }
  let dr; function debounceRender(focusId) {
    clearTimeout(dr);
    dr = setTimeout(() => { const el = $("#" + focusId), pos = el && el.selectionStart; render(); const n = $("#" + focusId); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }, 200);
  }

  boot();
})();
