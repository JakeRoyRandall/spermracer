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
  name?: string
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
  speedBoostTime: number // Time remaining for speed boost
  slowDownTime: number // Time remaining for slow effect
}

export interface AIOpponent extends Entity {
  name: string
  waypoints: Vector2D[]
  currentWaypoint: number
  difficulty: number
  laps: number
  lapTimes: number[]
  speedBoostTime: number // Time remaining for speed boost
  slowDownTime: number // Time remaining for slow effect
}

export interface Track {
  width: number
  height: number
  walls: { start: Vector2D; end: Vector2D }[]
  checkpoints: Vector2D[]
  startLine: { start: Vector2D; end: Vector2D }
}

export type PowerUpType = 'boost' | 'slowdown'

export interface PowerUp {
  id: string
  position: Vector2D
  type: PowerUpType
  radius: number
  collected: boolean
  respawnTime: number // Time until respawn if collected
}

export type GameState = 'title' | 'ready' | 'racing' | 'finished' | 'gameOver' | 'nameEntry'

export interface GameContext {
  canvas: HTMLCanvasElement | null
  ctx: CanvasRenderingContext2D | null
  gameState: GameState
  player: Player
  opponents: AIOpponent[]
  track: Track
  powerUps: PowerUp[]
  time: number
  bestTime: number | null
  countdown: number
}

export interface JoystickState {
  angle: number | null
  force: number | null
  position: Vector2D | null
} 