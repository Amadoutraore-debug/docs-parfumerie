/* =====================================================================
   BOUTIQUE — catalogue, panier, commande
   ===================================================================== */
(function () {
  const CFG = window.APP_CONFIG;
  const { fmt, esc, promoActive, unitPrice, discount, variantsOf, variantOf, retailPrice, linePrice, productVisual, bottleSVG, icon, toast, waLink } = window.U;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const CART_KEY = "parfumerie_cart";
  const state = {
    products: [],
    cart: load(CART_KEY, []),
    filter: "Tous",
    query: "",
    sort: "new",
  };
  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }
  const saveCart = () => localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  const byId = (id) => state.products.find((p) => p.id === id);
  const inCart = (id, vid) => state.cart.filter((l) => l.id === id && (vid == null || l.vid === vid)).reduce((a, l) => a + l.qty, 0);
  // Stock affiché = stock réel du format − ce qui est déjà dans le panier
  const availableV = (p, v) => Math.max(0, (+v.stock || 0) - inCart(p.id, v.id));
  const available = (p) => variantsOf(p).reduce((a, v) => a + availableV(p, v), 0);
  // Tarif de gros : dès que le panier atteint le minimum d'articles (tous parfums confondus)
  state.settings = { wholesale_min_qty: CFG.wholesaleMinQty || 10 };
  const wholesaleMin = () => +state.settings.wholesale_min_qty || 0;
  const wholesaleOn = (extra = 0) => wholesaleMin() > 0 && cartCount() + extra >= wholesaleMin();
  const fmtShort = (v) => (v.volume_ml ? `${v.volume_ml} ml` : v.label.replace(/ de parfum$/, ""));

  // ------------------------------------------------------------ marque
  function brandHTML(full) {
    const B = CFG.brand;
    if (full) return U.logoFull ? U.logoFull("logo-full") : `<img class="logo-full" src="${esc(B.logoFull)}" alt="${esc(B.name)}">`;
    const mark = U.logoMark ? U.logoMark("logo-mark-svg") : `<img src="${esc(B.logo)}" alt="">`;
    return `${mark}<span>${esc(B.name)}<small>${esc(B.signature || "")}</small></span>`;
  }
  function initBrand() {
    const B = CFG.brand;
    document.title = `${B.name} — Parfumerie à ${B.city}`;
    $("#logo").innerHTML = brandHTML();
    $("#footerLogo").innerHTML = brandHTML(true);
    $("#footerName").textContent = B.name;
    $("#footerTag").textContent = B.tagline;
    $("#year").textContent = new Date().getFullYear();
    $("#deliveryInfo").textContent = CFG.deliveryInfo;
    $("#waveMention").textContent = CFG.wave.enabled ? "ou par Wave." : ".";
    const wa = waLink(`Bonjour ${B.name} ! J'aimerais un conseil parfum.`);
    $("#proWa").href = waLink(`Bonjour ${B.name} ! Je souhaite commander en gros.`);
    $("#sideWa").href = wa;
    $("#topWa").href = wa; $("#topWa").innerHTML = `${icon("whatsapp", 15)} ${esc(CFG.phoneDisplay)}`;
    $("#trustPhone").textContent = CFG.phoneDisplay;
    $("#footerWa").href = wa; $("#footerWa").innerHTML = `${icon("whatsapp", 16)} ${esc(CFG.phoneDisplay)}`;
    $("#footerAddress").innerHTML = B.address ? `${icon("pin", 16)} ${esc(B.address)}` : "";
    $("#footerEmail").innerHTML = CFG.email ? `<a href="mailto:${esc(CFG.email)}">${esc(CFG.email)}</a>` : "";
    $("#socials").innerHTML = Object.entries(CFG.socials).filter(([, v]) => v)
      .map(([k, v]) => `<a href="${esc(v)}" target="_blank" rel="noopener" aria-label="${k}">${icon(k, 18)}</a>`).join("");
    const SOC = { instagram: ["Instagram", "doc.s_parfumerie"], tiktok: ["TikTok", "doc_sparfumerie"], facebook: ["Facebook", "doc's parfumerie"] };
    $("#socialBig").innerHTML = Object.entries(CFG.socials).filter(([, v]) => v)
      .map(([k, v]) => `<a href="${esc(v)}" target="_blank" rel="noopener">${icon(k, 24)}<span><b>${SOC[k] ? SOC[k][0] : k}</b><small>${SOC[k] ? esc(SOC[k][1]) : ""}</small></span></a>`).join("");
    $("#bestReward").innerHTML = `${icon("sparkle", 18)}<span>${esc(CFG.bestCustomerReward)}</span>`;
    if (!CFG.showBestCustomers) $("#client-semaine").remove();
    $$("[data-ico]").forEach((el) => { el.insertAdjacentHTML("afterbegin", icon(el.dataset.ico, el.classList.contains("icon-btn") ? 22 : 18)); });
    $(".jm-cart-ico").insertAdjacentHTML("afterbegin", icon("bag", 24));
    $$(".jm-slide-btn.prev").forEach((b) => (b.innerHTML = icon("chevronL", 22)));
    $$(".jm-slide-btn.next").forEach((b) => (b.innerHTML = icon("chevronR", 22)));
    const msgs = [
      `${icon("truck", 15)} Livraison à Bouaké et partout en Côte d'Ivoire`,
      `${icon("box", 15)} Prix de gros automatique dès ${CFG.wholesaleMinQty || 10} articles`,
      `${icon("cash", 15)} ${CFG.wave.enabled ? "Paiement à la livraison ou par Wave" : "Paiement à la livraison"}`,
    ];
    $("#announceTrack").innerHTML = msgs.map((m) => `<span>${m}</span>`).join("");
  }

  // ------------------------------------------------------------ accueil (style boutique en ligne)
  const CAT_ICONS = { Homme: "user", Femme: "sparkle", Mixte: "heart", Coffrets: "box" };
  function renderCatNav() {
    const cats = CFG.categories.filter((c) => state.products.some((p) => p.category === c));
    const items = [["Tous", "grid", "Tous les parfums"], ...cats.map((c) => [c, CAT_ICONS[c] || "tag", c])];
    if (state.products.some(promoActive)) items.push(["Promos", "tag", "Promos"]);
    $("#catNav").innerHTML = items.map(([k, ic, l]) => `<button class="jm-catlink ${state.filter === k ? "on" : ""}" data-cat="${esc(k)}" data-scroll="1">${icon(ic, 17)}${esc(l)}</button>`).join("")
      + `<a class="jm-catlink" href="#formats">${icon("flask", 17)}Formats &amp; prix</a><a class="jm-catlink" href="#gros">${icon("box", 17)}Prix de gros</a>`
      + (CFG.showBestCustomers ? `<a class="jm-catlink" href="#client-semaine">${icon("crown", 17)}Client de la semaine</a>` : "");
  }

  let slideIdx = 0, slideTimer;
  function renderHero() {
    const imgs = state.products.filter((p) => p.image_url);
    const pick = (i) => imgs[i % Math.max(imgs.length, 1)];
    const min = wholesaleMin(), from = state.products.length ? Math.min(...state.products.map(unitPrice)) : 0;
    const shot = (p, cls = "") => p ? `<img class="${cls}" src="${esc(p.image_url)}" alt="${esc(p.name)}">` : "";
    const slides = [
      { cls: "s1", kicker: "Nouvelle collection by CCK", title: `Marquez votre <em>présence</em>`, text: "Eaux de parfum et essences conçues à Bouaké.",
        price: `Dès <b>${fmt(from)}</b>`, cta: "J'achète", href: "#collection", art: `<div class="jm-art trio">${shot(pick(1), "b1")}${shot(pick(0), "b2")}${shot(pick(2), "b3")}</div>` },
      { cls: "s2", kicker: "Revendeurs & grossistes", title: `Prix de <em>gros</em> automatique`, text: min ? `Dès ${min} articles dans le panier, sur toute la commande.` : "Contactez-nous pour vos achats en quantité.",
        price: `Jusqu'à <b>−20 %</b>`, cta: "Commander en gros", href: "#gros", art: `<div class="jm-art duo">${shot(pick(3), "b1")}${shot(pick(5), "b2")}</div>` },
      { cls: "s3", kicker: "Le format préféré", title: `Eau de parfum <em>50 ml</em>`, text: "Le sillage qui dure, au prix le plus doux.",
        price: `<b>${fmt(5000)}</b>`, cta: "Choisir mon parfum", href: "#collection", art: `<div class="jm-art solo">${shot(pick(6), "b1")}</div>` },
    ];
    $("#slides").innerHTML = slides.map((sl, i) => `
      <div class="jm-slide ${sl.cls} ${i === slideIdx ? "on" : ""}" aria-hidden="${i !== slideIdx}">
        <div class="jm-slide-text">
          <span class="jm-slide-kicker">${esc(sl.kicker)}</span>
          <h2>${sl.title}</h2>
          <p>${esc(sl.text)}</p>
          <div class="jm-slide-price">${sl.price}</div>
          <a href="${sl.href}" class="jm-btn jm-btn-gold">${esc(sl.cta)} ${icon("arrow", 16)}</a>
        </div>
        ${sl.art}
      </div>`).join("");
    $("#dots").innerHTML = slides.map((_, i) => `<button class="${i === slideIdx ? "on" : ""}" data-dot="${i}" aria-label="Bannière ${i + 1}"></button>`).join("");
    clearInterval(slideTimer); slideTimer = setInterval(() => goSlide(slideIdx + 1), 5500);
    if (min) $("#sideGros").textContent = `Dès ${min} articles dans le panier`;
    renderTiles();
    renderCatNav();
    renderFormats();
  }
  function goSlide(i) {
    const n = $$(".jm-slide").length; if (!n) return;
    slideIdx = (i + n) % n;
    $$(".jm-slide").forEach((el, k) => { el.classList.toggle("on", k === slideIdx); el.setAttribute("aria-hidden", k !== slideIdx); });
    $$("#dots button").forEach((el, k) => el.classList.toggle("on", k === slideIdx));
  }

  function renderTiles() {
    const cats = CFG.categories.filter((c) => state.products.some((p) => p.category === c));
    const tiles = cats.map((c) => ({ key: c, label: c, p: state.products.find((p) => p.category === c && p.image_url), n: state.products.filter((p) => p.category === c).length }));
    const promos = state.products.filter(promoActive);
    if (promos.length) tiles.push({ key: "Promos", label: "Promos", p: promos[0], n: promos.length });
    tiles.push({ key: "Tous", label: "Toute la collection", p: state.products.find((p) => p.image_url && !tiles.some((t) => t.p === p)) || state.products[0], n: state.products.length });
    $("#catTiles").innerHTML = tiles.map((t) => `
      <button class="jm-tile" data-cat="${esc(t.key)}" data-scroll="1">
        <span class="jm-tile-name">${esc(t.label)}</span>
        <span class="jm-tile-img">${t.p ? productVisual(t.p) : ""}</span>
        <span class="jm-tile-cta">${t.n} parfum${t.n > 1 ? "s" : ""} · Découvrir</span>
      </button>`).join("");
  }

  // Les formats proposés (repris du catalogue) avec prix détail / gros
  function renderFormats() {
    const map = new Map();
    state.products.forEach((p) => variantsOf(p).forEach((v) => { if (!map.has(v.id)) map.set(v.id, v); }));
    const list = [...map.values()].sort((a, b) => a.price - b.price).slice(0, 4);
    const min = wholesaleMin();
    const art = (i) => {
      const h = [60, 84, 104][i] || 96, w = [38, 52, 66][i] || 56;
      return `<svg viewBox="0 0 110 130" class="jm-fmt-art" aria-hidden="true"><defs><linearGradient id="fg${i}" x1="0" x2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".5" stop-color="#e2ad2e"/><stop offset="1" stop-color="#9a6410"/></linearGradient></defs>
        <rect x="${55 - 8}" y="${124 - h - 24}" width="16" height="13" rx="2" fill="#0b0907"/><rect x="${55 - 12}" y="${124 - h - 11}" width="24" height="8" rx="2" fill="url(#fg${i})"/>
        <rect x="${55 - w / 2}" y="${124 - h}" width="${w}" height="${h}" rx="${i ? 9 : 14}" fill="#fff" stroke="#0b0907" stroke-width="2.5"/>
        <rect x="${55 - w / 2 + 5}" y="${124 - h * .58}" width="${w - 10}" height="${h * .58 - 5}" rx="5" fill="url(#fg${i})"/></svg>`;
    };
    $("#formatGrid").innerHTML = list.map((v, i) => {
      const pct = +v.wholesale_price > 0 ? Math.round((1 - v.wholesale_price / v.price) * 100) : 0;
      return `
      <article class="jm-fmt ${i === 1 ? "is-star" : ""}">
        ${art(i)}
        <div class="jm-fmt-body">
          <h3>${esc(v.label)}</h3>
          <p class="jm-fmt-price">${fmt(v.price)} <small>au détail</small></p>
          ${pct && min ? `<p class="jm-fmt-gros"><b>${fmt(v.wholesale_price)}</b> en gros <span class="jm-badge">−${pct}%</span></p>` : ""}
          <a href="#collection" class="jm-link">Choisir un parfum ${icon("arrow", 14)}</a>
        </div>
      </article>`;
    }).join("");
    if (min) $("#proText").innerHTML = `Dès <b>${min} articles</b> dans votre panier, tous parfums et formats confondus, le prix de gros s'applique automatiquement sur toute la commande. Idéal pour les revendeurs, les boutiques et les cadeaux en nombre.`;
  }

  // ------------------------------------------------------------ carrousels
  let cdTimer;
  function popular() {
    const list = state.products.filter((p) => p.featured && p.stock > 0);
    const rest = state.products.filter((p) => !list.includes(p) && p.stock > 0).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return [...list, ...rest].slice(0, 8);
  }
  function renderRails() {
    $("#popularRail").innerHTML = popular().map(cardHTML).join("");
    const promos = state.products.filter(promoActive);
    $("#promos").hidden = !promos.length;
    $("#promoRail").innerHTML = promos.map(cardHTML).join("");
    $$(".rail").forEach(updateRailBtns);
    clearInterval(cdTimer);
    tickTimers(); cdTimer = setInterval(tickTimers, 1000);
  }
  function tickTimers() {
    // compte à rebours du bandeau « Ventes Flash » : fin de la promo la plus proche
    const ends = state.products.filter((p) => promoActive(p) && p.promo_until).map((p) => new Date(p.promo_until));
    const t = $("#flashTimer");
    if (t) {
      if (ends.length) {
        const s = Math.max(0, (Math.min(...ends) - Date.now()) / 1000), pad = (n) => String(n).padStart(2, "0");
        const d = Math.floor(s / 86400);
        t.innerHTML = `${icon("clock", 15)} Se termine dans : <b>${d ? d + "j " : ""}${pad(Math.floor(s % 86400 / 3600))}h : ${pad(Math.floor(s % 3600 / 60))}m : ${pad(Math.floor(s % 60))}s</b>`;
      } else t.innerHTML = "";
    }
    $$("[data-until]").forEach((el) => {
      const s = Math.max(0, (new Date(el.dataset.until) - Date.now()) / 1000);
      const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = Math.floor(s % 60);
      const pad = (n) => String(n).padStart(2, "0");
      el.textContent = s ? `Fin dans ${d ? d + "j " : ""}${pad(h)}:${pad(m)}:${pad(sec)}` : "Promo terminée";
    });
  }
  function updateRailBtns(rail) {
    const wrap = rail.closest(".rail-wrap"); if (!wrap) return;
    $(".rail-btn.prev", wrap).disabled = rail.scrollLeft < 8;
    $(".rail-btn.next", wrap).disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 8;
  }

  // ------------------------------------------------------------ catalogue
  const FAV_KEY = "parfumerie_favoris";
  state.favs = new Set(load(FAV_KEY, []));
  function toggleFav(id) {
    state.favs.has(id) ? state.favs.delete(id) : state.favs.add(id);
    localStorage.setItem(FAV_KEY, JSON.stringify([...state.favs]));
    $$(`[data-fav="${id}"]`).forEach((b) => b.classList.toggle("on", state.favs.has(id)));
    if (state.favs.has(id)) toast(`${icon("heart", 16)} Ajouté à vos favoris`, "success");
    renderChips();
    if (state.filter === "Favoris") renderGrid();
  }

  function renderChips() {
    const cats = ["Tous", ...CFG.categories.filter((c) => state.products.some((p) => p.category === c))];
    if (state.products.some(promoActive)) cats.splice(1, 0, "Promos");
    const favCount = state.products.filter((p) => state.favs.has(p.id)).length;
    if (favCount) cats.push("Favoris");
    if (state.filter === "Favoris" && !favCount) state.filter = "Tous";
    const count = (c) => c === "Tous" ? state.products.length : c === "Promos" ? state.products.filter(promoActive).length : c === "Favoris" ? favCount : state.products.filter((p) => p.category === c).length;
    $("#chips").innerHTML = cats.map((c) =>
      `<button class="chip ${state.filter === c ? "active" : ""}" data-cat="${esc(c)}" role="tab">${c === "Favoris" ? icon("heart", 14) + " " : ""}${esc(c)}<span class="n">${count(c)}</span></button>`).join("");
  }

  function stockHTML(p, v) {
    const a = v ? availableV(p, v) : available(p), total = v ? +v.stock : p.stock, t = CFG.lowStockThreshold;
    if (total <= 0) return `<span class="stock-line out">Rupture de stock</span>`;
    if (a <= 0) return `<span class="stock-line low">Tout le stock est dans votre panier</span>`;
    if (a <= t) return `<span class="stock-line low">Plus que ${a} en stock</span>`;
    return `<span class="stock-line">${a} en stock</span>`;
  }
  function stockLine(p) {
    const a = available(p);
    const [cls, txt] = p.stock <= 0 ? ["out", "Rupture de stock"] : a <= 0 ? ["low", "Tout est dans votre panier"]
      : a <= CFG.lowStockThreshold ? ["low", `Plus que ${a} en stock`] : ["", `${a.toLocaleString("fr-FR")} en stock`];
    return `<p class="tk-line tk-stock ${cls}">${icon("box", 17)}<span>${txt}</span></p>`;
  }

  // Carte produit compacte (style boutique en ligne)
  function cardHTML(p) {
    const out = p.stock <= 0, a = available(p), promo = promoActive(p), vs = variantsOf(p), multi = vs.length > 1;
    const stockTxt = out ? "Épuisé" : a <= CFG.lowStockThreshold ? `Plus que ${a}` : `${a.toLocaleString("fr-FR")} articles en stock`;
    const add = out || a <= 0 ? "" : multi ? `data-open-btn="${p.id}"` : `data-add="${p.id}" data-vid="${vs[0].id}"`;
    return `
      <article class="jm-card ${out ? "out" : ""}" data-open="${p.id}">
        <div class="jm-img">
          ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">` : bottleSVG(p)}
          ${promo ? `<span class="jm-disc">−${discount(p)}%</span>` : ""}
          <button class="jm-fav ${state.favs.has(p.id) ? "on" : ""}" data-fav="${p.id}" aria-label="Favori">${icon("heart", 18)}</button>
          ${add ? `<button class="jm-plus" ${add} aria-label="Ajouter au panier">${icon("plus", 20)}</button>` : ""}
          ${out ? `<span class="jm-out">Épuisé</span>` : ""}
        </div>
        <div class="jm-info">
          <span class="jm-stock ${!out && a <= CFG.lowStockThreshold ? "low" : ""} ${out ? "none" : ""}">${stockTxt}</span>
          <h3 class="jm-name" title="${esc(p.name)}">${esc(p.name)}</h3>
          <p class="jm-meta">${esc(p.category)} · ${esc(vs.map(fmtShort).join(", "))}</p>
          <div class="jm-price">${multi ? "<small>dès</small> " : ""}${fmt(unitPrice(p))}</div>
          ${promo ? `<div class="jm-old"><s>${fmt(p.price)}</s><span class="jm-badge">−${discount(p)}%</span></div>` : `<div class="jm-old jm-gros-hint">${+vs[0].wholesale_price > 0 && wholesaleMin() ? `Gros : ${fmt(Math.min(...vs.filter((v) => +v.wholesale_price > 0).map((v) => +v.wholesale_price)))}` : "&nbsp;"}</div>`}
          <button class="jm-cta" ${add} ${add ? "" : "disabled"}>${out ? "Épuisé" : multi ? "Choisir le format" : "Ajouter au panier"}</button>
        </div>
      </article>`;
  }

  function filtered() {
    const q = state.query.trim().toLowerCase();
    let list = state.products.filter((p) =>
      (state.filter === "Tous" || (state.filter === "Promos" ? promoActive(p) : state.filter === "Favoris" ? state.favs.has(p.id) : p.category === state.filter)) &&
      (!q || [p.name, p.brand, p.category, p.description, p.notes_top, p.notes_heart, p.notes_base].join(" ").toLowerCase().includes(q)));
    const s = state.sort;
    list.sort((a, b) =>
      (a.stock <= 0) - (b.stock <= 0) ||
      (s === "price-asc" ? unitPrice(a) - unitPrice(b) :
       s === "price-desc" ? unitPrice(b) - unitPrice(a) :
       s === "promo" ? promoActive(b) - promoActive(a) || discount(b) - discount(a) :
       new Date(b.created_at) - new Date(a.created_at)));
    return list;
  }

  function renderGrid() {
    const list = filtered();
    $("#grid").innerHTML = list.map(cardHTML).join("");
    $("#emptyGrid").hidden = list.length > 0;
    $("#resultCount").textContent = `${list.length} parfum${list.length > 1 ? "s" : ""}${state.query ? ` pour « ${state.query} »` : ""}`;
    $$(".jm-catlink[data-cat]").forEach((b) => b.classList.toggle("on", b.dataset.cat === state.filter));
    tickTimers();
  }

  function renderAll() { renderChips(); renderGrid(); renderRails(); renderHero(); renderCart(); refreshOpenProduct(); }

  // ------------------------------------------------------------ fiche produit
  let openId = null, qty = 1, imgIdx = 0, selVid = null;
  function openProduct(id) {
    const p = byId(id); if (!p) return;
    openId = id; qty = 1; imgIdx = 0;
    // format proposé par défaut : le premier encore disponible
    const vs = variantsOf(p);
    selVid = (vs.find((v) => availableV(p, v) > 0) || vs[0]).id;
    renderProduct();
    openLayer("#productModal");
    history.replaceState(null, "", "#p=" + id);
  }
  function refreshOpenProduct() { if (openId && $("#productModal").classList.contains("open")) renderProduct(); }
  function renderProduct() {
    const p = byId(openId);
    if (!p) { closeLayer("#productModal"); return; }
    const vs = variantsOf(p), v = variantOf(p, selVid), a = availableV(p, v);
    qty = Math.min(Math.max(1, qty), Math.max(1, a));
    const imgs = [p.image_url, ...(p.gallery || [])].filter(Boolean);
    const notes = [["Tête", p.notes_top], ["Cœur", p.notes_heart], ["Fond", p.notes_base]].filter(([, x]) => x);
    const promo = promoActive(p), price = retailPrice(p, v);
    const min = wholesaleMin(), willBeWholesale = wholesaleOn(qty);
    $("#productPanel").innerHTML = `
      <button class="icon-btn modal-close" data-close aria-label="Fermer">${icon("x", 22)}</button>
      <div class="pp-media">
        <div class="pp-main">${imgs.length ? `<img src="${esc(imgs[imgIdx] || imgs[0])}" alt="${esc(p.name)}">` : bottleSVG(p)}</div>
        ${imgs.length > 1 ? `<div class="pp-thumbs">${imgs.map((u, i) => `<button class="${i === imgIdx ? "active" : ""}" data-img="${i}"><img src="${esc(u)}" alt=""></button>`).join("")}</div>` : ""}
      </div>
      <div class="pp-info">
        <p class="eyebrow" style="margin:0">${esc(p.category)}${p.brand ? " · " + esc(p.brand) : ""}</p>
        <h2>${esc(p.name)}</h2>
        ${vs.length > 1 ? `<div class="formats" role="radiogroup" aria-label="Format">
          ${vs.map((x) => { const ax = availableV(p, x); return `<button class="fmt ${x.id === v.id ? "on" : ""}" data-fmt="${esc(x.id)}" role="radio" aria-checked="${x.id === v.id}" ${+x.stock <= 0 ? "disabled" : ""}>
            <b>${esc(x.label)}</b><span>${fmt(retailPrice(p, x))}</span><small>${+x.stock <= 0 ? "Épuisé" : ax <= CFG.lowStockThreshold ? `Plus que ${ax}` : "En stock"}</small></button>`; }).join("")}
        </div>` : v.volume_ml ? `<div class="pp-vol">Flacon de ${v.volume_ml} ml</div>` : ""}
        <div class="pp-price">
          <span style="${promo ? "color:var(--wine)" : ""}">${fmt(price)}</span>
          ${promo ? `<s>${fmt(v.price)}</s><span class="badge badge-promo">−${discount(p)}%</span>` : ""}
        </div>
        ${+v.wholesale_price > 0 && min > 0 ? `<p class="pp-gros ${willBeWholesale ? "on" : ""}">${icon("box", 16)} <span>Prix de gros : <b>${fmt(v.wholesale_price)}</b> l'unité dès <b>${min} articles</b> dans le panier (tous parfums confondus)${willBeWholesale ? " — <b>appliqué !</b>" : ""}</span></p>` : ""}
        ${p.description ? `<p class="pp-desc">${esc(p.description)}</p>` : ""}
        ${notes.length ? `<div class="notes">${notes.map(([k, x]) => `<div class="note"><span>${k}</span>${esc(x)}</div>`).join("")}</div>` : ""}
        <div class="pp-stock">
          ${stockHTML(p, v)}
          ${+v.stock > 0 ? `<div class="stock-bar"><i style="width:${Math.min(100, (a / Math.max(+v.stock, 10)) * 100)}%"></i></div>` : ""}
        </div>
        <div class="pp-buy">
          ${a > 0 ? `
            <div class="qty">
              <button data-q="-1" ${qty <= 1 ? "disabled" : ""} aria-label="Moins">${icon("minus", 16)}</button>
              <output>${qty}</output>
              <button data-q="1" ${qty >= a ? "disabled" : ""} aria-label="Plus">${icon("plus", 16)}</button>
            </div>
            <button class="btn btn-dark" data-add-qty="${p.id}">${icon("bag", 18)} Ajouter · ${fmt(linePrice(p, v, willBeWholesale) * qty)}</button>`
          : +v.stock > 0 ? `<button class="btn btn-gold btn-block" data-go-cart>Voir mon panier</button>`
          : `<a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="${waLink(`Bonjour, « ${p.name} » (${v.label}) est épuisé sur le site. Pouvez-vous me prévenir dès son retour ?`)}">${icon("whatsapp", 18)} Me prévenir du retour en stock</a>`}
        </div>
        <p class="pp-ask">${icon("chat", 16)} Une question ? <a target="_blank" rel="noopener" href="${waLink(`Bonjour, j'ai une question sur « ${p.name} ».`)}">Demandez conseil sur WhatsApp</a></p>
      </div>`;
  }

  // ------------------------------------------------------------ panier
  const lineKey = (l) => `${l.id}|${l.vid}`;
  function addToCart(id, vid, n = 1) {
    const p = byId(id); if (!p) return;
    const v = variantOf(p, vid), a = availableV(p, v);
    if (a <= 0) { toast("Stock maximum atteint pour ce format.", "error"); return; }
    n = Math.min(n, a);
    const wasWholesale = wholesaleOn();
    const l = state.cart.find((x) => x.id === id && x.vid === v.id);
    l ? (l.qty += n) : state.cart.push({ id, vid: v.id, qty: n });
    saveCart(); renderAll();
    $("#cartBtn").classList.remove("bump"); void $("#cartBtn").offsetWidth; $("#cartBtn").classList.add("bump");
    toast(`${icon("check", 16)} « ${esc(p.name)} » (${esc(fmtShort(v))}) ajouté au panier`, "success");
    if (!wasWholesale && wholesaleOn()) setTimeout(() => toast(`${icon("sparkle", 16)} Tarif de gros appliqué à tout votre panier !`, "success"), 600);
  }
  function setQty(key, q) {
    const l = state.cart.find((x) => lineKey(x) === key); if (!l) return;
    const p = byId(l.id), v = p && variantOf(p, l.vid);
    l.qty = Math.max(0, Math.min(q, v ? +v.stock : 0));
    if (!l.qty) state.cart = state.cart.filter((x) => x !== l);
    saveCart(); renderAll();
  }
  // Retire du panier ce qui n'existe plus / ajuste au stock réel du format
  function reconcileCart() {
    let changed = false;
    state.cart = state.cart.filter((l) => {
      const p = byId(l.id);
      if (!p) { changed = true; return false; }
      const v = variantsOf(p).find((x) => x.id === l.vid);
      if (!v) { // ancien panier sans format : on prend le premier format
        if (l.vid) { changed = true; return false; }
        l.vid = variantsOf(p)[0].id; changed = true; return true;
      }
      if (+v.stock <= 0) { changed = true; return false; }
      if (l.qty > +v.stock) { l.qty = +v.stock; changed = true; }
      return true;
    });
    if (changed) saveCart();
    return changed;
  }
  const cartLines = () => state.cart.map((l) => { const p = byId(l.id); return p ? { ...l, p, v: variantOf(p, l.vid) } : null; }).filter(Boolean);
  const cartCount = () => state.cart.reduce((a, l) => a + l.qty, 0);
  const cartTotal = () => { const w = wholesaleOn(); return cartLines().reduce((a, l) => a + linePrice(l.p, l.v, w) * l.qty, 0); };
  const cartRetailTotal = () => cartLines().reduce((a, l) => a + +l.v.price * l.qty, 0);

  function lineHTML(l, editable = true) {
    const p = l.p, v = l.v, unit = linePrice(p, v, wholesaleOn()), key = lineKey(l);
    return `<div class="line">
      <div class="line-img">${productVisual(p)}</div>
      <div>
        <div class="line-name">${esc(p.name)}</div>
        <div class="line-sub">${esc(v.label)} · ${fmt(unit)}${unit < +v.price ? ` <s>${fmt(v.price)}</s>` : ""}${editable ? "" : ` × ${l.qty}`}</div>
        ${editable ? `<div class="qty qty-sm">
          <button data-cq="${esc(key)}" data-d="-1" aria-label="Moins">${icon("minus", 14)}</button>
          <output>${l.qty}</output>
          <button data-cq="${esc(key)}" data-d="1" ${l.qty >= +v.stock ? "disabled" : ""} aria-label="Plus">${icon("plus", 14)}</button>
        </div>` : ""}
      </div>
      <div class="line-right">
        <strong>${fmt(unit * l.qty)}</strong>
        ${editable ? `<button class="line-del" data-del="${esc(key)}" aria-label="Retirer">${icon("trash", 18)}</button>` : ""}
      </div>
    </div>`;
  }

  function grosBanner() {
    const min = wholesaleMin(), n = cartCount();
    if (!min) return "";
    const anyGros = cartLines().some((l) => +l.v.wholesale_price > 0);
    if (!anyGros) return "";
    if (n >= min) return `<div class="gros-banner on">${icon("sparkle", 18)}<span><b>Tarif de gros appliqué</b> (${n} articles)</span></div>`;
    return `<div class="gros-banner">${icon("box", 18)}<span>Plus que <b>${min - n} article${min - n > 1 ? "s" : ""}</b> pour profiter du <b>prix de gros</b> sur tout le panier</span><i style="--p:${Math.round((n / min) * 100)}%"></i></div>`;
  }

  function renderCart() {
    const n = cartCount();
    $("#cartCount").textContent = n;
    $("#cartCount").classList.toggle("on", n > 0);
    const lines = cartLines();
    if (!lines.length) {
      $("#cartBody").innerHTML = `<div class="cart-empty">${icon("bag", 46)}<h4>Votre panier est vide</h4><p>Laissez-vous tenter par nos fragrances.</p></div>`;
      $("#cartFoot").innerHTML = `<button class="btn btn-dark btn-block" data-close data-goto="#collection">Découvrir la collection</button>`;
      return;
    }
    $("#cartBody").innerHTML = grosBanner() + lines.map((l) => lineHTML(l)).join("");
    const saved = cartRetailTotal() - cartTotal();
    $("#cartFoot").innerHTML = `
      <div class="totals"><span>Sous-total (${n} article${n > 1 ? "s" : ""})</span><span>${fmt(cartTotal())}</span></div>
      ${saved > 0 ? `<div class="totals" style="color:var(--wine)"><span>Vous économisez</span><span>−${fmt(saved)}</span></div>` : ""}
      <div class="totals"><small>Livraison</small><small>confirmée par WhatsApp</small></div>
      <div class="totals grand"><span>Total</span><span>${fmt(cartTotal())}</span></div>
      <button class="btn btn-gold btn-block" id="toCheckout">Commander ${icon("arrow", 18)}</button>`;
  }

  // ------------------------------------------------------------ commande
  function renderCheckout() {
    const lines = cartLines();
    const saved = load("parfumerie_customer", {});
    $("#checkoutPanel").innerHTML = `
      <button class="icon-btn modal-close" data-close aria-label="Fermer">${icon("x", 22)}</button>
      <form class="co-form" id="coForm" novalidate>
        <h2>Finaliser ma commande</h2>
        <p>Pas besoin de compte. Nous vous contactons pour confirmer la livraison.</p>
        <div class="field"><label for="f-name">Nom complet *</label><input id="f-name" name="name" required autocomplete="name" value="${esc(saved.name || "")}" placeholder="Ex : Aïcha Koné"></div>
        <div class="field-row">
          <div class="field"><label for="f-phone">Téléphone (WhatsApp) *</label><input id="f-phone" name="phone" type="tel" inputmode="tel" required autocomplete="tel" value="${esc(saved.phone || "")}" placeholder="07 00 00 00 00"></div>
          <div class="field"><label for="f-city">Ville / commune *</label><input id="f-city" name="city" required value="${esc(saved.city || "")}" placeholder="Ex : Cocody, Bouaké…"></div>
        </div>
        <div class="field"><label for="f-address">Adresse ou point de repère</label><input id="f-address" name="address" value="${esc(saved.address || "")}" placeholder="Quartier, rue, repère…"></div>
        <div class="field"><label for="f-note">Message (facultatif)</label><textarea id="f-note" name="note" rows="2" placeholder="Emballage cadeau, horaire de livraison…"></textarea></div>
        <label style="font-size:13px;font-weight:600;display:block;margin:6px 0 8px">Mode de paiement</label>
        <div class="pay-options">
          <label class="pay-opt"><input type="radio" name="payment_method" value="livraison" checked>${icon("truck", 22)}<span>À la livraison<small>Espèces ou mobile money</small></span></label>
          ${CFG.wave.enabled && CFG.wave.link ? `<label class="pay-opt"><input type="radio" name="payment_method" value="wave">${icon("wave", 22)}<span>Wave<small>Lien de paiement après validation</small></span></label>` : ""}
        </div>
        <button class="btn btn-gold btn-block" type="submit" id="coSubmit">Valider la commande · ${fmt(cartTotal())}</button>
      </form>
      <aside class="co-summary">
        <h3>Récapitulatif</h3>
        ${grosBanner()}${lines.map((l) => lineHTML(l, false)).join("")}
        <div class="totals grand" style="margin-top:18px"><span>Total</span><span>${fmt(cartTotal())}</span></div>
        <div class="totals"><small>Livraison</small><small>confirmée par WhatsApp</small></div>
        <p class="co-note">${esc(CFG.deliveryInfo)}</p>
      </aside>`;
  }

  async function submitOrder(form) {
    const data = Object.fromEntries(new FormData(form));
    let ok = true;
    [["name", (v) => v.trim().length >= 2], ["phone", (v) => v.replace(/\D/g, "").length >= 8], ["city", (v) => v.trim().length >= 2]]
      .forEach(([k, test]) => { const f = form.elements[k].closest(".field"); const bad = !test(data[k] || ""); f.classList.toggle("invalid", bad); if (bad) ok = false; });
    if (!ok) { toast("Merci de compléter les champs obligatoires.", "error"); return; }

    const btn = $("#coSubmit"); btn.disabled = true; btn.textContent = "Envoi en cours…";
    try {
      const items = state.cart.map((l) => ({ id: l.id, vid: l.vid, qty: l.qty }));
      const res = await Store.placeOrder(data, items);
      localStorage.setItem("parfumerie_customer", JSON.stringify({ name: data.name, phone: data.phone, city: data.city, address: data.address }));
      notifyPush(res, data);
      state.cart = []; saveCart();
      await refreshProducts();
      showSuccess(res, data);
    } catch (e) {
      toast(Store.humanError(e), "error");
      btn.disabled = false; btn.textContent = `Valider la commande · ${fmt(cartTotal())}`;
      await refreshProducts();
      if (reconcileCart()) { renderAll(); renderCheckout(); toast("Votre panier a été ajusté au stock disponible.", "error"); }
    }
  }

  function orderMessage(res, c) {
    const lines = res.items.map((l) => `• ${l.qty} × ${l.name}${l.variant ? " (" + l.variant + ")" : ""} — ${fmt(l.price * l.qty)}`).join("\n");
    return `Bonjour ${CFG.brand.name} ! Je viens de passer la commande *${res.code}* sur le site.\n\n${lines}\n\n*Total : ${fmt(res.total)}*${res.wholesale ? " (tarif de gros)" : ""}\nPaiement : ${c.payment_method === "wave" ? "Wave" : "à la livraison"}\n\nNom : ${c.name}\nTél : ${c.phone}\nLieu : ${c.city}${c.address ? ", " + c.address : ""}${c.note ? "\nNote : " + c.note : ""}`;
  }

  function showSuccess(res, c) {
    const wave = c.payment_method === "wave" && CFG.wave.link;
    $("#checkoutPanel").innerHTML = `
      <button class="icon-btn modal-close" data-close aria-label="Fermer">${icon("x", 22)}</button>
      <div class="success">
        <div class="success-check">${icon("check", 40)}</div>
        <h2>Merci ${esc(c.name.split(" ")[0])} !</h2>
        <div class="code">${esc(res.code)}</div>
        <p>Votre commande de <strong>${fmt(res.total)}</strong> est bien enregistrée. Nous vous contactons très vite au <strong>${esc(c.phone)}</strong> pour confirmer la livraison.</p>
        <div class="success-actions">
          ${wave ? `<a class="btn btn-wave" href="${esc(CFG.wave.link)}" target="_blank" rel="noopener">${icon("wave", 18)} Payer ${fmt(res.total)} avec Wave</a>` : ""}
          <a class="btn btn-wa" href="${waLink(orderMessage(res, c))}" target="_blank" rel="noopener">${icon("whatsapp", 18)} Envoyer ma commande sur WhatsApp</a>
          <button class="btn btn-outline" data-close>Continuer mes achats</button>
        </div>
      </div>`;
  }

  // Notification push gratuite (application ntfy) — sans données personnelles
  function notifyPush(res, c) {
    if (!CFG.ntfyTopic) return;
    const n = res.items.reduce((a, l) => a + l.qty, 0);
    fetch("https://ntfy.sh/" + encodeURIComponent(CFG.ntfyTopic), {
      method: "POST",
      body: `${n} article${n > 1 ? "s" : ""} · ${fmt(res.total)} · ${c.city}`,
      headers: { Title: `Nouvelle commande ${res.code}`, Tags: "shopping_bags", Priority: "high" },
    }).catch(() => {});
  }

  // ------------------------------------------------------------ client de la semaine
  async function renderBest() {
    if (!CFG.showBestCustomers) return;
    try {
      let list = await Store.getBestCustomers(0, 3), last = false;
      if (!list.length) { list = await Store.getBestCustomers(1, 1); last = true; }
      if (!list.length) {
        $("#podium").innerHTML = `<div class="pod-empty">${icon("crown", 40)}<h3>La semaine commence !</h3><p>Le podium est encore libre. Passez commande pour devenir notre client(e) de la semaine.</p></div>`;
        return;
      }
      if (last) {
        const w = list[0];
        $("#podium").innerHTML = `<div class="pod-empty">${icon("crown", 40)}<h3>Bravo ${esc(w.display_name)} !</h3><p>Client(e) de la semaine dernière${w.city ? " · " + esc(w.city) : ""}. Le podium de cette semaine est encore libre…</p></div>`;
        return;
      }
      const order = [list[1], list[0], list[2]];
      $("#podium").innerHTML = order.map((c, i) => {
        if (!c) return `<div></div>`;
        const rank = [2, 1, 3][i];
        return `<div class="pod pod-${rank} reveal in">
          <div class="pod-avatar">${rank === 1 ? `<span class="pod-crown">${icon("crown", 28)}</span>` : ""}${esc(c.display_name.charAt(0))}</div>
          <div class="pod-name">${esc(c.display_name)}</div>
          <div class="pod-meta">${c.orders_count} commande${c.orders_count > 1 ? "s" : ""}${c.city ? " · " + esc(c.city) : ""}</div>
          <div class="pod-step">${rank}</div>
        </div>`;
      }).join("");
    } catch (e) { console.warn(e); }
  }

  // ------------------------------------------------------------ couches (modales)
  function openLayer(sel) { $(sel).classList.add("open"); $(sel).setAttribute("aria-hidden", "false"); document.body.classList.add("locked"); }
  function closeLayer(sel) {
    $(sel).classList.remove("open"); $(sel).setAttribute("aria-hidden", "true");
    if (!$$(".modal.open, .drawer.open").length) document.body.classList.remove("locked");
    if (sel === "#productModal") { openId = null; if (location.hash.startsWith("#p=")) history.replaceState(null, "", location.pathname); }
  }

  // ------------------------------------------------------------ événements
  function bind() {
    document.addEventListener("click", (e) => {
      const t = e.target.closest("button, a, [data-open]"); if (!t) return;
      if (t.dataset.add) { e.stopPropagation(); addToCart(t.dataset.add, t.dataset.vid); return; }
      if (t.dataset.fmt) { selVid = t.dataset.fmt; qty = 1; renderProduct(); return; }
      if (t.dataset.fav) { toggleFav(t.dataset.fav); return; }
      if (t.dataset.openBtn) { openProduct(t.dataset.openBtn); return; }
      if (t.dataset.rail) { const r = $("#" + t.dataset.rail); r.scrollBy({ left: +t.dataset.dir * (r.clientWidth - 40), behavior: "smooth" }); return; }
      if (t.dataset.catLink) { state.filter = t.dataset.catLink; renderChips(); renderGrid(); }
      if (t.dataset.addQty) { addToCart(t.dataset.addQty, selVid, qty); closeLayer("#productModal"); openLayer("#cartDrawer"); return; }
      if (t.dataset.q) { qty += +t.dataset.q; renderProduct(); return; }
      if (t.dataset.img) { imgIdx = +t.dataset.img; renderProduct(); return; }
      if (t.dataset.cq) { const l = state.cart.find((x) => lineKey(x) === t.dataset.cq); if (l) setQty(t.dataset.cq, l.qty + +t.dataset.d); return; }
      if (t.dataset.del) { setQty(t.dataset.del, 0); return; }
      if (t.dataset.cat) {
        state.filter = t.dataset.cat; renderChips(); renderGrid();
        if (t.dataset.scroll) { $("#collection").scrollIntoView(); $("#nav").classList.remove("open"); }
        return;
      }
      if (t.dataset.slide) { goSlide(slideIdx + +t.dataset.slide); clearInterval(slideTimer); return; }
      if (t.dataset.dot) { goSlide(+t.dataset.dot); clearInterval(slideTimer); return; }
      if (t.hasAttribute("data-go-cart")) { closeLayer("#productModal"); openLayer("#cartDrawer"); return; }
      if (t.id === "toCheckout") { closeLayer("#cartDrawer"); renderCheckout(); openLayer("#checkoutModal"); return; }
      if (t.hasAttribute("data-close")) {
        const layer = t.closest(".modal, .drawer"); if (layer) closeLayer("#" + layer.id);
        if (t.dataset.goto) $(t.dataset.goto).scrollIntoView();
        return;
      }
      if (t.dataset.open && !e.target.closest("button")) { openProduct(t.dataset.open); return; }
    });
    $$(".modal-backdrop").forEach((b) => b.addEventListener("click", () => closeLayer("#" + b.parentElement.id)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") $$(".modal.open, .drawer.open").forEach((m) => closeLayer("#" + m.id)); });
    document.addEventListener("submit", (e) => { if (e.target.id === "coForm") { e.preventDefault(); submitOrder(e.target); } });

    $("#cartBtn").addEventListener("click", () => openLayer("#cartDrawer"));
    $$(".rail").forEach((r) => r.addEventListener("scroll", () => updateRailBtns(r), { passive: true }));
    $$(".rail-btn.prev").forEach((b) => (b.innerHTML = icon("chevronL", 22)));
    $$(".rail-btn.next").forEach((b) => (b.innerHTML = icon("chevronR", 22)));
    window.addEventListener("resize", () => $$(".rail").forEach(updateRailBtns));
    let st; $("#searchInput").addEventListener("input", (e) => { clearTimeout(st); st = setTimeout(() => { state.query = e.target.value; renderGrid(); }, 150); });
    $("#searchForm").addEventListener("submit", (e) => { e.preventDefault(); state.query = $("#searchInput").value; renderGrid(); $("#collection").scrollIntoView(); });
    $("#sortSelect").addEventListener("change", (e) => { state.sort = e.target.value; renderGrid(); });
    $("#burger").addEventListener("click", () => { $("#nav").classList.toggle("open"); $("#burger").classList.toggle("open"); });
    $("#nav").addEventListener("click", (e) => { if (e.target.closest("a")) { $("#nav").classList.remove("open"); $("#burger").classList.remove("open"); } });
    window.addEventListener("scroll", () => $("#header").classList.toggle("scrolled", scrollY > 10), { passive: true });

    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: .15 });
    $$(".reveal").forEach((el) => io.observe(el));
  }

  // ------------------------------------------------------------ données
  async function refreshProducts() {
    const [products, settings] = await Promise.all([Store.getProducts(), Store.getSettings().catch(() => null)]);
    state.products = products;
    if (settings) state.settings = settings;
    reconcileCart();
    renderAll();
  }

  async function init() {
    initBrand();
    bind();
    $("#grid").innerHTML = Array.from({ length: 8 }, () => `<div class="skeleton"></div>`).join("");
    try {
      await refreshProducts();
    } catch (e) {
      $("#grid").innerHTML = ""; $("#emptyGrid").hidden = false;
      $("#emptyGrid").textContent = "Impossible de charger les produits. Vérifiez votre connexion puis rechargez la page.";
      console.error(e);
    }
    renderBest();
    // Stock en temps réel : si quelqu'un achète, tous les visiteurs voient le stock baisser
    let rt; Store.onProductsChange(() => { clearTimeout(rt); rt = setTimeout(refreshProducts, 300); });
    const m = location.hash.match(/^#p=(.+)$/); if (m && byId(m[1])) openProduct(m[1]);
    if (Store.mode === "demo") console.info("%cMode démo — données stockées dans ce navigateur. Renseignez Supabase dans config.js pour passer en ligne.", "color:#a8844c");
  }
  init();
})();
