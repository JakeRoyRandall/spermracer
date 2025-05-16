'use client'

import { useEffect, useRef } from 'react'
import nipplejs, { JoystickManager, JoystickOutputData } from 'nipplejs'

interface JoystickProps {
  onMove: (angle: number, force: number) => void
  onEnd: () => void
}

export default function Joystick({ onMove, onEnd }: JoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const joystickRef = useRef<JoystickManager | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Initialize joystick
    joystickRef.current = nipplejs.create({
      zone: containerRef.current,
      mode: 'static',
      position: { left: '50%', top: '50%' },
      color: 'rgba(255, 255, 255, 0.5)',
      size: 100,
      lockX: false,
      lockY: false
    })

    // Add event listeners
    joystickRef.current.on('move', (_, data: JoystickOutputData) => {
      if (data.angle && data.angle.radian !== undefined && data.force !== undefined) {
        // Convert radians to degrees and normalize to 0-360
        const angleDegrees = (data.angle.degree + 90) % 360
        onMove(angleDegrees, data.force / 50) // Normalize force (0-1)
      }
    })

    joystickRef.current.on('end', () => {
      onEnd()
    })

    // Cleanup
    return () => {
      if (joystickRef.current) {
        joystickRef.current.destroy()
      }
    }
  }, [onMove, onEnd])

  return (
    <div 
      ref={containerRef} 
      className="fixed bottom-4 right-4 w-32 h-32 bg-black bg-opacity-20 rounded-full touch-none"
      style={{ touchAction: 'none' }}
    />
  )
} 