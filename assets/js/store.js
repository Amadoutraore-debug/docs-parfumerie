/* =====================================================================
   COUCHE DE DONNÉES
   - Mode LIVE  : Supabase (config.supabase rempli)
   - Mode DÉMO  : tout est stocké dans le navigateur (localStorage)
   Les deux modes exposent exactement les mêmes fonctions.
   ===================================================================== */
(function () {
  const CFG = window.APP_CONFIG;
  const live = !!(CFG.supabase && CFG.supabase.url && CFG.supabase.anonKey && window.supabase);

  // ------------------------------------------------------------------ DÉMO
  const DEMO_KEY = "parfumerie_demo_v2";
  const DEMO_PASSWORD = "demo1234";
  const rid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2));
  const daysFromNow = (d) => new Date(Date.now() + d * 86400000).toISOString();

  function seed() {
    const products = window.CATALOGUE.map((p, i) => {
      const { slug, ...rest } = p;
      return { ...JSON.parse(JSON.stringify(rest)), id: rid(), created_at: daysFromNow(-10 - i) };
    });
    // quelques commandes fictives pour voir le tableau de bord et le podium en démo
    const mkOrder = (name, phone, city, lines, status, minAgo) => {
      const items = lines.map(([i, vid, q]) => {
        const p = products[i], v = p.variants.find((x) => x.id === vid);
        return { id: p.id, vid, variant: v.label, name: p.name, qty: q, price: v.price, image_url: p.image_url, color: p.color };
      });
      return {
        id: Math.floor(Math.random() * 1e9), code: "CMD-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        customer_name: name, phone, city, address: "", note: "", payment_method: "livraison", wholesale: false,
        items, total: items.reduce((a, l) => a + l.price * l.qty, 0), status,
        created_at: new Date(Date.now() - minAgo * 60000).toISOString(),
      };
    };
    const orders = [
      mkOrder("Aïcha Koné", "0707070707", "Bouaké", [[1, "edp50", 1], [0, "edp30", 1]], "livree", 40),
      mkOrder("Yao Kouassi", "0505050505", "Gonfreville", [[6, "edp50", 1]], "confirmee", 25),
      mkOrder("Mariam Traoré", "0101010101", "Bouaké", [[3, "ess", 2]], "nouvelle", 3),
    ];
    return { products, orders, settings: { wholesale_min_qty: CFG.wholesaleMinQty || 10 } };
  }

  function demoDB() {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    const db = seed();
    localStorage.setItem(DEMO_KEY, JSON.stringify(db));
    return db;
  }
  const demoSave = (db) => { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); bus.dispatchEvent(new Event("change")); };
  const bus = new EventTarget();
  window.addEventListener("storage", (e) => { if (e.key === DEMO_KEY) bus.dispatchEvent(new Event("change")); });

  function weekStart(offset = 0) {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const day = (d.getDay() + 6) % 7; // lundi = 0
    d.setDate(d.getDate() - day - 7 * offset);
    return d;
  }
  function displayName(full) {
    const parts = String(full).trim().split(/\s+/);
    const first = parts[0] ? parts[0][0].toUpperCase() + parts[0].slice(1).toLowerCase() : "";
    return parts[1] ? `${first} ${parts[1][0].toUpperCase()}.` : first;
  }

  const demo = {
    mode: "demo",
    demoPassword: DEMO_PASSWORD,
    async getProducts({ all = false } = {}) {
      const db = demoDB();
      return db.products.filter((p) => all || p.active).map(U.normalize).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    async placeOrder(customer, items) {
      const db = demoDB();
      const phone = String(customer.phone || "").replace(/\D/g, "").slice(-10);
      if (!items.length) throw new Error("PANIER_VIDE");
      if (String(customer.name || "").trim().length < 2 || phone.length < 8) throw new Error("INFOS_MANQUANTES");
      const find = (it) => {
        const p = db.products.find((x) => x.id === it.id && x.active);
        const v = p && U.variantsOf(p).find((x) => x.id === it.vid);
        if (!p || !v) throw new Error("PRODUIT_INDISPONIBLE");
        return [p, v];
      };
      for (const it of items) {
        const [p, v] = find(it);
        if (v.stock < it.qty) throw new Error(`STOCK_INSUFFISANT:${p.name} (${v.label}):${v.stock}`);
      }
      const min = (db.settings || {}).wholesale_min_qty || 0;
      const wholesale = min > 0 && items.reduce((a, it) => a + it.qty, 0) >= min;
      let total = 0;
      const lines = items.map((it) => {
        const [p, v] = find(it);
        v.stock -= it.qty;
        const price = U.linePrice(p, v, wholesale);
        total += price * it.qty;
        return { id: p.id, vid: v.id, variant: v.label, name: p.name, qty: it.qty, price, image_url: p.image_url, color: p.color };
      });
      const order = {
        id: Date.now(), code: "CMD-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        customer_name: customer.name.trim(), phone, city: customer.city || "", address: customer.address || "",
        note: customer.note || "", payment_method: customer.payment_method === "wave" ? "wave" : "livraison",
        items: lines, total, wholesale, status: "nouvelle", created_at: new Date().toISOString(),
      };
      db.orders.unshift(order);
      demoSave(db);
      return { code: order.code, total, items: lines, wholesale };
    },
    async getBestCustomers(weekOffset = 0, limit = 3) {
      const db = demoDB();
      const start = weekStart(weekOffset), end = new Date(start.getTime() + 7 * 86400000);
      const map = {};
      db.orders
        .filter((o) => ["confirmee", "livree"].includes(o.status) && new Date(o.created_at) >= start && new Date(o.created_at) < end)
        .forEach((o) => {
          const m = (map[o.phone] ||= { display_name: displayName(o.customer_name), orders_count: 0, city: o.city, _sum: 0 });
          m.orders_count++; m._sum += o.total;
        });
      return Object.values(map).sort((a, b) => b._sum - a._sum || b.orders_count - a.orders_count).slice(0, limit);
    },
    onProductsChange(cb) { bus.addEventListener("change", cb); },

    // ---- admin
    async getSession() { return sessionStorage.getItem("demo_admin") ? { email: sessionStorage.getItem("demo_admin") } : null; },
    async signIn(email, password) {
      if (password !== DEMO_PASSWORD) throw new Error("Mot de passe incorrect (démo : " + DEMO_PASSWORD + ")");
      sessionStorage.setItem("demo_admin", email || "admin@demo");
      return { email };
    },
    async signOut() { sessionStorage.removeItem("demo_admin"); },
    async saveProduct(p) {
      const db = demoDB();
      p = clean(p);
      if (p.id) {
        const i = db.products.findIndex((x) => x.id === p.id);
        db.products[i] = { ...db.products[i], ...p };
      } else {
        p = { ...p, id: rid(), created_at: new Date().toISOString() };
        db.products.push(p);
      }
      demoSave(db);
      return p;
    },
    async deleteProduct(id) { const db = demoDB(); db.products = db.products.filter((p) => p.id !== id); demoSave(db); },
    async adjustStock(id, vid, delta) {
      const db = demoDB(); const v = db.products.find((x) => x.id === id).variants.find((x) => x.id === vid);
      v.stock = Math.max(0, v.stock + delta); demoSave(db); return v.stock;
    },
    async getSettings() { return demoDB().settings || { wholesale_min_qty: CFG.wholesaleMinQty || 10 }; },
    async saveSettings(st) { const db = demoDB(); db.settings = { ...db.settings, ...st }; demoSave(db); },
    async uploadImage(file) { return await compressImage(file, 900, "dataurl"); },
    async getOrders() { return demoDB().orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); },
    async updateOrderStatus(id, status) {
      const db = demoDB(); const o = db.orders.find((x) => x.id === id);
      const sign = status === "annulee" && o.status !== "annulee" ? 1 : o.status === "annulee" && status !== "annulee" ? -1 : 0;
      if (sign) o.items.forEach((l) => {
        const p = db.products.find((x) => x.id === l.id); const v = p && (p.variants || []).find((x) => x.id === l.vid);
        if (v) v.stock = Math.max(0, v.stock + sign * l.qty);
      });
      o.status = status; demoSave(db);
    },
    async deleteOrder(id) { const db = demoDB(); db.orders = db.orders.filter((o) => o.id !== id); demoSave(db); },
    onNewOrder(cb) {
      let known = new Set(demoDB().orders.map((o) => o.id));
      bus.addEventListener("change", () => {
        demoDB().orders.forEach((o) => { if (!known.has(o.id)) { known.add(o.id); cb(o); } });
      });
    },
    resetDemo() { localStorage.removeItem(DEMO_KEY); demoSave(demoDB()); },
  };

  // ------------------------------------------------------------------ LIVE
  let sb = null;
  if (live) sb = window.supabase.createClient(CFG.supabase.url, CFG.supabase.anonKey);
  const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

  const supa = {
    mode: "live",
    async getProducts({ all = false } = {}) {
      let q = sb.from("products").select("*").order("created_at", { ascending: false });
      if (!all) q = q.eq("active", true);
      return check(await q).map(U.normalize);
    },
    async placeOrder(customer, items) {
      return check(await sb.rpc("place_order", { p_customer: customer, p_items: items.map((i) => ({ id: i.id, vid: i.vid, qty: i.qty })) }));
    },
    async getBestCustomers(weekOffset = 0, limit = 3) {
      return check(await sb.rpc("best_customers", { p_week_offset: weekOffset, p_limit: limit })) || [];
    },
    onProductsChange(cb) {
      sb.channel("products-live").on("postgres_changes", { event: "*", schema: "public", table: "products" }, cb).subscribe();
    },
    async getSession() { const { data } = await sb.auth.getSession(); return data.session ? { email: data.session.user.email } : null; },
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error("E-mail ou mot de passe incorrect.");
      const ok = check(await sb.rpc("is_admin"));
      if (!ok) { await sb.auth.signOut(); throw new Error("Ce compte n'est pas autorisé à gérer la boutique."); }
      return { email: data.user.email };
    },
    async signOut() { await sb.auth.signOut(); },
    async saveProduct(p) {
      const row = clean(p); delete row.created_at;
      if (!row.id) delete row.id;
      return check(await sb.from("products").upsert(row).select().single());
    },
    async deleteProduct(id) { check(await sb.from("products").delete().eq("id", id)); },
    async adjustStock(id, vid, delta) { return check(await sb.rpc("admin_adjust_stock", { p_id: id, p_vid: vid, p_delta: delta })); },
    async getSettings() { return check(await sb.from("shop_settings").select("*").eq("id", 1).single()); },
    async saveSettings(st) { check(await sb.from("shop_settings").update(st).eq("id", 1)); },
    async uploadImage(file) {
      const blob = await compressImage(file, 1200, "blob");
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
      check(await sb.storage.from("produits").upload(path, blob, { contentType: "image/webp", upsert: false }));
      return sb.storage.from("produits").getPublicUrl(path).data.publicUrl;
    },
    async getOrders() { return check(await sb.from("orders").select("*").order("created_at", { ascending: false }).limit(500)); },
    async updateOrderStatus(id, status) { check(await sb.from("orders").update({ status }).eq("id", id)); },
    async deleteOrder(id) { check(await sb.from("orders").delete().eq("id", id)); },
    onNewOrder(cb) {
      sb.channel("orders-live").on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => cb(payload.new)).subscribe();
    },
  };

  // Retire les champs calculés côté navigateur avant enregistrement
  function clean(p) {
    const row = { ...p };
    delete row.stock; delete row.price; delete row.promo_price;
    return row;
  }

  // Redimensionne / compresse les photos avant envoi (économise le stockage gratuit)
  function compressImage(file, max, out) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const r = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        if (out === "dataurl") resolve(c.toDataURL("image/webp", 0.82));
        else c.toBlob((b) => (b ? resolve(b) : reject(new Error("Image illisible"))), "image/webp", 0.85);
      };
      img.onerror = () => reject(new Error("Format d'image non supporté"));
      img.src = URL.createObjectURL(file);
    });
  }

  // Traduit les erreurs serveur en messages clairs
  function humanError(e) {
    const m = String(e && e.message || e);
    if (m.includes("STOCK_INSUFFISANT")) {
      const [, name, left] = m.match(/STOCK_INSUFFISANT:([^:]+):(\d+)/) || [];
      return name ? `Désolé, il ne reste que ${left} « ${name} » en stock.` : "Stock insuffisant pour un des articles.";
    }
    if (m.includes("PRODUIT_INDISPONIBLE")) return "Un des articles n'est plus disponible.";
    if (m.includes("INFOS_MANQUANTES")) return "Merci d'indiquer votre nom et un numéro de téléphone valide.";
    if (m.includes("PANIER_VIDE")) return "Votre panier est vide.";
    if (m.includes("Failed to fetch")) return "Connexion impossible. Vérifiez votre internet et réessayez.";
    return m;
  }

  window.Store = Object.assign(live ? supa : demo, { humanError });
})();
