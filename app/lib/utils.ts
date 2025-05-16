import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Vector2D } from '../types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI)
}

export function distance(a: Vector2D, b: Vector2D): number {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2))
}

export function angleToVector(angle: number): Vector2D {
  return {
    x: Math.cos(degreesToRadians(angle)),
    y: Math.sin(degreesToRadians(angle))
  }
}

export function formatTime(time: number): string {
  const minutes = Math.floor(time / 60000)
  const seconds = Math.floor((time % 60000) / 1000)
  const milliseconds = Math.floor((time % 1000) / 10)
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`
}

export function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lineIntersection(
  line1Start: Vector2D,
  line1End: Vector2D,
  line2Start: Vector2D,
  line2End: Vector2D
): Vector2D | null {
  const s1_x = line1End.x - line1Start.x
  const s1_y = line1End.y - line1Start.y
  const s2_x = line2End.x - line2Start.x
  const s2_y = line2End.y - line2Start.y

  const s = (-s1_y * (line1Start.x - line2Start.x) + s1_x * (line1Start.y - line2Start.y)) / (-s2_x * s1_y + s1_x * s2_y)
  const t = (s2_x * (line1Start.y - line2Start.y) - s2_y * (line1Start.x - line2Start.x)) / (-s2_x * s1_y + s1_x * s2_y)

  if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
    return {
      x: line1Start.x + (t * s1_x),
      y: line1Start.y + (t * s1_y)
    }
  }

  return null
}

export function generateAvatarUrl(name: string, style: string = 'bottts'): string {
  const seed = name.toLowerCase().trim()
  
  return `https://api.dicebear.com/6.x/${style}/svg?seed=${encodeURIComponent(seed)}`
} 