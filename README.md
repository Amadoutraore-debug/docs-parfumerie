# Doc's Parfumerie (by CCK) : guide de mise en ligne

Le site marche **tout de suite en mode démo** : les données sont gardées dans le navigateur. C'est fait pour tester. Pour le vrai lancement, on branche **Supabase** (gratuit) et on héberge le site sur **Netlify** (gratuit). Il faut compter environ 20 minutes.

---

## Ce que fait le site

| Côté client | Côté gérante (`admin.html`) |
|---|---|
| Catalogue avec filtres, recherche et tri | Connexion sécurisée par e-mail et mot de passe |
| Stock affiché en direct (« Plus que 2 en stock ») | Ajout et modification de produits, photos par glisser-déposer |
| Le stock affiché baisse dès qu'on ajoute au panier | Stock modifiable avec + / − ou en tapant le chiffre |
| À la commande, le stock réel baisse automatiquement | Promo en 1 clic (% + durée) avec compte à rebours sur le site |
| Section « Promos » avec compte à rebours | Alerte sonore et notification à chaque nouvelle commande |
| Podium « Client(e) de la semaine » | Boutons WhatsApp et Appeler vers le client, message pré-rempli |
| Commande **sans créer de compte** | Statuts : Nouvelle → Confirmée → Livrée (ou Annulée) |
| Envoi de la commande sur WhatsApp en 1 clic | Si la commande est annulée, **le stock revient tout seul** |
| Bouton « Payer avec Wave » (dès qu'il est activé) | Liste des clients, total dépensé, client de la semaine |

**Sécurité** : le prix est recalculé par le serveur, donc personne ne peut modifier le prix depuis son navigateur. Deux clients ne peuvent pas acheter ensemble le dernier flacon : le serveur verrouille le produit pendant la commande. Les visiteurs ne voient jamais les commandes ni les numéros de téléphone des autres. Sur le podium, seuls « Prénom N. » et la ville apparaissent. Pour éviter la triche, seules les commandes **confirmées** ou **livrées** comptent pour le client de la semaine.

---

## Formats, prix de gros et promos

- Chaque parfum a plusieurs **formats** (essence, eau de parfum 30 ml, 50 ml). Chaque format a son prix au détail, son prix de gros et son propre stock.
- Le **prix de gros** s'applique automatiquement dès que le panier atteint un nombre d'articles, tous parfums confondus (10 au départ). Ce nombre se règle dans l'espace gérante, rubrique **Promos**. Le serveur recalcule ce prix lui-même : personne ne peut le forcer depuis son navigateur.
- Une **promo** s'exprime en %. Elle s'applique à tous les formats du parfum, arrondie à 50 FCFA.

## Étape 1 : personnaliser (`assets/js/config.js`)

Ouvrir `assets/js/config.js` et remplir :
- `brand.name` : le nom de la boutique
- `brand.logo` : mettre le logo dans `assets/img/` puis indiquer le chemin, par exemple `"assets/img/logo.png"`
- `whatsapp` : le numéro de la gérante, sans `+` ni espaces, par exemple `"2250707070707"`
- `socials` : les liens Instagram, TikTok et Facebook
- `bestCustomerReward` : la récompense du client de la semaine

## Étape 2 : créer la base de données Supabase (gratuit)

1. Créer un compte sur https://supabase.com, puis **New project** (région : *West EU* ou la plus proche).
2. Menu **SQL Editor**, puis **New query**. Coller **tout** le contenu de `supabase/schema.sql` et cliquer sur **Run**.
3. Toujours dans **SQL Editor**, nouvelle requête : coller le contenu de `supabase/produits.sql` et cliquer sur **Run**. Le catalogue est chargé : 7 parfums × 3 formats, 500 en stock par format.
4. Dans le même éditeur, ajouter l'e-mail de la gérante :
   ```sql
   insert into public.admins (email) values ('email-de-la-gerante@gmail.com');
   ```
5. Menu **Authentication**, puis **Users**, puis **Add user** : créer son compte avec le **même e-mail** et un mot de passe solide.
6. Menu **Authentication**, puis **Sign In / Providers** : **désactiver « Allow new users to sign up »**. Ainsi, personne d'autre ne pourra créer de compte.
7. Menu **Project Settings**, puis **API** : copier **Project URL** et la clé **anon public**, et les coller dans `config.js` :
   ```js
   supabase: { url: "https://xxxx.supabase.co", anonKey: "eyJhbGciOi..." },
   ```
   La clé *anon* est faite pour être publique. La sécurité passe par les règles du fichier `schema.sql`. Ne **jamais** mettre la clé `service_role` dans le site.

À partir de là, le site n'est plus en démo : il affiche le catalogue chargé à l'étape 3, et la gérante le gère depuis `admin.html`.

## Étape 3 : mettre en ligne (Netlify, gratuit)

1. Aller sur https://app.netlify.com/drop
2. Glisser-déposer **le dossier `parfumerie`** entier.
3. Le site est en ligne. Dans **Site configuration**, puis **Change site name**, on peut choisir par exemple `maison-elixir.netlify.app`.
4. Pour une mise à jour, glisser à nouveau le dossier dans **Deploys**.

Autres options gratuites : Vercel, Cloudflare Pages, GitHub Pages. Tous fonctionnent, car le site n'a besoin d'aucun serveur.

## Étape 4 : recevoir les commandes sur le téléphone

Il y a trois moyens, et on peut les combiner :
1. **WhatsApp** : après sa commande, le client a un gros bouton vert « Envoyer ma commande sur WhatsApp ». Le message est déjà rédigé et part vers le numéro de la gérante.
2. **Espace gérante ouvert** : alerte sonore, notification et vibration à chaque commande. Cliquer une fois sur « Activer les alertes ».
3. **Notification push même app fermée (gratuit)** : installer l'application **ntfy** (Play Store ou App Store), s'abonner à un nom secret, par exemple `elixir-cmd-8f3k2p9x`, puis écrire ce même nom dans `config.js` → `ntfyTopic`. Le message envoyé contient uniquement le code, le montant et la ville, jamais le nom ni le téléphone du client.

## Étape 5 (plus tard) : paiement Wave

Ouvrir un compte **Wave Business**, récupérer le lien de paiement marchand, puis dans `config.js` :
```js
wave: { enabled: true, link: "https://pay.wave.com/m/..." },
```
L'option « Payer avec Wave » apparaît alors au moment de la commande, avec le bouton de paiement juste après.

---

## Limites du plan gratuit Supabase

- 500 Mo de base de données : cela représente des dizaines de milliers de commandes.
- 1 Go de photos : les photos sont compressées automatiquement à environ 100–200 Ko, donc plusieurs milliers de photos.
- Le projet se met **en pause après 7 jours sans aucune visite**. Il suffit de le relancer depuis le tableau de bord Supabase. Avec une boutique active, ça n'arrive pas.

## Tester en local

```bash
python -m http.server 8660 --directory parfumerie
```
Ouvrir ensuite http://localhost:8660. L'espace gérante est sur http://localhost:8660/admin.html (mot de passe en démo : `demo1234`).
