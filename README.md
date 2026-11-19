# 🟠 NEXUS — Hub personnel

Une appli de bureau (Windows / macOS / Linux) qui regroupe :

- 🚀 **Hub d'apps** (en premier dans le menu) — tes **jeux** 🎮, **applis** 💻 et **liens** 🔗 avec leurs **vraies icônes** (favicon du site, ou icône extraite du `.exe`), accès direct à **Vibe** inclus
- 📅 **Emploi du temps** — vue semaine cliquable + **import de fichiers `.ics`** (glisser-déposer l'edt de l'école)
- ⏰ **Rappels** — notifications natives Windows à l'heure dite (+ sonnerie)
- 📁 **Fichiers** — glisse-dépose des fichiers n'importe où dans l'app : ils vont dans `Documents\NEXUS`, dossier partagé auquel Vibe a aussi accès
- 💼 **Portfolio** — ton portfolio **pro** (URL) et ton portfolio **perso** (cartes alimentées via `portfolio.json`)

Navigation par **page déroulante** (bouton ☰ en haut à gauche, hub en 01). **4 thèmes** au choix dans le menu : Clair·Orange (principal, avec chrome noir/gris), Graphite (sombre), Néon, Glacier.

Design **« liquid glass » façon Apple** : verre translucide à fort flou, reflet spéculaire qui suit la souris, bord lumineux, ombres douces, goutte-logo animée. Polices **Outfit** (titres, grosses tailles affirmées) + **Inter** (texte). Listes déroulantes 100 % thémées (plus de popups natifs blancs).

**Mode auto-masqué** (menu → Affichage) : la fenêtre recouvre tout l'écran (barre des tâches Windows cachée derrière, `alwaysOnTop`) et se **réduit en fine bande en haut** quand la souris s'en va ; elle **réapparaît quand la souris touche le bord supérieur** de l'écran.

## Installation sur ton PC (Windows)

1. **Prérequis** : installer [Node.js](https://nodejs.org) (version LTS, coche « Add to PATH »).
2. Récupère le code sur ton PC — le dépôt contient directement l'appli à sa racine :

   ```bat
   git clone https://github.com/mikaJ7169/Nexus.git
   cd Nexus
   ```

   (ou bouton « Code → Download ZIP » sur la page GitHub du dépôt, puis extraire)

3. Ouvre un terminal dans le dossier `Nexus` (clic droit → « Ouvrir dans le terminal ») et tape :

   ```bat
   npm install
   npm start
   ```

4. Pour avoir un **vrai exécutable / installeur** (fichier `.exe` à double-cliquer) :

   ```bat
   npm run dist
   ```

   L'installeur se trouve ensuite dans le dossier `dist\` (NEXUS Setup *.exe). Double-clique dessus, puis épingle NEXUS à la barre des tâches / au menu Démarrer.

## macOS / Linux

```bash
npm install
npm start        # lancer
npm run dist     # installateur : .dmg (macOS) ou .AppImage (Linux)
```

## Utilisation

Navigation : bouton **☰ MENU** (haut à gauche) → grande page déroulante, **Hub d'apps en 01**. Thèmes, affichage auto-masqué et raccourci Vibe dans le panneau de droite du menu.

- **Emploi du temps** : boutons ‹ › pour changer de semaine, « Aujourd'hui » pour revenir. Clique sur une case vide → formulaire (titre, jour, horaires, couleur). Clique sur un événement → modifier / supprimer. **Import .ics** : bouton « 📥 Importer .ics » ou glisse directement le fichier `.ics` de ton école n'importe où dans la fenêtre (les cours récurrents RRULE sont dépliés automatiquement, les doublons sont ignorés).
- **Rappels** : titre + date + heure + sonnerie. À l'heure dite : notification Windows + bip + toast dans l'app. Coche pour terminer, « ↻ 10 min » pour reporter.
- **Hub d'apps** : filtres par catégorie (🎮 Jeux / 💻 Apps / 🔗 Liens). Clique une tuile pour lancer. « ＋ Ajouter » → nom, **catégorie**, type (Application du PC / Lien web / Lien système), cible : une commande (`steam`, `code`, `notepad`…) ou un chemin complet vers un `.exe` (bouton « Parcourir… »), et un emoji. ✏️ / 🗑 au survol pour modifier / supprimer. La tuile **🟠 Vibe · Mistral** ouvre Vibe directement.
- **Fichiers** : glisse-dépose n'importe quel fichier dans la fenêtre (ou « ＋ Ajouter… ») → copié dans `Documents\NEXUS`. Boutons par fichier : ouvrir ▶, voir dans l'explorateur 📂, supprimer 🗑. « Ouvrir le dossier ↗ » ouvre `Documents\NEXUS` dans l'explorateur — c'est ce dossier partagé que Vibe peut aussi lire/écrire.
- **Portfolio** : colle l'URL de ton **portfolio pro** (Enregistrer → Ouvrir ↗). Le **portfolio perso** affiche les projets de `portfolio.json` (titre, description, technos, lien, date, emoji) — Vibe met ce fichier à jour avec tes projets persos, tu n'as qu'à re-télécharger le dépôt.

## Données

Emploi du temps, rappels, hub et réglages sont stockés localement dans ton profil (dossier *User Data* d'Electron, ex. `%APPDATA%\nexus-hub`) : rien n'est envoyé sur Internet. Les **fichiers déposés** vont dans `Documents\NEXUS`. Les polices (Outfit, Inter) se chargent depuis Google Fonts si tu es connecté, sinon des polices système prennent le relais.

## Structure du projet

```
Nexus/
├── package.json          # scripts + config electron-builder (installeur)
├── portfolio.json        # données du portfolio perso (alimenté par Vibe)
├── main.js               # processus principal : fenêtre, notifications, lancement d'apps, dossier fichiers
├── preload.js            # pont sécurisé renderer ↔ main
├── renderer/
│   ├── index.html        # coquille (6 vues + page déroulante + barre de titre)
│   ├── style.css         # 4 thèmes + vrai liquid glass (variables CSS)
│   ├── theme.js          # applique le thème avant le 1er rendu
│   ├── ics.js            # parseur .ics (VEVENT, RRULE…)
│   └── app.js            # logique : menu, thèmes, emploi du temps, rappels, hub, fichiers, portfolio
├── assets/icon.png       # icône de l'app (goutte orange)
└── scripts/make-icon.js  # régénère l'icône (node scripts/make-icon.js)
```

Astuce : ouvre `renderer/index.html` dans un navigateur pour un aperçu en « mode navigateur » (applis locales, fichiers, notifications et import .ics nécessitent la version installée).
