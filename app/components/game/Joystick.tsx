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
      color: 'rgba(255, 140, 180, 0.8)', // Light pink
      size: 120,
      dynamicPage: true,
      fadeTime: 100,
      lockX: false,
      lockY: false,
      restOpacity: 0.8
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
    <div className="fixed bottom-0 right-0 w-full flex justify-end items-end p-4 pointer-events-none">
      <div 
        ref={containerRef} 
        className="w-40 h-40 bg-black bg-opacity-20 rounded-full touch-none pointer-events-auto relative overflow-visible"
        style={{ 
          touchAction: 'none',
          boxShadow: '0 0 20px rgba(255, 255, 255, 0.2)',
          border: '2px solid rgba(255, 255, 255, 0.2)'
        }}
      >
        {/* Visual ring to indicate the joystick area */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)'
          }}
        />
        {/* Instructions */}
        <div className="absolute -top-8 left-0 right-0 text-center text-xs text-white bg-black bg-opacity-50 rounded px-2 py-1">
          Drag to Control
        </div>
      </div>
    </div>
  )
} 