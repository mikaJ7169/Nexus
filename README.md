# ◆ NEXUS — Hub personnel

Une appli de bureau (Windows / macOS / Linux) qui regroupe :

- 📅 **Emploi du temps** — vue semaine, clic sur une case pour poser un événement
- ⏰ **Rappels** — notifications natives Windows à l'heure dite (+ sonnerie)
- 🚀 **Hub d'apps** — lance tes applications du PC (commande ou chemin `.exe`) et tes sites favoris depuis des tuiles

Design sombre futuriste : verre dépoli, accents néon cyan/violet, particules animées, horloge en direct.

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

- **Emploi du temps** : boutons ‹ › pour changer de semaine, « Aujourd'hui » pour revenir. Clique sur une case vide → formulaire (titre, jour, horaires, couleur). Clique sur un événement → modifier / supprimer.
- **Rappels** : titre + date + heure + sonnerie. À l'heure dite : notification Windows + bip + toast dans l'app. Coche pour terminer, « ↻ 10 min » pour reporter.
- **Hub d'apps** : clique une tuile pour lancer. « ＋ Ajouter » → nom, type (Application du PC / Lien web / Lien système), cible : une commande (`code`, `notepad`, `explorer`…) ou un chemin complet vers un `.exe` (bouton « Parcourir… »), et un emoji. ✏️ / 🗑 au survol pour modifier / supprimer.

## Données

Tout est stocké localement dans ton profil (dossier *User Data* d'Electron, ex. `%APPDATA%\NEXUS`) : rien n'est envoyé sur Internet. Les polices (Orbitron, Space Grotesk) se chargent depuis Google Fonts si tu es connecté, sinon des polices système prennent le relais.

## Structure du projet

```
Nexus/
├── package.json          # scripts + config electron-builder (installeur)
├── main.js               # processus principal : fenêtre, notifications, lancement d'apps
├── preload.js            # pont sécurisé renderer ↔ main
├── renderer/
│   ├── index.html        # coquille (4 vues + barre de titre)
│   ├── style.css         # design néon / verre dépoli
│   └── app.js            # logique : emploi du temps, rappels, hub
├── assets/icon.png       # icône de l'app
└── scripts/make-icon.js  # régénère l'icône (node scripts/make-icon.js)
```

Astuce : ouvre `index.html` dans un navigateur pour un aperçu en « mode navigateur » (les applis locales et les notifications natives nécessitent la version installée).
