/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin, e.g. https://ranops-ai-api.onrender.com (no trailing slash needed). */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
