'use client'

import { useRef, useEffect } from 'react'

interface CanvasProps {
  width: number
  height: number
  onCanvasReady: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void
}

export default function Canvas({ width, height, onCanvasReady }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set actual canvas size with device pixel ratio for sharp rendering
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    
    // Scale the context to ensure correct drawing operations
    ctx.scale(dpr, dpr)
    
    // Set the CSS size of the canvas
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    // Call onCanvasReady with the canvas and context
    onCanvasReady(canvas, ctx)
  }, [width, height, onCanvasReady])

  return (
    <canvas
      ref={canvasRef}
      className="bg-black rounded-lg shadow-lg"
      style={{ 
        touchAction: 'none',
        width: `${width}px`,
        height: `${height}px`
      }}
    />
  )
} 