/** @type {import('tailwindcss').Config} */
// Design tokens — thème "e-sport dark". Vert énergie = accent live/action,
// violet = accent secondaire (premium / Pro / IA). Voir README > Design system.
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#08090b",
          soft: "#0f1114",
          elevated: "#16191d",
          card: "#131519",
          // Cinematic (Phase G.2) — surface "verre" pour panneaux flottants /
          // overlays (LIVE, RESULT). Pas de vrai flou (expo-blur absent du
          // projet, non ajouté ici) : opacité élevée sur le ton "elevated"
          // pour suggérer une profondeur sans dépendance native supplémentaire.
          glass: "rgba(22,25,29,0.72)",
        },
        border: {
          DEFAULT: "#24272c",
          soft: "#1a1d21",
          // Cinematic (Phase G.2)
          active: "#3a3f46", // état focus/actif neutre, sans teinte
          cinematic: "rgba(57,255,138,0.35)", // bordure accentuée des cartes "moment"
        },
        accent: {
          DEFAULT: "#39ff8a",
          50: "#e9fff3",
          100: "#c6ffe0",
          200: "#8dffc2",
          300: "#5bff9f",
          400: "#39ff8a",
          500: "#1de873",
          600: "#12b559",
          700: "#0e8c46",
          800: "#0c6d38",
          900: "#0a562d",
          // Cinematic (Phase G.2) — surface accent translucide prête à
          // l'emploi (évite de retaper `accent/10`-`accent/15` à chaque écran).
          soft: "rgba(57,255,138,0.12)",
        },
        // Cinematic (Phase G.2) — résultat de match (WIN/DRAW/LOSS), reprend
        // exactement le mapping déjà informel de MatchCheckinPanel.tsx
        // (accent/warn/danger) pour lui donner un nom sémantique partagé,
        // sans changer une seule valeur de couleur existante.
        outcome: {
          win: { DEFAULT: "#39ff8a", soft: "rgba(57,255,138,0.12)" },
          draw: { DEFAULT: "#f5a623", soft: "rgba(245,166,35,0.12)" },
          loss: { DEFAULT: "#ff4d4f", soft: "rgba(255,77,79,0.12)" },
        },
        pro: {
          DEFAULT: "#8b5cf6",
          50: "#f4f0ff",
          100: "#e6dbff",
          200: "#cdb6ff",
          300: "#ae8bff",
          400: "#8b5cf6",
          500: "#7238ea",
          600: "#5c26c9",
          700: "#481c9e",
          800: "#37177a",
          900: "#291360",
        },
        rarity: {
          bronze: "#a3673a",
          silver: "#c0c5cc",
          gold: "#e8b84b",
          icon: "#39e6ff",
        },
        danger: "#ff4d4f",
        warn: "#f5a623",
        fg: {
          DEFAULT: "#f4f5f7",
          muted: "#9aa0a8",
          subtle: "#666c74",
        },
      },
      borderRadius: {
        xl2: "20px",
      },
      fontFamily: {
        display: ["BarlowCondensed_700Bold"],
        "display-semibold": ["BarlowCondensed_600SemiBold"],
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
        "sans-semibold": ["Inter_600SemiBold"],
        "sans-bold": ["Inter_700Bold"],
      },
    },
  },
  plugins: [],
};
