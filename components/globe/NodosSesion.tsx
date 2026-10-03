'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CENTROS_SESION, type EstadoSesion } from '@/lib/globe/sesiones'
import { latLonAVector3, gradosARadianes } from '@/lib/globe/geo'

const COLOR_ABIERTO = '#4fc3ff'
const COLOR_CERRADO = '#3a5068'

function NodoSesion({ lat, lon, abierto }: { lat: number; lon: number; abierto: boolean }) {
  const pos = useMemo(() => latLonAVector3(gradosARadianes(lat), gradosARadianes(lon), 1.004), [lat, lon])
  const posicion: [number, number, number] = [pos.x, pos.y, pos.z]
  const nucleoRef = useRef<THREE.Mesh>(null)
  const anilloRef = useRef<THREE.Mesh>(null)
  const anilloMatRef = useRef<THREE.MeshBasicMaterial>(null)

  useFrame((state) => {
    if (!abierto) {
      if (anilloRef.current) anilloRef.current.visible = false
      return
    }
    if (anilloRef.current && anilloMatRef.current) {
      anilloRef.current.visible = true
      const ciclo = (state.clock.getElapsedTime() * 0.5) % 1
      anilloRef.current.scale.setScalar(1 + ciclo * 2.2)
      anilloMatRef.current.opacity = 0.5 * (1 - ciclo)
    }
    if (nucleoRef.current) {
      const pulso = 0.8 + 0.2 * Math.sin(state.clock.getElapsedTime() * 2)
      nucleoRef.current.scale.setScalar(pulso)
    }
  })

  return (
    <group position={posicion}>
      <mesh ref={nucleoRef}>
        <sphereGeometry args={[0.014, 8, 8]} />
        <meshBasicMaterial color={abierto ? COLOR_ABIERTO : COLOR_CERRADO} toneMapped={false} transparent opacity={abierto ? 1 : 0.5} />
      </mesh>
      <mesh ref={anilloRef} visible={false}>
        <ringGeometry args={[0.014, 0.02, 16]} />
        <meshBasicMaterial ref={anilloMatRef} color={COLOR_ABIERTO} toneMapped={false} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

export function NodosSesion({ estados }: { estados: EstadoSesion[] }) {
  return (
    <>
      {CENTROS_SESION.map((centro) => (
        <NodoSesion key={centro.id} lat={centro.lat} lon={centro.lon} abierto={estados.find((e) => e.id === centro.id)?.abierto ?? false} />
      ))}
    </>
  )
}
