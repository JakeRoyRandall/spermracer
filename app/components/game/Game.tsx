'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Canvas from './Canvas'
import Joystick from './Joystick'
import { GameContext, GameState, Track, Vector2D } from '../../types'
import { generateId, formatTime, isMobile } from '../../lib/utils'
import { updateEntityPhysics, applyPlayerControls, applyJoystickControl } from '../../lib/game-engine/physics'
import { checkTrackCollisions, checkCheckpointCollision } from '../../lib/game-engine/collision'
import { updateAIOpponent, generateAIOpponents } from '../../lib/game-engine/ai'

// Track definition (a simple oval track)
const trackWidth = 800
const trackHeight = 500
const trackWallThickness = 40
const checkpointRadius = 50

const track: Track = {
  width: trackWidth,
  height: trackHeight,
  walls: [
    // Outer walls
    { start: { x: 0, y: 0 }, end: { x: trackWidth, y: 0 } },
    { start: { x: trackWidth, y: 0 }, end: { x: trackWidth, y: trackHeight } },
    { start: { x: trackWidth, y: trackHeight }, end: { x: 0, y: trackHeight } },
    { start: { x: 0, y: trackHeight }, end: { x: 0, y: 0 } },
    
    // Inner walls
    { start: { x: trackWallThickness * 4, y: trackWallThickness * 2 }, end: { x: trackWidth - trackWallThickness * 4, y: trackWallThickness * 2 } },
    { start: { x: trackWidth - trackWallThickness * 4, y: trackWallThickness * 2 }, end: { x: trackWidth - trackWallThickness * 4, y: trackHeight - trackWallThickness * 2 } },
    { start: { x: trackWidth - trackWallThickness * 4, y: trackHeight - trackWallThickness * 2 }, end: { x: trackWallThickness * 4, y: trackHeight - trackWallThickness * 2 } },
    { start: { x: trackWallThickness * 4, y: trackHeight - trackWallThickness * 2 }, end: { x: trackWallThickness * 4, y: trackWallThickness * 2 } },
  ],
  checkpoints: [
    { x: trackWidth / 2, y: trackWallThickness },
    { x: trackWidth - trackWallThickness * 2, y: trackHeight / 2 },
    { x: trackWidth / 2, y: trackHeight - trackWallThickness },
    { x: trackWallThickness * 2, y: trackHeight / 2 }
  ],
  startLine: {
    start: { x: trackWidth / 2 - 50, y: trackWallThickness * 2 },
    end: { x: trackWidth / 2 + 50, y: trackWallThickness * 2 }
  }
}

// Waypoints for AI opponents to follow
const aiWaypoints: Vector2D[] = [
  { x: trackWidth / 2, y: trackWallThickness * 3 },
  { x: trackWidth - trackWallThickness * 6, y: trackHeight / 4 },
  { x: trackWidth - trackWallThickness * 6, y: trackHeight / 2 },
  { x: trackWidth - trackWallThickness * 6, y: trackHeight * 3 / 4 },
  { x: trackWidth / 2, y: trackHeight - trackWallThickness * 3 },
  { x: trackWallThickness * 6, y: trackHeight * 3 / 4 },
  { x: trackWallThickness * 6, y: trackHeight / 2 },
  { x: trackWallThickness * 6, y: trackHeight / 4 }
]

export default function Game() {
  const [gameState, setGameState] = useState<GameState>('title')
  const [showJoystick, setShowJoystick] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const [, setTime] = useState(0)
  const [bestTime, setBestTime] = useState<number | null>(null)
  
  const gameContextRef = useRef<GameContext>({
    canvas: null,
    ctx: null,
    gameState: 'title',
    player: {
      id: generateId(),
      position: { x: trackWidth / 2 - 10, y: trackWallThickness * 3 },
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
      rotation: 0,
      width: 20,
      height: 20,
      color: '#00ff00',
      speed: 200,
      maxSpeed: 300,
      friction: 0.1,
      colliding: false,
      control: {
        up: false,
        down: false,
        left: false,
        right: false
      },
      laps: 0,
      lapTimes: [],
      bestLapTime: null,
      currentLapTime: 0
    },
    opponents: [],
    track,
    time: 0,
    bestTime: null,
    countdown: 3
  })
  
  const lastTimeRef = useRef<number>(0)
  const requestAnimationFrameRef = useRef<number>(0)
  const nextCheckpointRef = useRef<number>(0)
  
  // Handle joystick controls
  const handleJoystickMove = useCallback((angle: number, force: number) => {
    applyJoystickControl(gameContextRef.current.player, angle, force)
  }, [])
  
  const handleJoystickEnd = useCallback(() => {
    gameContextRef.current.player.acceleration.x = 0
    gameContextRef.current.player.acceleration.y = 0
  }, [])
  
  // Handle keyboard controls
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const { player } = gameContextRef.current
    
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
        player.control.up = true
        break
      case 'ArrowDown':
      case 's':
        player.control.down = true
        break
      case 'ArrowLeft':
      case 'a':
        player.control.left = true
        break
      case 'ArrowRight':
      case 'd':
        player.control.right = true
        break
      case ' ':
        if (gameContextRef.current.gameState === 'title' || gameContextRef.current.gameState === 'gameOver') {
          startGame()
        }
        break
    }
  }, [])
  
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const { player } = gameContextRef.current
    
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
        player.control.up = false
        break
      case 'ArrowDown':
      case 's':
        player.control.down = false
        break
      case 'ArrowLeft':
      case 'a':
        player.control.left = false
        break
      case 'ArrowRight':
      case 'd':
        player.control.right = false
        break
    }
  }, [])
  
  // Initialize canvas and game context
  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    gameContextRef.current.canvas = canvas
    gameContextRef.current.ctx = ctx
  }, [])
  
  // Start a new game
  const startGame = useCallback(() => {
    // Reset player state
    const { player } = gameContextRef.current
    player.position = { x: trackWidth / 2 - 10, y: trackWallThickness * 3 }
    player.velocity = { x: 0, y: 0 }
    player.acceleration = { x: 0, y: 0 }
    player.rotation = 0
    player.laps = 0
    player.lapTimes = []
    player.bestLapTime = null
    player.currentLapTime = 0
    
    // Generate AI opponents
    gameContextRef.current.opponents = generateAIOpponents(3, 
      { x: trackWidth / 2 + 20, y: trackWallThickness * 3 }, 
      aiWaypoints
    )
    
    // Reset game state
    setGameState('ready')
    gameContextRef.current.gameState = 'ready'
    setCountdown(3)
    gameContextRef.current.countdown = 3
    gameContextRef.current.time = 0
    
    // Reset checkpoint tracking
    nextCheckpointRef.current = 0
    
    // Start countdown
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        const newCountdown = prev - 1
        gameContextRef.current.countdown = newCountdown
        if (newCountdown <= 0) {
          clearInterval(countdownInterval)
          setGameState('racing')
          gameContextRef.current.gameState = 'racing'
          lastTimeRef.current = performance.now()
        }
        return newCountdown
      })
    }, 1000)
  }, [])
  
  // Game loop
  const gameLoop = useCallback(() => {
    const ctx = gameContextRef.current.ctx
    const canvas = gameContextRef.current.canvas
    
    if (!ctx || !canvas) {
      requestAnimationFrameRef.current = requestAnimationFrame(gameLoop)
      return
    }
    
    // Calculate delta time
    const currentTime = performance.now()
    const deltaTime = (currentTime - lastTimeRef.current) / 1000
    lastTimeRef.current = currentTime
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio)
    
    // Update game state based on current state
    switch (gameContextRef.current.gameState) {
      case 'title':
        renderTitleScreen(ctx, canvas)
        break
      case 'ready':
        renderTrack(ctx)
        renderEntities(ctx)
        renderCountdown(ctx, canvas)
        break
      case 'racing':
        // Update timer
        gameContextRef.current.time += deltaTime * 1000
        gameContextRef.current.player.currentLapTime += deltaTime * 1000
        
        // Update player physics
        if (!showJoystick) {
          applyPlayerControls(gameContextRef.current.player, deltaTime)
        }
        
        updateEntityPhysics(gameContextRef.current.player, deltaTime)
        
        // Check collisions with track
        checkTrackCollisions(gameContextRef.current.player, gameContextRef.current.track)
        
        // Update AI opponents
        gameContextRef.current.opponents.forEach(opponent => {
          updateAIOpponent(opponent, deltaTime)
          updateEntityPhysics(opponent, deltaTime)
          checkTrackCollisions(opponent, gameContextRef.current.track)
        })
        
        // Check checkpoints
        const currentCheckpoint = gameContextRef.current.track.checkpoints[nextCheckpointRef.current]
        const nextCheckpointIndex = (nextCheckpointRef.current + 1) % gameContextRef.current.track.checkpoints.length
        const nextCheckpoint = gameContextRef.current.track.checkpoints[nextCheckpointIndex]
        
        if (checkCheckpointCollision(
          gameContextRef.current.player,
          nextCheckpointRef.current,
          currentCheckpoint,
          nextCheckpoint,
          checkpointRadius
        )) {
          nextCheckpointRef.current = nextCheckpointIndex
          
          // If we've completed a lap
          if (nextCheckpointRef.current === 0) {
            gameContextRef.current.player.laps++
            gameContextRef.current.player.lapTimes.push(gameContextRef.current.player.currentLapTime)
            
            // Update best lap time
            if (gameContextRef.current.player.bestLapTime === null || 
                gameContextRef.current.player.currentLapTime < gameContextRef.current.player.bestLapTime) {
              gameContextRef.current.player.bestLapTime = gameContextRef.current.player.currentLapTime
            }
            
            // Reset current lap time
            gameContextRef.current.player.currentLapTime = 0
            
            // Check if race is complete (3 laps)
            if (gameContextRef.current.player.laps >= 3) {
              setGameState('finished')
              gameContextRef.current.gameState = 'finished'
              
              // Update best time
              if (bestTime === null || gameContextRef.current.time < bestTime) {
                setBestTime(gameContextRef.current.time)
                gameContextRef.current.bestTime = gameContextRef.current.time
              }
            }
          }
        }
        
        // Render everything
        renderTrack(ctx)
        renderEntities(ctx)
        renderHUD(ctx, canvas)
        break
      case 'finished':
        renderTrack(ctx)
        renderEntities(ctx)
        renderFinished(ctx, canvas)
        break
      case 'gameOver':
        renderGameOver(ctx, canvas)
        break
    }
    
    requestAnimationFrameRef.current = requestAnimationFrame(gameLoop)
  }, [showJoystick, bestTime])
  
  // Render functions
  const renderTrack = (ctx: CanvasRenderingContext2D) => {
    // Draw outer track
    ctx.fillStyle = '#333'
    ctx.fillRect(0, 0, track.width, track.height)
    
    // Draw inner track (grass)
    ctx.fillStyle = '#005500'
    ctx.fillRect(
      trackWallThickness * 4, 
      trackWallThickness * 2, 
      track.width - trackWallThickness * 8, 
      track.height - trackWallThickness * 4
    )
    
    // Draw checkpoints
    ctx.fillStyle = 'rgba(255, 255, 0, 0.2)'
    for (let i = 0; i < track.checkpoints.length; i++) {
      const checkpoint = track.checkpoints[i]
      const nextCheckpoint = track.checkpoints[(i + 1) % track.checkpoints.length]
      
      ctx.beginPath()
      ctx.arc(checkpoint.x, checkpoint.y, checkpointRadius, 0, Math.PI * 2)
      ctx.fill()
      
      // Draw line to next checkpoint
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.2)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(checkpoint.x, checkpoint.y)
      ctx.lineTo(nextCheckpoint.x, nextCheckpoint.y)
      ctx.stroke()
    }
    
    // Draw start line
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(track.startLine.start.x, track.startLine.start.y)
    ctx.lineTo(track.startLine.end.x, track.startLine.end.y)
    ctx.stroke()
  }
  
  const renderEntities = (ctx: CanvasRenderingContext2D) => {
    // Draw AI opponents
    gameContextRef.current.opponents.forEach(opponent => {
      ctx.save()
      
      // Translate to center of opponent
      ctx.translate(
        opponent.position.x + opponent.width / 2, 
        opponent.position.y + opponent.height / 2
      )
      
      // Rotate based on opponent's rotation
      ctx.rotate((opponent.rotation * Math.PI) / 180)
      
      // Draw opponent body
      ctx.fillStyle = opponent.color
      ctx.fillRect(-opponent.width / 2, -opponent.height / 2, opponent.width, opponent.height)
      
      // Draw opponent direction indicator
      ctx.fillStyle = '#000'
      ctx.fillRect(opponent.width / 4, -opponent.height / 2, opponent.width / 4, opponent.height / 4)
      
      ctx.restore()
    })
    
    // Draw player
    const player = gameContextRef.current.player
    ctx.save()
    
    // Translate to center of player
    ctx.translate(
      player.position.x + player.width / 2, 
      player.position.y + player.height / 2
    )
    
    // Rotate based on player's rotation
    ctx.rotate((player.rotation * Math.PI) / 180)
    
    // Draw player body
    ctx.fillStyle = player.color
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height)
    
    // Draw player direction indicator
    ctx.fillStyle = '#000'
    ctx.fillRect(player.width / 4, -player.height / 2, player.width / 4, player.height / 4)
    
    ctx.restore()
  }
  
  const renderHUD = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.fillStyle = '#fff'
    ctx.font = '16px Arial'
    ctx.textAlign = 'left'
    
    // Draw lap counter
    ctx.fillText(`Lap: ${gameContextRef.current.player.laps + 1}/3`, 10, 20)
    
    // Draw timer
    ctx.fillText(`Time: ${formatTime(gameContextRef.current.time)}`, 10, 40)
    
    // Draw current lap time
    ctx.fillText(`Lap Time: ${formatTime(gameContextRef.current.player.currentLapTime)}`, 10, 60)
    
    // Draw best lap time if available
    if (gameContextRef.current.player.bestLapTime !== null) {
      ctx.fillText(`Best Lap: ${formatTime(gameContextRef.current.player.bestLapTime)}`, 10, 80)
    }
  }
  
  const renderTitleScreen = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const width = canvas.width / window.devicePixelRatio
    const height = canvas.height / window.devicePixelRatio
    
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)
    
    ctx.fillStyle = '#fff'
    ctx.font = '36px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('Sperm Racer', width / 2, height / 3)
    
    ctx.font = '18px Arial'
    ctx.fillText('Press SPACE to start', width / 2, height / 2)
    
    if (isMobile()) {
      ctx.fillText('Tap screen to start', width / 2, height / 2 + 30)
    } else {
      ctx.fillText('Use arrow keys or WASD to control', width / 2, height / 2 + 30)
    }
    
    if (bestTime) {
      ctx.fillText(`Best Time: ${formatTime(bestTime)}`, width / 2, height / 2 + 60)
    }
  }
  
  const renderCountdown = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const width = canvas.width / window.devicePixelRatio
    const height = canvas.height / window.devicePixelRatio
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, width, height)
    
    ctx.fillStyle = '#fff'
    ctx.font = '64px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(countdown.toString(), width / 2, height / 2)
  }
  
  const renderFinished = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const width = canvas.width / window.devicePixelRatio
    const height = canvas.height / window.devicePixelRatio
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(0, 0, width, height)
    
    ctx.fillStyle = '#fff'
    ctx.font = '36px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('Race Complete!', width / 2, height / 3)
    
    ctx.font = '24px Arial'
    ctx.fillText(`Time: ${formatTime(gameContextRef.current.time)}`, width / 2, height / 2)
    
    if (gameContextRef.current.bestTime !== null && gameContextRef.current.time <= gameContextRef.current.bestTime) {
      ctx.fillStyle = '#ffff00'
      ctx.fillText('New Best Time!', width / 2, height / 2 + 40)
    }
    
    ctx.fillStyle = '#fff'
    ctx.font = '18px Arial'
    ctx.fillText('Press SPACE to restart', width / 2, height / 2 + 80)
    
    if (isMobile()) {
      ctx.fillText('Tap screen to restart', width / 2, height / 2 + 110)
    }
  }
  
  const renderGameOver = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const width = canvas.width / window.devicePixelRatio
    const height = canvas.height / window.devicePixelRatio
    
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)
    
    ctx.fillStyle = '#fff'
    ctx.font = '36px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('Game Over', width / 2, height / 3)
    
    ctx.font = '18px Arial'
    ctx.fillText('Press SPACE to restart', width / 2, height / 2)
    
    if (isMobile()) {
      ctx.fillText('Tap screen to restart', width / 2, height / 2 + 30)
    }
  }
  
  // Handle touch for mobile devices
  const handleTouch = useCallback(() => {
    if (gameContextRef.current.gameState === 'title' || gameContextRef.current.gameState === 'gameOver' || gameContextRef.current.gameState === 'finished') {
      startGame()
    }
  }, [startGame])
  
  // Setup event listeners and game loop
  useEffect(() => {
    // Check if on mobile and show joystick if needed
    setShowJoystick(isMobile())
    
    // Add event listeners for keyboard controls
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    // Start game loop
    requestAnimationFrameRef.current = requestAnimationFrame(gameLoop)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      cancelAnimationFrame(requestAnimationFrameRef.current)
    }
  }, [gameLoop, handleKeyDown, handleKeyUp])
  
  return (
    <div 
      className="flex items-center justify-center min-h-screen"
      onClick={handleTouch}
    >
      <div className="relative">
        <Canvas 
          width={trackWidth} 
          height={trackHeight} 
          onCanvasReady={handleCanvasReady}
        />
        {showJoystick && gameState === 'racing' && (
          <Joystick
            onMove={handleJoystickMove}
            onEnd={handleJoystickEnd}
          />
        )}
      </div>
    </div>
  )
} 