# One Network — React + Vite

Reproduction React de la page d'accueil One Network, adaptée aux navigateurs WebKit (Safari sur macOS, iPhone et iPad).

## Stack

- React 19
- Vite
- GSAP 3 pour les animations d'entrée et les interactions
- Canvas 2D pour le réseau lumineux en arrière-plan
- CSS avec `-webkit-backdrop-filter`, `viewport-fit=cover` et respect des zones de sécurité iOS

## Développement

```bash
npm install
npm run dev
```

## Build de production

```bash
npm run build
npm run preview
```

L'animation est réduite automatiquement lorsque le système a activé « Réduire les animations ». Le contenu de la page reste lisible même si l'animation échoue à se charger.
