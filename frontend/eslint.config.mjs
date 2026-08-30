import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // shadcn-generated hook uses an effect to read viewport width; relax the
  // set-state-in-effect rule there so lint stays clean without editing the lib.
  {
    files: ["src/hooks/use-mobile.ts"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // These components/hooks read persisted UI state (theme, sidebar mode, fluid
  // hue) from localStorage on mount; calling setState in the effect is
  // intentional hydration-style sync, not a cascading-render bug.
  {
    files: [
      "src/app/principal/layout.tsx",
      "src/components/auth/FluidBackground.tsx",
      "src/components/landing/ThemeToggle.tsx",
      "src/components/providers.tsx",
      "src/lib/auth/useFluidHue.ts",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Interventions page + drawer use the same mount/filter-triggered data-fetch
  // effect pattern as the rest of the risk module (records, riskBoard); the
  // effect body only kicks off an async fetch or resets transient action state.
  {
    files: [
      "src/app/principal/risk/interventions/page.tsx",
      "src/app/principal/risk/interventions/components/InterventionDrawer.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Final-grades "Get Started" modal reads a localStorage dismissal flag on
  // mount to decide whether to auto-open; setState in the effect is intentional
  // mount-time sync, not a cascading-render bug.
  {
    files: ["src/app/registrar/final-grades/components/FinalGradesGetStartedModal.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Vendored WebGL background components (PavelDoGreat / tkabalin, MIT /
  // beautiful-backgrounds). Heavy use of `any` against the raw WebGL context and
  // loop-scoped reassignment; leave as-is rather than rewrite a third-party lib.
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
