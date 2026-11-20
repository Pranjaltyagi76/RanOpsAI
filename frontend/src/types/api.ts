/** Mirrors backend `app/api/health.py` response models. */

export interface HealthResponse {
  status: 'ok'
  app: string
  version: string
  environment: 'development' | 'test' | 'production'
  demo_mode: boolean
  ai_provider: 'demo' | 'gemini' | 'groq'
}

export interface ReadinessResponse {
  status: 'ok'
  database: 'ok'
}
