/* =====================================================================
   CATALOGUE DE DÉPART — Doc's Parfumerie by CCK
   Utilisé par le mode démo (et repris dans supabase/produits.sql).
   ===================================================================== */
window.CATALOGUE = (function () {
  // Les 3 formats vendus pour chaque parfum : prix détail / prix de gros
  const FORMATS = () => [
    { id: "ess", label: "Essence de parfum", volume_ml: null, price: 1000, wholesale_price: 800, stock: 500 },
    { id: "edp30", label: "Eau de parfum 30 ml", volume_ml: 30, price: 3500, wholesale_price: 3000, stock: 500 },
    { id: "edp50", label: "Eau de parfum 50 ml", volume_ml: 50, price: 5000, wholesale_price: 4500, stock: 500 },
  ];
  const DESC = "Eau de parfum et essence de parfum conçues par Doc's Parfumerie CCK by Suzy 🇨🇮.";
  const P = (slug, name, category, color) => ({
    slug, name, category, color, brand: "", description: DESC,
    notes_top: "", notes_heart: "", notes_base: "",
    variants: FORMATS(), promo_pct: null, promo_until: null,
    image_url: `assets/img/produits/${slug}.jpg`, gallery: [], featured: true, active: true,
  });
  return [
    P("tobacco-vanille", "Tobacco Vanille", "Mixte", "#7a4a22"),
    P("sucre-rose", "Sucre Rose", "Femme", "#c9677a"),
    P("pi-givenchy", "Pi Givenchy", "Homme", "#1f5fbf"),
    P("terre-d-hermes", "Terre d'Hermès", "Homme", "#8a6a3a"),
    P("allure-sport", "Allure Sport", "Homme", "#9a8f80"),
    P("elixir-one-million", "Elixir One Million", "Homme", "#2346a8"),
    P("diesel", "Diesel", "Homme", "#6b2a7a"),
  ];
})();
