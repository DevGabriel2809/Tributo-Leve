/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_MERCADO_PAGO_PUBLIC_KEY?: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
  readonly VITE_GA_MEASUREMENT_ID?: string
  readonly VITE_GOOGLE_SITE_VERIFICATION?: string
  readonly VITE_PUBLIC_CONTACT_EMAIL?: string
  readonly VITE_PUBLIC_COMPANY_NAME?: string
  readonly VITE_PUBLIC_CNPJ?: string
  readonly VITE_PUBLIC_CITY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  TaxEngine: {
    YEARS: number[]
    defaultState: () => any
    normalizeState: (state: any) => any
    calculate: (data: any, state: any) => any
    getCnae: (data: any, value: string) => any
  }
}
