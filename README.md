# Home Assistant

Service météo personnel pour Home Assistant à Saint-Georges, Québec.

Le projet utilise Firebase Functions v2 et Firestore. Les conditions courantes et les prévisions viennent d'Open-Meteo; les alertes proviennent exclusivement de l'API officielle MétéoCAN d'Environnement et Changement climatique Canada.

## Fonctions Firebase

- `refreshWeather` récupère les données météo toutes les 15 minutes et écrit l'état normalisé dans `weather/home`.
- `getWeather` retourne le document `WeatherState` en JSON.
- `getHomeAssistantWeather` retourne une version JSON adaptée à une intégration météo Home Assistant, protégée par un Bearer token.

La météo utilise explicitement le modèle Open-Meteo `best_match`.

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

Cette commande compile le TypeScript, utilise le projet Firebase local `demo-home-assistant`, puis démarre :

- Functions : `http://127.0.0.1:5001`
- Firestore : `http://127.0.0.1:8080`
- Emulator UI : l'adresse affichée par la Firebase CLI, généralement `http://127.0.0.1:4000`

Le projet local `demo-home-assistant` ne nécessite pas de vrai projet Firebase ni de connexion à un compte Google.

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

Les routes `getWeather` et `getHomeAssistantWeather` retournent une erreur `503` tant que `refreshWeather` n'a pas créé le document `weather/home`.

## URL locales

Les commandes npm utilisent les URL suivantes :

```text
POST http://127.0.0.1:5001/demo-home-assistant/northamerica-northeast1/refreshWeather
GET  http://127.0.0.1:5001/demo-home-assistant/northamerica-northeast1/getWeather
GET  http://127.0.0.1:5001/demo-home-assistant/northamerica-northeast1/getHomeAssistantWeather
```

## Home Assistant

Le endpoint `getHomeAssistantWeather` lit le document privé `weather/home` via l'Admin SDK Firebase et retourne une réponse alignée sur les champs attendus par `WeatherEntity` (https://developers.home-assistant.io/docs/core/entity/weather/) :

- `current` contient les conditions courantes, température, ressenti, point de rosée, humidité, précipitation, pression, visibilité, vent, rafales, UV et unités natives.
- `forecast.hourly` contient les 24 prochaines heures avec condition, température, ressenti, point de rosée, humidité, précipitation, pression, couverture nuageuse, vent, rafales, UV, direction du vent et probabilité de précipitation.
- `forecast.daily` contient 7 jours avec maximum/minimum, ressenti max, point de rosée moyen, humidité moyenne, pression moyenne, couverture nuageuse moyenne, précipitation totale, vent maximal, rafales maximales, UV maximal, direction dominante et probabilité de précipitation.
- `supplemental` contient les données utiles aux widgets HA custom mais hors contrat météo standard : modèle Open-Meteo, code météo brut, libellé français, sunrise/sunset, durée du jour, ensoleillement, pression de surface, visibilité brute, alertes MétéoCAN et futurs capteurs `indoor`/`outdoor`.

Créer le secret utilisé par Home Assistant avant le déploiement :

```bash
# créer un token aléatoire de 48 octets en base64
openssl rand -base64 48

firebase functions:secrets:set HOME_ASSISTANT_WEATHER_TOKEN
```

En local, l'émulateur peut lire le token depuis `.secret.local` :

```text
HOME_ASSISTANT_WEATHER_TOKEN=dev-token
```

Sur HA, il faudra mettre le Bearer token dans la configuration dans `secrets.yaml`.

Exemple d'appel local :

```bash
curl --fail --silent --show-error \
  -H "Authorization: Bearer dev-token" \
  http://127.0.0.1:5001/demo-home-assistant/northamerica-northeast1/getHomeAssistantWeather
```

## Commandes disponibles

```bash
npm run build    # Compile TypeScript dans lib/
npm run clean    # Supprime lib/
npm run dev      # Compile et lance les émulateurs locaux
npm run refresh  # Récupère la météo et remplit Firestore local
npm run weather  # Affiche le WeatherState local en JSON
```

## Notes techniques

- Le filtre MétéoCAN utilise `INTERSECTS(geometry,POINT(-70.67 46.117))`, dans l'ordre longitude puis latitude.
- L'API GeoMet annonce une syntaxe CQL2, mais son déploiement actuel accepte `filter-lang=cql-text` et rejette `cql2-text`.
- Les alertes conservent la couleur de risque officielle MétéoCAN (`risk_colour_fr`) et leur date de publication.
- Les blocs `INT` et `EXT` sont prêts pour deux futurs capteurs Govee et affichent uniquement température et humidité.
- Le tableau normalisé `hourly` contient les 24 prochaines heures à partir de l'observation Open-Meteo courante.
- Aucun framework ni script de tests automatisés n'est inclus dans le projet.
