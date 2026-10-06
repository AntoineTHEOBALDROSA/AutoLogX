# X — Connexion automatique pour Firefox

Extension Firefox.

## Installation temporaire

1. Décompressez `x-auto-login-firefox.zip`.
2. Dans Firefox, ouvrez `about:debugging#/runtime/this-firefox`.
3. Cliquez sur **Charger un module complémentaire temporaire**.
4. Sélectionnez `manifest.json` dans le dossier décompressé.
5. Autorisez l’accès aux sites si Firefox le demande. Rechargez les onglets déjà ouverts.

Vous pouvez aussi charger directement le ZIP (sans décompression).

Cette installation est **temporaire** : Firefox retire l’extension au redémarrage.

## Préparer les identifiants enregistrés

Dans les paramètres de Firefox, activez le remplissage automatique des identifiants et mots de passe. Faites une première connexion manuelle et enregistrez les identifiants sur chacune de ces pages de connexion :

- `https://egide.polytechnique.fr/` : le service d’authentification commun à Moodle et SynapseS. Un mot de passe enregistré uniquement sous l’adresse Moodle ne fonctionnera pas nécessairement.
- `https://webmail.polytechnique.fr/` : Zimbra.

## Sites compatibles

Les trois services sont activés par défaut.

- **Moodle** : ouvrez `https://moodle.ip-paris.fr/my/courses.php`. L’extension clique sur « Connexion » / « Log in », choisit « X - Ecole Polytechnique » et valide les identifiants remplis par Firefox sur Égide. Le retour à Moodle reste géré par le service d’authentification.
- **SynapseS** : ouvrez `https://synapses.polytechnique.fr/`. L’extension ouvre « Connexion », clique sur « Je me connecte » et valide le formulaire Égide rempli par Firefox.
- **Webmail (Zimbra)** : ouvrez `https://webmail.polytechnique.fr/#1`. L’extension attend le remplissage des champs puis clique sur « Sign In ».

## Confidentialité

Aucun identifiant, mot de passe, contenu ou message n’est conservé par l’extension ni envoyé à un service tiers. Aucun script externe, traceur, service distant ou permission du gestionnaire de mots de passe n’est utilisé. 


## Fichiers

- `manifest.json` : périmètre et déclaration Firefox.
- `content.js` : parcours des sites et attente du remplissage des champs.
- `background.js` : préférences, suivi par onglet et protection contre les boucles.
- `popup.html`, `popup.js`, `popup.css` : commandes de l’extension.
- `icon.svg` : icône.
