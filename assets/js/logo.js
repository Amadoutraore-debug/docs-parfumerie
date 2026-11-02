/* =====================================================================
   LOGO DOC'S PARFUMERIE — version vectorielle redessinée
   (nette à toutes les tailles, dorée, sans fond)
   U.logoMark()  → l'emblème seul (flacon + DP)
   U.logoFull()  → emblème + « DOC'S PARFUMERIE » + « by CCK »
   ===================================================================== */
(function () {
  let n = 0;
  const defs = (id) => `
    <defs>
      <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff1b8"/><stop offset=".28" stop-color="#f2c94c"/>
        <stop offset=".62" stop-color="#d49a1e"/><stop offset="1" stop-color="#9a6410"/>
      </linearGradient>
      <linearGradient id="${id}l" x1="0" y1="1" x2=".6" y2="0">
        <stop offset="0" stop-color="#a96a0c"/><stop offset=".55" stop-color="#e3a92c"/><stop offset="1" stop-color="#ffe08a"/>
      </linearGradient>
    </defs>`;

  // Emblème : bouchon + col + anneau en « C » + flamme-feuille + monogramme DP
  function emblem(id) {
    const g = `url(#${id}g)`, l = `url(#${id}l)`;
    return `
      <rect x="86" y="4" width="28" height="30" rx="3" fill="${g}"/>
      <rect x="91" y="9" width="4" height="20" rx="2" fill="#fff" opacity=".35"/>
      <rect x="76" y="36" width="48" height="13" rx="2.5" fill="${g}"/>
      <path d="M150.5 82 A78 78 0 1 0 142 204" fill="none" stroke="${g}" stroke-width="9" stroke-linecap="round"/>
      <path d="M138 206 C 170 192 192 160 178 124 C 174 141 166 151 156 156 C 176 128 182 96 166 60 C 160 92 146 108 136 126 C 124 150 122 182 138 206 Z" fill="${l}"/>
      <path d="M142 196 C 150 170 152 140 162 112" fill="none" stroke="#7a4a08" stroke-width="2" opacity=".45" stroke-linecap="round"/>
      <text x="64" y="150" font-family="'Playfair Display', Georgia, serif" font-weight="900" font-size="74" fill="${g}">D</text>
      <text x="92" y="172" font-family="'Playfair Display', Georgia, serif" font-weight="900" font-size="74" fill="${g}" stroke="var(--logo-bg, #0b0907)" stroke-width="2.5" paint-order="stroke">P</text>
      <circle cx="84" cy="192" r="6" fill="${g}"/><circle cx="98" cy="186" r="4" fill="${g}"/>
      <circle cx="72" cy="182" r="3.5" fill="${g}"/><circle cx="96" cy="200" r="3" fill="${g}"/>
      <circle cx="186" cy="166" r="5" fill="${g}"/><circle cx="194" cy="152" r="3.5" fill="${g}"/>`;
  }

  function logoMark(cls = "") {
    const id = "lg" + ++n;
    return `<svg class="logo-svg ${cls}" viewBox="0 0 204 230" role="img" aria-label="Doc's Parfumerie">${defs(id)}${emblem(id)}</svg>`;
  }
  function logoFull(cls = "") {
    const id = "lg" + ++n;
    return `<svg class="logo-svg ${cls}" viewBox="-30 0 264 300" role="img" aria-label="Doc's Parfumerie by CCK">${defs(id)}${emblem(id)}
      <text x="102" y="258" text-anchor="middle" font-family="'Playfair Display', Georgia, serif" font-weight="800" font-size="21" letter-spacing="2" fill="url(#${id}g)">DOC'S PARFUMERIE</text>
      <text x="102" y="288" text-anchor="middle" font-family="'Playfair Display', Georgia, serif" font-style="italic" font-weight="600" font-size="22" fill="url(#${id}g)">by CCK</text></svg>`;
  }
  window.U = Object.assign(window.U || {}, { logoMark, logoFull });
})();
