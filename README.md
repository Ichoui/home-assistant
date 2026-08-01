# SmallTV Weather

Affichage météo personnel 240×240 pour un SmallTV Ultra à Saint-Georges, Québec.

Le projet utilise Firebase Functions v2 et Firestore. Les conditions courantes et les prévisions viennent d'Open-Meteo; les alertes proviennent exclusivement de l'API officielle MétéoCAN d'Environnement et Changement climatique Canada.

## Fonctions Firebase

- `refreshWeather` récupère les données météo toutes les 15 minutes et écrit l'état normalisé dans `weather/home`.
- `getWeather` retourne le document `WeatherState` en JSON.
- `getHomeAssistantWeather` retourne une version JSON adaptée à une intégration météo Home Assistant, protégée par un Bearer token.
- `getSmallTvImage` génère une image PNG 240×240 depuis le dernier état enregistré.

Le rendu utilise des Material Symbols SVG embarqués dans le projet. Les codes météo WMO sont associés aux icônes soleil, éclaircies jour/nuit, nuages, brouillard, pluie, pluie verglaçante, neige, orage et grêle. Les silhouettes sont peintes en couches avec des couleurs sémantiques et restent lisibles dans les petits repères horaires. Aucun appel à Google Fonts n'est effectué pendant la génération de l'image.

L'image présente les 24 prochaines heures sous forme de courbe de température avec six repères horaires, les conditions météo, les probabilités de précipitation significatives et les minimum/maximum directement positionnés sur la courbe. La palette et les panneaux translucides s'adaptent aux conditions actuelles.

Les horaires quotidiens de lever et coucher du soleil proviennent des champs `sunrise` et `sunset` d'Open-Meteo et sont affichés dans la partie supérieure du PNG.

La météo affichée utilise explicitement le modèle Open-Meteo `best_match`.

## Prérequis

- Node.js 22
- npm
- Firebase CLI
- `curl` pour les commandes de test manuel

Installer la Firebase CLI si elle n'est pas déjà disponible :

```bash
npm install --global firebase-tools
```

## Installation

Depuis la racine du projet :

```bash
npm install
```

## Lancement local

Lancer les émulateurs Functions et Firestore :

```bash
npm run dev
```

Cette commande compile le TypeScript, utilise le projet Firebase local `demo-smalltv-weather`, puis démarre :

- Functions : `http://127.0.0.1:5001`
- Firestore : `http://127.0.0.1:8080`
- Emulator UI : l'adresse affichée par la Firebase CLI, généralement `http://127.0.0.1:4000`

Le projet local `demo-smalltv-weather` ne nécessite pas de vrai projet Firebase ni de connexion à un compte Google.

## Test manuel

Garder `npm run dev` actif dans un premier terminal. Dans un deuxième terminal, commencer par alimenter Firestore :

```bash
npm run refresh
```

Cette commande déclenche manuellement `refreshWeather`. Elle appelle les API Open-Meteo et MétéoCAN, puis écrit le résultat dans l'émulateur Firestore.

Lire ensuite l'état météo normalisé :

```bash
npm run weather
```

Télécharger l'image SmallTV :

```bash
npm run image
```

Le PNG est enregistré dans :

```text
/tmp/smalltv-weather.png
```

Sur macOS, l'ouvrir avec :

```bash
open /tmp/smalltv-weather.png
```

Les routes `getWeather` et `getSmallTvImage` retournent une erreur `503` tant que `refreshWeather` n'a pas créé le document `weather/home`.

## URL locales

Les commandes npm utilisent les URL suivantes :

```text
POST http://127.0.0.1:5001/demo-smalltv-weather/northamerica-northeast1/refreshWeather
GET  http://127.0.0.1:5001/demo-smalltv-weather/northamerica-northeast1/getWeather
GET  http://127.0.0.1:5001/demo-smalltv-weather/northamerica-northeast1/getHomeAssistantWeather
GET  http://127.0.0.1:5001/demo-smalltv-weather/northamerica-northeast1/getSmallTvImage
```

## Home Assistant

Le endpoint `getHomeAssistantWeather` lit le document privé `weather/home` via l'Admin SDK Firebase et retourne une réponse alignée sur les champs attendus par `WeatherEntity` (https://developers.home-assistant.io/docs/core/entity/weather/) : 
- `current` contient `condition`, `native_temperature`, `native_apparent_temperature`, `humidity`, `native_precipitation`, `native_wind_speed` et les unités natives.
- `forecast.hourly` contient les 24 prochaines heures au format `datetime`, `condition`, `native_temperature` et `precipitation_probability`.
- `forecast.daily` contient 7 jours avec `native_temperature`, `native_templow` et `precipitation_probability`.

Créer le secret utilisé par Home Assistant avant le déploiement :

```bash
# créer un token aléatoire de 48 octets en base64
openssl rand -base64 48

firebase functions:secrets:set HOME_ASSISTANT_WEATHER_TOKEN
npm run deploy
```

En local, l'émulateur peut lire le token depuis `.secret.local` :

```text
HOME_ASSISTANT_WEATHER_TOKEN=dev-token
```

Sur HA, il faudra mettre le bearer token dans la configuration dams `secrets.yaml`

Exemple d'appel :

```bash
# Dev
curl --fail --silent --show-error \
  -H "Authorization: Bearer dev-token" \
  http://127.0.0.1:5001/demo-smalltv-weather/northamerica-northeast1/getHomeAssistantWeather
  
# Prod
curl --fail --silent --show-error \
    -H "Authorization: Bearer ton-secret" \
    https://northamerica-northeast1-TON_PROJECT_ID.cloudfunctions.net/getHomeAssistantWeather
```

## Commandes disponibles

```bash
npm run build    # Compile TypeScript dans lib/
npm run clean    # Supprime lib/
npm run dev      # Compile et lance les émulateurs locaux
npm run refresh  # Récupère la météo et remplit Firestore local
npm run weather  # Affiche le WeatherState local en JSON
npm run image    # Télécharge le PNG local dans /tmp
npm run deploy   # Déploie les Functions vers le projet Firebase actif
```

## Déploiement Firebase

Se connecter à Firebase et associer le dépôt à un projet existant :

```bash
firebase login
firebase use --add
```

Déployer ensuite les fonctions :

```bash
npm run deploy
```

La commande utilise le projet sélectionné par `firebase use`. Le déploiement compile automatiquement le TypeScript grâce au hook `predeploy` de `firebase.json`.

## Notes techniques

- Le filtre MétéoCAN utilise `INTERSECTS(geometry,POINT(-70.67 46.117))`, dans l'ordre longitude puis latitude.
- L'API GeoMet annonce une syntaxe CQL2, mais son déploiement actuel accepte `filter-lang=cql-text` et rejette `cql2-text`.
- Les alertes conservent la couleur de risque officielle MétéoCAN (`risk_colour_fr`) et leur date de publication. Le PNG utilise cette couleur sans inventer de niveau lorsque le champ est absent.
- Le mode de communication avec le SmallTV (`pull-url`, téléversement local ou firmware personnalisé) reste volontairement indéterminé jusqu'au test du matériel réel.
- Les blocs `INT` et `EXT` sont prêts pour deux futurs capteurs Govee et affichent uniquement température et humidité.
- Le tableau normalisé `hourly` contient les 24 prochaines heures à partir de l'observation Open-Meteo courante.
- Aucun framework ni script de tests automatisés n'est inclus dans le projet.
