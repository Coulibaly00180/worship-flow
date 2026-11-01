import coreWebVitals from "eslint-config-next/core-web-vitals"
import typescript from "eslint-config-next/typescript"

const config = [
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]

export default config
