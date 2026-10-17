# One Network — React + Vite

Reproduction React de la page d'accueil One Network, adaptée aux navigateurs WebKit : Safari sur macOS, iPhone et iPad.

## Stack

- React 18
- Vite 6
- GSAP 3 pour les animations d'entrée et les interactions
- Canvas 2D pour le réseau lumineux en arrière-plan
- CSS avec `-webkit-backdrop-filter`, `viewport-fit=cover` et prise en charge des safe areas iOS

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

La page respecte `prefers-reduced-motion`. Un fichier de secours révèle le contenu et conserve le réseau animé si GSAP n'est pas disponible.
