'use client'

import { useSyncExternalStore } from 'react'
import {
  CLAVE_CONSENTIMIENTO,
  CLAVE_CONSENTIMIENTO_PUBLICIDAD,
  EVENTO_CONSENTIMIENTO,
  leerConsentimiento,
  type EstadoConsentimiento,
} from '@/lib/analytics'

// Lectura reactiva de las decisiones de cookies (localStorage). Las usan el aviso de cookies y, a futuro, los anuncios.

export type EstadoCliente = EstadoConsentimiento | 'servidor'

declare global {
  interface Navigator {
    globalPrivacyControl?: boolean
  }
}

export function suscribir(avisar: () => void) {
  window.addEventListener('storage', avisar)
  window.addEventListener(EVENTO_CONSENTIMIENTO, avisar)
  return () => {
    window.removeEventListener('storage', avisar)
    window.removeEventListener(EVENTO_CONSENTIMIENTO, avisar)
  }
}

export function leerEstado(clave: string): EstadoConsentimiento {
  let guardado: string | null = null
  try {
    guardado = window.localStorage.getItem(clave)
  } catch {
    // almacenamiento bloqueado: se comporta como "sin decisión" y no se carga nada
  }
  return leerConsentimiento(guardado, navigator.globalPrivacyControl === true) ?? 'pendiente'
}

export function guardarDecision(clave: string, valor: 'concedido' | 'denegado') {
  try {
    window.localStorage.setItem(clave, valor)
  } catch {
    // sin almacenamiento no se puede recordar la decisión, pero se respeta en esta visita
  }
}

export const useEstadoAnalitica = () => useSyncExternalStore<EstadoCliente>(suscribir, () => leerEstado(CLAVE_CONSENTIMIENTO), () => 'servidor')
export const useEstadoPublicidad = () => useSyncExternalStore<EstadoCliente>(suscribir, () => leerEstado(CLAVE_CONSENTIMIENTO_PUBLICIDAD), () => 'servidor')
