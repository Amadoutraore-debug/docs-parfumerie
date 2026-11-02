/* Utilitaires partagés boutique + admin */

// Navigation privée / stockage bloqué : on bascule sur une mémoire temporaire
// pour que la boutique fonctionne quand même (le panier ne sera juste pas gardé).
(function () {
  const memory = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
  };
  ["localStorage", "sessionStorage"].forEach((name) => {
    try { const s = window[name]; s.setItem("__t", "1"); s.removeItem("__t"); }
    catch (e) { try { Object.defineProperty(window, name, { value: memory(), configurable: true }); } catch (e2) {} }
  });
})();

(function () {
  const CFG = window.APP_CONFIG;

  const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0)).replace(/ | /g, " ") + " FCFA";

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---- Formats (variantes) : chaque produit a 1 ou plusieurs formats
  //      { id, label, volume_ml, price (détail), wholesale_price (gros), stock }
  const variantsOf = (p) => (Array.isArray(p.variants) && p.variants.length ? p.variants
    : [{ id: "std", label: p.volume_ml ? `${p.volume_ml} ml` : "Standard", volume_ml: p.volume_ml || null, price: +p.price || 0, wholesale_price: null, stock: +p.stock || 0 }]);
  const variantOf = (p, vid) => variantsOf(p).find((v) => v.id === vid) || variantsOf(p)[0];

  // ---- Promo en pourcentage (sur tous les formats du produit), arrondie à 50 FCFA
  const promoActive = (p) => +p.promo_pct > 0 && (!p.promo_until || new Date(p.promo_until) > new Date());
  const discount = (p) => (promoActive(p) ? +p.promo_pct : 0);
  const roundPrice = (n) => Math.round(n / 50) * 50;
  const retailPrice = (p, v) => (promoActive(p) ? roundPrice((+v.price * (100 - p.promo_pct)) / 100) : +v.price);
  // Prix appliqué : tarif de gros si le panier atteint le minimum (et si moins cher)
  const linePrice = (p, v, wholesale) => {
    const r = retailPrice(p, v);
    return wholesale && +v.wholesale_price > 0 ? Math.min(+v.wholesale_price, r) : r;
  };
  const totalStock = (p) => variantsOf(p).reduce((a, v) => a + (+v.stock || 0), 0);
  const fromPrice = (p) => Math.min(...variantsOf(p).map((v) => retailPrice(p, v)));
  const fromBase = (p) => Math.min(...variantsOf(p).map((v) => +v.price));
  const unitPrice = fromPrice;
  // Ajoute les champs calculés utilisés partout (stock total, prix « à partir de »)
  const normalize = (p) => Object.assign(p, { variants: variantsOf(p), stock: totalStock(p), price: fromBase(p) });

  // Couleur plus claire / plus sombre pour les dégradés
  function shade(hex, pct) {
    const h = (hex || "#b08d57").replace("#", "");
    const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const t = pct < 0 ? 0 : 255, f = Math.abs(pct) / 100;
    r = Math.round((t - r) * f + r); g = Math.round((t - g) * f + g); b = Math.round((t - b) * f + b);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Flacon illustré (utilisé quand le produit n'a pas encore de photo)
  let uid = 0;
  function bottleSVG(p, opts = {}) {
    const c = p.color || "#b08d57";
    const id = "b" + ++uid;
    const shapeIdx = [...String(p.name || "")].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 3;
    const initial = esc((p.name || "?").trim().charAt(0).toUpperCase());
    const bodies = [
      `<rect x="62" y="96" width="76" height="118" rx="10" fill="url(#${id}g)"/>`,
      `<path d="M100 92c34 0 46 30 46 64s-14 60-46 60-46-26-46-60 12-64 46-64z" fill="url(#${id}g)"/>`,
      `<path d="M74 92h52l10 122H64z" fill="url(#${id}g)"/>`,
    ];
    return `<svg viewBox="0 0 200 240" class="bottle-svg" role="img" aria-label="${esc(p.name)}" ${opts.style ? `style="${opts.style}"` : ""}>
      <defs>
        <linearGradient id="${id}g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${shade(c, 35)}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, -45)}"/>
        </linearGradient>
        <linearGradient id="${id}c" x1="0" x2="1"><stop offset="0" stop-color="#e9d9b6"/><stop offset=".5" stop-color="#b08d57"/><stop offset="1" stop-color="#6e5530"/></linearGradient>
        <radialGradient id="${id}s" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      </defs>
      <ellipse cx="100" cy="222" rx="62" ry="9" fill="url(#${id}s)"/>
      <rect x="86" y="70" width="28" height="26" rx="3" fill="url(#${id}c)"/>
      <rect x="80" y="40" width="40" height="32" rx="6" fill="#1b1714"/>
      <rect x="84" y="44" width="6" height="24" rx="3" fill="#fff" opacity=".18"/>
      ${bodies[shapeIdx]}
      <rect x="76" y="132" width="48" height="44" rx="3" fill="#fbf7f0" opacity=".92"/>
      <text x="100" y="160" text-anchor="middle" font-family="Raleway, sans-serif" font-size="20" font-weight="700" fill="#1b1714">${initial}</text>
      <rect x="70" y="104" width="7" height="90" rx="3.5" fill="#fff" opacity=".25"/>
    </svg>`;
  }

  function productVisual(p, cls = "") {
    if (p.image_url) return `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy" class="${cls}">`;
    return bottleSVG(p);
  }

  const ICONS = {
    bag: '<path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    whatsapp: '<path d="M20.5 3.5A11 11 0 0 0 3.4 17.1L2 22l5-1.3A11 11 0 0 0 20.5 3.5zM12 20a8.9 8.9 0 0 1-4.6-1.3l-.3-.2-3 .8.8-2.9-.2-.3A9 9 0 1 1 12 20zm4.9-6.7c-.3-.1-1.6-.8-1.8-.9-.3-.1-.4-.1-.6.1l-.8 1c-.2.2-.3.2-.6.1a7.3 7.3 0 0 1-3.6-3.2c-.3-.5.3-.4.8-1.4.1-.2 0-.3 0-.5l-.8-2c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3z" fill="currentColor" stroke="none"/>',
    crown: '<path d="m3 8 4 4 5-7 5 7 4-4-2 11H5L3 8z"/>',
    truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/>',
    wave: '<path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" opacity=".5"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>',
    tiktok: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.5 2.5 4.5 5 4.5"/>',
    facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
    tag: '<path d="M3 12V3h9l9 9-9 9-9-9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    logout: '<path d="M15 4h4v16h-4M10 17l-5-5 5-5M5 12h11"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z"/><path d="M10 21h4"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    heart: '<path d="M12 20s-7-4.4-9.2-9A5.2 5.2 0 0 1 12 5.6 5.2 5.2 0 0 1 21.2 11C19 15.6 12 20 12 20z"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 10v4M18 10v4"/>',
    flask: '<path d="M9 3h6M10 3v3H8.5A2.5 2.5 0 0 0 6 8.5V19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8.5A2.5 2.5 0 0 0 15.5 6H14V3"/><path d="M6 12h12"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    chevronL: '<path d="m15 6-6 6 6 6"/>',
    chevronR: '<path d="m9 6 6 6-6 6"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  };
  const icon = (name, size = 20) =>
    `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

  function toast(msg, type = "info") {
    let wrap = document.querySelector(".toasts");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toasts"; document.body.appendChild(wrap); }
    const t = document.createElement("div");
    t.className = "toast toast-" + type;
    t.innerHTML = msg;
    wrap.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 3600);
  }

  const waLink = (text, number = CFG.whatsapp) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

  const relTime = (d) => {
    const s = (Date.now() - new Date(d)) / 1000;
    if (s < 60) return "à l'instant";
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  window.U = { fmt, esc, promoActive, unitPrice, discount, variantsOf, variantOf, retailPrice, linePrice, totalStock, fromPrice, roundPrice, normalize, shade, bottleSVG, productVisual, icon, toast, waLink, relTime };
})();
