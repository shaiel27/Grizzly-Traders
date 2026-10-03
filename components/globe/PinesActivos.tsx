'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { MARCADORES, type Marcador } from '@/lib/globe/marcadores'
import { latLonAVector3, gradosARadianes } from '@/lib/globe/geo'

const COLOR_ENERGIA = '#f7b955' // --brand-amber
const COLOR_METAL = '#ffd27a'
const COLOR_PLATA = '#d8e3f0'

function colorMarcador(m: Marcador): string {
  if (m.simbolo === 'XAGUSD') return COLOR_PLATA
  return m.tipo === 'energia' ? COLOR_ENERGIA : COLOR_METAL
}

interface PinProps {
  marcador: Marcador
  seleccionado: boolean
  resaltado: boolean
  registrarHit: (id: string, obj: THREE.Object3D | null) => void
}

function Pin({ marcador, seleccionado, resaltado, registrarHit }: PinProps) {
  const color = useMemo(() => colorMarcador(marcador), [marcador])
  const pos = useMemo(() => latLonAVector3(gradosARadianes(marcador.lat), gradosARadianes(marcador.lon), 1), [marcador])
  const normal = useMemo(() => new THREE.Vector3(pos.x, pos.y, pos.z), [pos])
  const orientacion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal), [normal])
  const posicion: [number, number, number] = [pos.x, pos.y, pos.z]

  const nucleoRef = useRef<THREE.Mesh>(null)
  const anilloRef = useRef<THREE.Mesh>(null)
  const anilloMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const grupoRef = useRef<THREE.Group>(null)
  const hitRef = useRef<THREE.Mesh>(null)

  // La esfera invisible (radio mayor que el pin) es el objetivo real del raycast — mas facil de
  // acertar con el dedo que el nucleo visual de 0.018 (plan 009 §1.3).
  useEffect(() => {
    if (hitRef.current) hitRef.current.userData.id = marcador.id
    registrarHit(marcador.id, hitRef.current)
    return () => registrarHit(marcador.id, null)
  }, [marcador.id, registrarHit])

  const normalMundo = useMemo(() => new THREE.Vector3(), [])
  const dirCamara = useMemo(() => new THREE.Vector3(), [])
  useFrame((state) => {
    // Atenua el pin cuando queda en la cara oculta del globo: el grupo gira con grupoGlobo, asi
    // que la posicion MUNDIAL del nucleo (esfera de radio 1 centrada en el origen) es tambien
    // su normal mundial.
    if (nucleoRef.current) {
      nucleoRef.current.getWorldPosition(normalMundo)
      dirCamara.copy(state.camera.position).normalize()
      const dot = normalMundo.normalize().dot(dirCamara)
      const visible = dot > -0.05
      const opacidadBase = visible ? 1 : 0.15
      const escalaExtra = seleccionado || resaltado ? 1.6 : 1
      nucleoRef.current.scale.setScalar(escalaExtra)
      const matNucleo = nucleoRef.current.material as THREE.MeshBasicMaterial
      matNucleo.opacity = opacidadBase
      if (anilloMatRef.current) anilloMatRef.current.opacity = opacidadBase * 0.6
    }

    // Anillo que pulsa hacia afuera, mas rapido si esta resaltado/seleccionado.
    if (anilloRef.current) {
      const velocidad = seleccionado || resaltado ? 1.6 : 0.8
      const ciclo = (state.clock.getElapsedTime() * velocidad) % 1
      const escala = 1 + ciclo * 1.8
      anilloRef.current.scale.setScalar(escala)
      if (anilloMatRef.current) anilloMatRef.current.opacity *= 1 - ciclo
    }
  })

  return (
    <group ref={grupoRef} position={posicion} quaternion={orientacion}>
      <mesh ref={nucleoRef}>
        <sphereGeometry args={[0.018, 10, 10]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={1} />
      </mesh>
      <mesh ref={anilloRef}>
        <ringGeometry args={[0.018, 0.026, 20]} />
        <meshBasicMaterial ref={anilloMatRef} color={color} toneMapped={false} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* Aguja corta perpendicular a la superficie, apuntando hacia afuera del globo. */}
      <mesh position={[0, 0, 0.04]}>
        <cylinderGeometry args={[0.0015, 0.0015, 0.08, 4]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.5} />
      </mesh>
      {/* Esfera invisible mas grande: objetivo real del raycast (tap/hover). */}
      <mesh ref={hitRef} visible={false}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

interface PinesActivosProps {
  seleccionId: string | null
  resaltadoId: string | null
  registrarHit: (id: string, obj: THREE.Object3D | null) => void
}

export function PinesActivos({ seleccionId, resaltadoId, registrarHit }: PinesActivosProps) {
  return (
    <>
      {MARCADORES.map((m) => (
        <Pin key={m.id} marcador={m} seleccionado={seleccionId === m.id} resaltado={resaltadoId === m.id} registrarHit={registrarHit} />
      ))}
    </>
  )
}
