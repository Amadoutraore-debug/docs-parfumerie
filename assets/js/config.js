/* =====================================================================
   CONFIGURATION DE LA BOUTIQUE — le seul fichier à modifier
   ===================================================================== */
window.APP_CONFIG = {
  brand: {
    name: "Doc's Parfumerie",              // ← nom de la boutique
    signature: "by CCK",
    tagline: "Marquez votre présence à moindre coût !",
    logo: "assets/img/logo-embleme.png",   // emblème (en-tête, cartes)
    logoFull: "assets/img/logo-complet.png", // logo complet (pied de page, connexion)
    city: "Bouaké",
    address: "Bouaké – Gonfreville",
  },

  // Numéro WhatsApp de la gérante, format international SANS + ni espaces
  whatsapp: "2250713752472",
  phoneDisplay: "+225 07 13 75 24 72",
  email: "",

  // Paiement Wave : coller ici le lien de paiement marchand Wave
  wave: {
    enabled: false,
    link: "",                               // ex : "https://pay.wave.com/m/M_xxxxx/c/ci/"
  },

  socials: {
    instagram: "https://www.instagram.com/doc.s_parfumerie/",
    tiktok: "https://www.tiktok.com/@doc_sparfumerie",
    facebook: "https://www.facebook.com/search/top?q=doc%27s%20parfumerie", // ← remplacer par le lien exact de la page
  },

  deliveryInfo: "Bouaké : livraison rapide · Autres villes de Côte d'Ivoire : expédition en 48 à 72 h. Les frais vous sont confirmés par WhatsApp.",

  // Récompense affichée dans la section « Client(e) de la semaine »
  bestCustomerReward: "Un échantillon de luxe offert à chaque commande de la semaine suivante.",
  showBestCustomers: true,

  categories: ["Homme", "Femme", "Mixte", "Coffrets"],

  // Prix de gros : appliqué automatiquement dès ce nombre d'articles dans le panier
  // (valeur de départ ; modifiable ensuite depuis l'espace gérante > Promos)
  wholesaleMinQty: 10,
  lowStockThreshold: 3,

  // Connexion Supabase (laisser vide = MODE DÉMO, données stockées dans le navigateur)
  supabase: {
    url: "",
    anonKey: "",
  },

  // Notification push gratuite sur le téléphone (application « ntfy »).
  // Choisir un nom secret et compliqué, ex : "elixir-cmd-8f3k2p9x"
  ntfyTopic: "",
};
