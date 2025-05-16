export interface Vector2D {
  x: number
  y: number
}

export interface Entity {
  id: string
  position: Vector2D
  velocity: Vector2D
  acceleration: Vector2D
  rotation: number
  width: number
  height: number
  color: string
  speed: number
  maxSpeed: number
  friction: number
  colliding: boolean
}

export interface Player extends Entity {
  control: {
    up: boolean
    down: boolean
    left: boolean
    right: boolean
  }
  laps: number
  lapTimes: number[]
  bestLapTime: number | null
  currentLapTime: number
}

export interface AIOpponent extends Entity {
  waypoints: Vector2D[]
  currentWaypoint: number
  difficulty: number
  laps: number
  lapTimes: number[]
}

export interface Track {
  width: number
  height: number
  walls: { start: Vector2D; end: Vector2D }[]
  checkpoints: Vector2D[]
  startLine: { start: Vector2D; end: Vector2D }
}

export type GameState = 'title' | 'ready' | 'racing' | 'finished' | 'gameOver'

export interface GameContext {
  canvas: HTMLCanvasElement | null
  ctx: CanvasRenderingContext2D | null
  gameState: GameState
  player: Player
  opponents: AIOpponent[]
  track: Track
  time: number
  bestTime: number | null
  countdown: number
}

export interface JoystickState {
  angle: number | null
  force: number | null
  position: Vector2D | null
} 