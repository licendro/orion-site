// Promotions affichées sur le site (bandeau prix barré + pourcentage).
// En attendant l'espace admin, elles se règlent ici.
//
// IMPORTANT : le prix réellement payé est calculé par Tebex. Pour chaque promo,
// crée le coupon identique dans Tebex (Webstore > Coupons) et mets son code dans "coupon" :
// le site l'applique alors automatiquement au panier, et le bandeau ne ment jamais.
//
// Exemple :
// {
//   name: 'Black Friday',
//   type: 'percent',            // 'percent' ou 'fixed' (montant en euros)
//   value: 20,
//   scope: 'all',               // 'all' ou une liste de noms : ['orn_bank', 'orn_shop']
//   starts: '2026-11-24T00:00:00+01:00',
//   ends: '2026-11-30T23:59:00+01:00',
//   banner: 'Black Friday',
//   coupon: 'BLACKFRIDAY',      // code du coupon Tebex équivalent
// },

export const PROMOTIONS = [];
