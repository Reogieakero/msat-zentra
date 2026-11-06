import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  
  globalIgnores([
    
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  
  
  {
    files: ["src/hooks/use-mobile.ts"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  
  
  
  // These components/hooks read persisted UI state (theme, sidebar mode, fluid
  // hue, active school term) from localStorage on mount, re-sync it on
  // navigation/storage/focus events, and seed user-editable defaults
  // (term picker selection) that derivation would clobber. Calling setState
  // in these effects is intentional hydration-style sync, not a
  // cascading-render bug. Restructuring (lazy init, derived state,
  // useSyncExternalStore) would change SSR hydration output, query enablement
  // timing, or selection semantics.
  {
    files: [
      "src/app/principal/layout.tsx",
      "src/components/auth/FluidBackground.tsx",
      "src/components/landing/ThemeToggle.tsx",
      "src/components/providers.tsx",
      "src/lib/auth/useFluidHue.ts",
      "src/lib/term/TermContext.tsx",
      "src/components/term/TermSelectOverlay.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  
  
  
  {
    files: [
      "src/app/principal/risk/interventions/page.tsx",
      "src/app/principal/risk/interventions/components/InterventionDrawer.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  
  
  
  {
    files: ["src/app/registrar/final-grades/components/FinalGradesGetStartedModal.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  
  
  
  {
    files: [
      "src/lib/fluid/fluidBackground.ts",
      "src/components/ui/molten-metal.tsx",
      "src/components/ui/liquid-ether.tsx",
      "src/components/ui/gradient-waves.tsx",
      "src/components/ui/web-threads/WebThreads.tsx",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "prefer-const": "off",
    },
  },
]);

export default eslintConfig;
