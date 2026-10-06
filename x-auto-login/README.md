# X — Connexion automatique pour Firefox

Extension Firefox 140 ou plus récent, sans dépendance ni compilation.

## Installation pour l’essayer

1. Décompressez `x-auto-login-firefox.zip`.
2. Dans Firefox, ouvrez `about:debugging#/runtime/this-firefox`.
3. Cliquez sur **Charger un module complémentaire temporaire**.
4. Sélectionnez `manifest.json` dans le dossier décompressé.
5. Autorisez l’accès aux sites si Firefox le demande. Rechargez les onglets déjà ouverts.

Vous pouvez aussi charger directement le ZIP avec ce bouton, sans décompression.

Cette installation est **temporaire** : Firefox retire l’extension au redémarrage. Le ZIP n’est pas signé ; l’ouvrir comme une extension installable normale ne suffit pas.

Pour la garder après un redémarrage sur Firefox standard, faites signer le paquet par Mozilla via [addons.mozilla.org](https://addons.mozilla.org/developers/) en choisissant la distribution personnelle / non répertoriée. Installez ensuite le fichier `.xpi` signé fourni par Mozilla. Le contenu du ZIP est prêt pour cette soumission. Aucun compte Mozilla ni aucune publication n’ont été utilisés pour créer ces fichiers.

Documentation : [installation temporaire](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/) · [signature et distribution](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).

## Préparer les identifiants enregistrés

Dans les paramètres de Firefox, activez le remplissage automatique des identifiants et mots de passe. Faites une première connexion manuelle et enregistrez les identifiants sur chacune de ces pages de connexion :

- `https://egide.polytechnique.fr/` : le service d’authentification commun à Moodle et SynapseS. Un mot de passe enregistré uniquement sous l’adresse Moodle ne sera pas nécessairement proposé ici.
- `https://webmail.polytechnique.fr/` : le formulaire Zimbra du webmail.

Les identifiants sont ceux que vous utilisez normalement sur chaque service ; l’extension ne les demande pas. Elle n’accède pas au coffre de mots de passe Firefox. Elle vérifie seulement que les deux champs du formulaire sont remplis, puis clique sur son bouton de connexion après une courte attente.

Si plusieurs comptes sont enregistrés, choisissez le compte dans la suggestion Firefox. Si un mot de passe principal ou une authentification système protège les identifiants, déverrouillez-les normalement. L’extension ne peut pas effectuer cette étape à votre place.

Documentation : [gestionnaire de mots de passe Firefox](https://support.mozilla.org/en-US/kb/password-manager-remember-delete-edit-logins).

## Utilisation

Les trois services sont activés par défaut.

- **Moodle** : ouvrez `https://moodle.ip-paris.fr/my/courses.php`. L’extension clique sur « Connexion » / « Log in », choisit « X - Ecole Polytechnique » et valide les identifiants remplis par Firefox sur Égide. Le retour à Moodle reste géré par le service d’authentification.
- **SynapseS** : ouvrez `https://synapses.polytechnique.fr/`. L’extension ouvre « Connexion », clique sur « Je me connecte » et valide le formulaire Égide rempli par Firefox.
- **Webmail** : ouvrez `https://webmail.polytechnique.fr/#1`. L’extension attend le remplissage des champs puis clique sur « Sign In ».

L’extension agit dans l’onglet visible. Les étapes intermédiaires de Shibboleth et les redirections restent gérées par les sites. Une page Égide ouverte seule ne déclenche pas de validation automatique : un parcours Moodle ou SynapseS doit avoir été lancé dans le même onglet par l’extension.

Cliquez sur l’icône de l’extension pour activer ou désactiver un service, consulter l’état, mettre l’onglet en pause ou **Réessayer**. Si elle n’apparaît pas, cherchez-la dans le bouton des extensions de Firefox.

## En cas de blocage

- **Les champs restent vides** : vérifiez que Firefox a enregistré les identifiants pour le domaine affiché et que le remplissage automatique est actif. Sélectionnez la suggestion de compte si nécessaire.
- **Vous corrigez les identifiants au clavier** : l’extension s’arrête afin de laisser terminer la saisie. Cliquez vous-même sur le bouton de connexion ou sur **Réessayer** après correction.
- **Erreur de connexion** : l’extension ne retente pas le mot de passe en boucle. Corrigez les identifiants, puis cliquez sur **Réessayer**.
- **Délai dépassé** : après deux minutes d’attente, utilisez **Réessayer** pour relancer l’attente.
- **Déconnexion volontaire** : le clic sur un lien de déconnexion met l’automatisation en pause dans cet onglet. Utilisez **Réessayer** pour la reprendre.
- **Accès refusé aux sites** : vérifiez les autorisations de l’extension dans `about:addons`.
- **Authentification supplémentaire** : effectuez manuellement la validation à deux facteurs ou toute autre étape requise par l’école.

Chaque étape et chaque soumission disposent d’une protection contre les répétitions pendant cinq minutes, conservée pendant la session Firefox. Le bouton **Réessayer** réinitialise cette protection pour l’onglet courant. Les préférences par service sont conservées localement.

## Confidentialité et périmètre

Aucun identifiant, mot de passe, contenu de cours ou message n’est conservé par l’extension ni envoyé à un service tiers. Aucun script externe, traceur, service distant ou permission de lecture du coffre de mots de passe n’est utilisé. La soumission conserve le formulaire d’origine du site, son bouton, ses champs de sécurité et ses validations.

L’extension demande uniquement l’autorisation `storage` et l’accès à quatre domaines HTTPS précis : Moodle IP Paris, SynapseS, le webmail et Égide. Sur Égide, son script est limité aux pages sous `/idp/`. Le stockage local contient les interrupteurs par service ; le stockage de session contient l’état de l’automatisation par onglet, les pauses et les délais de protection. Les champs de connexion ne quittent jamais le script qui observe le formulaire.

Les sélecteurs correspondent aux formulaires publics observés le 6 octobre 2026. Une modification des sites pourra nécessiter une mise à jour de `content.js`. Les connexions finales à votre compte personnel restent à vérifier lors de la première utilisation.

## Vérification réalisée

L’extension a été chargée dans Firefox 157 sous Linux avec un profil jetable et des identifiants fictifs. Les requêtes de ces tests ont toutes été interceptées par un serveur local reproduisant les formulaires ; aucune connexion à un compte de l’école n’a été effectuée.

Onze scénarios ont réussi : chargement de l’extension, parcours complet de chacun des trois services avec le remplissage natif de Firefox, ouverture isolée d’Égide, arrêt après erreur et retour au formulaire, formulaire vide puis rempli tardivement, arrêt lors d’une saisie manuelle, reprise avec **Réessayer** et attente de l’activation de l’onglet, refus d’un formulaire envoyant vers une autre origine, et désactivation d’un service.

## Fichiers

- `manifest.json` : périmètre et déclaration Firefox.
- `content.js` : parcours des sites et attente du remplissage des champs.
- `background.js` : préférences, suivi par onglet et protection contre les boucles.
- `popup.html`, `popup.js`, `popup.css` : commandes de l’extension.
- `icon.svg` : icône.

Après une modification, cliquez sur **Recharger** dans `about:debugging`, puis rechargez les pages concernées.
