'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Canvas from './Canvas'
import Joystick from './Joystick'
import { GameContext, GameState, Track, Vector2D } from '../../types'
import { generateId, formatTime, isMobile } from '../../lib/utils'
import { updateEntityPhysics, applyPlayerControls, applyJoystickControl } from '../../lib/game-engine/physics'
import { checkTrackCollisions, checkCheckpointCollision } from '../../lib/game-engine/collision'
import { updateAIOpponent, generateAIOpponents } from '../../lib/game-engine/ai'

// Track definition (a longer track that takes more time to complete)
const trackWidth = 2000
const trackHeight = 4000
const checkpointRadius = 50

// Egg finish area configuration
const eggPosition = { x: trackWidth / 2, y: trackHeight - 300 }
const eggRadius = 300 // Much larger egg

const track: Track = {
  width: trackWidth,
  height: trackHeight,
  walls: [
    // Outer walls
    { start: { x: 0, y: 0 }, end: { x: trackWidth, y: 0 } },
    { start: { x: trackWidth, y: 0 }, end: { x: trackWidth, y: trackHeight } },
    { start: { x: trackWidth, y: trackHeight }, end: { x: 0, y: trackHeight } },
    { start: { x: 0, y: trackHeight }, end: { x: 0, y: 0 } },
    
    // Inner path walls - create a winding path
    // First section - entry tube
    { start: { x: trackWidth / 2 - 200, y: 0 }, end: { x: trackWidth / 2 - 200, y: 600 } },
    { start: { x: trackWidth / 2 + 200, y: 0 }, end: { x: trackWidth / 2 + 200, y: 600 } },
    
    // Second section - first winding path
    { start: { x: trackWidth / 2 - 200, y: 600 }, end: { x: 300, y: 800 } },
    { start: { x: trackWidth / 2 + 200, y: 600 }, end: { x: trackWidth - 300, y: 800 } },
    { start: { x: 300, y: 800 }, end: { x: 300, y: 1200 } },
    { start: { x: trackWidth - 300, y: 800 }, end: { x: trackWidth - 300, y: 1200 } },
    
    // Third section - narrowing middle section
    { start: { x: 300, y: 1200 }, end: { x: trackWidth / 2 - 150, y: 1600 } },
    { start: { x: trackWidth - 300, y: 1200 }, end: { x: trackWidth / 2 + 150, y: 1600 } },
    { start: { x: trackWidth / 2 - 150, y: 1600 }, end: { x: trackWidth / 2 - 150, y: 2000 } },
    { start: { x: trackWidth / 2 + 150, y: 1600 }, end: { x: trackWidth / 2 + 150, y: 2000 } },
    
    // Fourth section - winding path to egg
    { start: { x: trackWidth / 2 - 150, y: 2000 }, end: { x: trackWidth / 4, y: 2400 } },
    { start: { x: trackWidth / 2 + 150, y: 2000 }, end: { x: trackWidth * 3/4, y: 2400 } },
    { start: { x: trackWidth / 4, y: 2400 }, end: { x: trackWidth / 4, y: 3000 } },
    { start: { x: trackWidth * 3/4, y: 2400 }, end: { x: trackWidth * 3/4, y: 3000 } },
    
    // Final section - path to egg
    { start: { x: trackWidth / 4, y: 3000 }, end: { x: trackWidth / 2 - 200, y: 3500 } },
    { start: { x: trackWidth * 3/4, y: 3000 }, end: { x: trackWidth / 2 + 200, y: 3500 } },
  ],
  checkpoints: [
    // Place checkpoints along the path
    { x: trackWidth / 2, y: 300 },
    { x: trackWidth / 2, y: 700 },
    { x: 500, y: 1000 },
    { x: trackWidth - 500, y: 1000 },
    { x: trackWidth / 2, y: 1800 },
    { x: trackWidth / 3, y: 2200 },
    { x: trackWidth * 2/3, y: 2200 },
    { x: trackWidth / 2, y: 2800 },
    { x: trackWidth / 2, y: 3200 }
  ],
  startLine: {
    start: { x: trackWidth / 2 - 150, y: 150 },
    end: { x: trackWidth / 2 + 150, y: 150 }
  }
}

// Waypoints for AI opponents to follow
const aiWaypoints: Vector2D[] = [
  // Follow the track's path
  { x: trackWidth / 2, y: 300 },
  { x: trackWidth / 2, y: 700 },
  { x: 500, y: 1000 },
  { x: trackWidth - 500, y: 1000 },
  { x: trackWidth / 2, y: 1800 },
  { x: trackWidth / 3, y: 2200 },
  { x: trackWidth * 2/3, y: 2200 },
  { x: trackWidth / 2, y: 2800 },
  { x: trackWidth / 2, y: 3200 },
  { x: trackWidth / 2, y: 3700 } // Final waypoint at the egg
]

export default function Game() {
  const [gameState, setGameState] = useState<GameState>('title')
  const [showJoystick, setShowJoystick] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const [bestTime, setBestTime] = useState<number | null>(null)
  const [playerName, setPlayerName] = useState<string>('')
  const [cameraPosition, setCameraPosition] = useState<Vector2D>({ x: 0, y: 0 })
  const [viewportSize, setViewportSize] = useState<{ width: number, height: number }>({ 
    width: 800, 
    height: 600 
  })
  
  const gameContextRef = useRef<GameContext>({
    canvas: null,
    ctx: null,
    gameState: 'title',
    player: {
      id: generateId(),
      name: 'You',
      position: { x: trackWidth / 2 - 10, y: 150 },
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
  
  // Store tail wave animation data
  const tailWaveRef = useRef<{
    offset: number;
    opponents: Record<string, {
      segments: { x: number, y: number }[];
      lastPositions: { x: number, y: number }[];
    }>;
    player: {
      segments: { x: number, y: number }[];
      lastPositions: { x: number, y: number }[];
    };
  }>({
    offset: 0,
    opponents: {},
    player: {
      segments: Array(8).fill(0).map(() => ({ x: 0, y: 0 })),
      lastPositions: Array(8).fill(0).map(() => ({ x: 0, y: 0 }))
    }
  });
  
  // Initialize tail animation data for new entities
  const initTailData = useCallback((entityId: string) => {
    if (!tailWaveRef.current.opponents[entityId]) {
      tailWaveRef.current.opponents[entityId] = {
        segments: Array(8).fill(0).map(() => ({ x: 0, y: 0 })),
        lastPositions: Array(8).fill(0).map(() => ({ x: 0, y: 0 }))
      };
    }
  }, []);
  
  // Update tail wave animation in the game loop
  const updateTailAnimation = (deltaTime: number) => {
    // Update wave offset for animation - increase speed and amplitude
    tailWaveRef.current.offset += deltaTime * 15; // Faster wiggle
    if (tailWaveRef.current.offset > 100) {
      tailWaveRef.current.offset = 0;
    }
    
    // Update player tail
    const playerPos = gameContextRef.current.player.position;
    const playerCenter = {
      x: playerPos.x + gameContextRef.current.player.width / 2,
      y: playerPos.y + gameContextRef.current.player.height / 2
    };
    
    // Record current position
    tailWaveRef.current.player.lastPositions.unshift({
      x: playerCenter.x,
      y: playerCenter.y
    });
    
    // Keep only the most recent positions - add more segments for longer tail
    if (tailWaveRef.current.player.lastPositions.length > 12) {
      tailWaveRef.current.player.lastPositions.pop();
    }
    
    // Update opponent tails
    gameContextRef.current.opponents.forEach(opponent => {
      initTailData(opponent.id);
      
      const opponentCenter = {
        x: opponent.position.x + opponent.width / 2,
        y: opponent.position.y + opponent.height / 2
      };
      
      // Record current position
      tailWaveRef.current.opponents[opponent.id].lastPositions.unshift({
        x: opponentCenter.x,
        y: opponentCenter.y
      });
      
      // Keep only the most recent positions - add more segments for longer tail
      if (tailWaveRef.current.opponents[opponent.id].lastPositions.length > 12) {
        tailWaveRef.current.opponents[opponent.id].lastPositions.pop();
      }
    });
  };
  
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
    // Use the player's input name or default to "You"
    const name = playerName.trim() || "You"
    
    // Reset player state
    const { player } = gameContextRef.current
    player.name = name
    player.position = { x: trackWidth / 2 - 10, y: 150 }
    player.velocity = { x: 0, y: 0 }
    player.acceleration = { x: 0, y: 0 }
    player.rotation = 0
    player.laps = 0
    player.lapTimes = []
    player.bestLapTime = null
    player.currentLapTime = 0
    
    // Generate AI opponents (7 total)
    gameContextRef.current.opponents = generateAIOpponents(7, 
      { x: trackWidth / 2 + 20, y: 150 }, 
      aiWaypoints
    )
    
    // Reset camera position
    setCameraPosition({ 
      x: player.position.x - viewportSize.width / 2,
      y: player.position.y - viewportSize.height / 3
    })
    
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
  }, [playerName, viewportSize.height, viewportSize.width])
  
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
    
    // Update camera position to follow the player
    if (gameContextRef.current.gameState === 'racing') {
      const player = gameContextRef.current.player
      
      // Calculate target camera position (centered on player with some lookahead)
      const targetCameraX = player.position.x - viewportSize.width / 2 + player.velocity.x * 0.5
      const targetCameraY = player.position.y - viewportSize.height / 2 + player.velocity.y * 0.5
      
      // Smoothly interpolate camera position for a nicer effect
      const cameraLerpFactor = 0.1
      setCameraPosition(prev => ({
        x: prev.x + (targetCameraX - prev.x) * cameraLerpFactor,
        y: prev.y + (targetCameraY - prev.y) * cameraLerpFactor
      }))
    }
    
    // Apply camera transform
    ctx.save()
    ctx.translate(-cameraPosition.x, -cameraPosition.y)
    
    // Update game state based on current state
    switch (gameContextRef.current.gameState) {
      case 'title':
        // Don't apply camera transform for UI screens
        ctx.restore()
        renderTitleScreen(ctx, canvas)
        break
      case 'ready':
        renderTrack(ctx)
        renderEntities(ctx)
        // Draw egg finish area
        renderEggFinishArea(ctx)
        // Reset transform for UI
        ctx.restore()
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
        
        // Update tail animations
        updateTailAnimation(deltaTime)
        
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
          }
        }
        
        // Check if player has reached the egg finish area
        const distanceToEgg = Math.sqrt(
          Math.pow(gameContextRef.current.player.position.x + gameContextRef.current.player.width / 2 - eggPosition.x, 2) +
          Math.pow(gameContextRef.current.player.position.y + gameContextRef.current.player.height / 2 - eggPosition.y, 2)
        )
        
        if (distanceToEgg < eggRadius && nextCheckpointRef.current >= gameContextRef.current.track.checkpoints.length - 1) {
          // Player has reached the egg after passing all checkpoints
          setGameState('finished')
          gameContextRef.current.gameState = 'finished'
          
          // Update best time
          if (bestTime === null || gameContextRef.current.time < bestTime) {
            setBestTime(gameContextRef.current.time)
            gameContextRef.current.bestTime = gameContextRef.current.time
          }
        }
        
        // Render everything
        renderTrack(ctx)
        renderEggFinishArea(ctx)
        renderEntities(ctx)
        
        // Reset transform for UI
        ctx.restore()
        renderHUD(ctx)
        break
      case 'finished':
        renderTrack(ctx)
        renderEggFinishArea(ctx)
        renderEntities(ctx)
        // Reset transform for UI
        ctx.restore()
        renderFinished(ctx, canvas)
        break
      case 'gameOver':
        // Reset transform for UI
        ctx.restore()
        renderGameOver(ctx, canvas)
        break
      default:
        // Reset transform
        ctx.restore()
        break
    }
    
    requestAnimationFrameRef.current = requestAnimationFrame(gameLoop)
  }, [showJoystick, bestTime, cameraPosition, viewportSize.height, viewportSize.width])
  
  // Render the egg finish area
  const renderEggFinishArea = (ctx: CanvasRenderingContext2D) => {
    // Add a glow behind the egg
    const outerGlowRadius = eggRadius * 1.5
    const outerGlowGradient = ctx.createRadialGradient(
      eggPosition.x, eggPosition.y, eggRadius * 0.5,
      eggPosition.x, eggPosition.y, outerGlowRadius
    )
    outerGlowGradient.addColorStop(0, 'rgba(255, 220, 100, 0.4)')
    outerGlowGradient.addColorStop(1, 'rgba(255, 220, 100, 0)')
    
    ctx.fillStyle = outerGlowGradient
    ctx.beginPath()
    ctx.ellipse(
      eggPosition.x, eggPosition.y,
      outerGlowRadius, outerGlowRadius * 1.3,
      0, 0, Math.PI * 2
    )
    ctx.fill()

    // Draw egg shape
    const eggGradient = ctx.createRadialGradient(
      eggPosition.x, eggPosition.y, 0,
      eggPosition.x, eggPosition.y, eggRadius
    )
    eggGradient.addColorStop(0, '#FFFFDD')
    eggGradient.addColorStop(0.7, '#FFDD99')
    eggGradient.addColorStop(1, '#FFCC66')
    
    ctx.fillStyle = eggGradient
    ctx.beginPath()
    
    // Draw an egg shape (more pronounced elongation)
    const verticalRadius = eggRadius * 1.3
    ctx.ellipse(
      eggPosition.x, eggPosition.y,
      eggRadius, verticalRadius,
      0, 0, Math.PI * 2
    )
    ctx.fill()
    
    // Add egg details
    // Outer border
    ctx.strokeStyle = '#FFBB44'
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.ellipse(
      eggPosition.x, eggPosition.y,
      eggRadius, verticalRadius,
      0, 0, Math.PI * 2
    )
    ctx.stroke()
    
    // Internal cell structure - nucleus
    ctx.fillStyle = '#FFFFEE'
    ctx.beginPath()
    ctx.arc(
      eggPosition.x, eggPosition.y - verticalRadius * 0.2,
      eggRadius * 0.4,
      0, Math.PI * 2
    )
    ctx.fill()
    
    // Nucleus border
    ctx.strokeStyle = '#FFCC88'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(
      eggPosition.x, eggPosition.y - verticalRadius * 0.2,
      eggRadius * 0.4,
      0, Math.PI * 2
    )
    ctx.stroke()
    
    // Add pulsing effect to make it more noticeable
    const pulseSize = Math.sin(Date.now() / 500) * 20
    
    // Add "FINISH" text with pulsing effect
    ctx.font = `bold ${36 + pulseSize}px Arial`
    ctx.fillStyle = '#FF6600'
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 2
    ctx.textAlign = 'center'
    ctx.strokeText('FERTILIZE ME!', eggPosition.x, eggPosition.y - verticalRadius - 30)
    ctx.fillText('FERTILIZE ME!', eggPosition.x, eggPosition.y - verticalRadius - 30)
  }
  
  // Render functions
  const renderTrack = (ctx: CanvasRenderingContext2D) => {
    // Draw outer track (representing the fallopian tube)
    const tubeGradient = ctx.createLinearGradient(0, 0, 0, track.height)
    tubeGradient.addColorStop(0, '#FF90B3')  // Lighter pink at top
    tubeGradient.addColorStop(0.5, '#FF6699') // Mid-tone pink in middle
    tubeGradient.addColorStop(1, '#DD5599')   // Darker pink at bottom
    
    ctx.fillStyle = tubeGradient
    ctx.fillRect(0, 0, track.width, track.height)
    
    // Create a tissue-like pattern for the background
    ctx.fillStyle = '#E56B9F' // Slightly darker pink
    for (let x = 0; x < track.width; x += 40) {
      for (let y = 0; y < track.height; y += 40) {
        // Create a more organic pattern with varied sizes
        if ((x + y) % 80 < 20) {
          const size = 10 + Math.sin(x * y * 0.0001) * 5
          ctx.fillRect(x + Math.sin(y * 0.1) * 10, y + Math.cos(x * 0.1) * 10, size, size)
        }
      }
    }
    
    // Add tube folds and texture
    ctx.strokeStyle = '#E05590'
    ctx.lineWidth = 5
    
    // Horizontal folds
    for (let y = 100; y < track.height; y += 150) {
      ctx.beginPath()
      for (let x = 0; x < track.width; x += 50) {
        const yOffset = Math.sin(x * 0.05) * 20
        if (x === 0) {
          ctx.moveTo(x, y + yOffset)
        } else {
          ctx.lineTo(x, y + yOffset)
        }
      }
      ctx.stroke()
    }
    
    // Vertical folds
    for (let x = 100; x < track.width; x += 200) {
      ctx.beginPath()
      for (let y = 0; y < track.height; y += 50) {
        const xOffset = Math.sin(y * 0.03) * 15
        if (y === 0) {
          ctx.moveTo(x + xOffset, y)
        } else {
          ctx.lineTo(x + xOffset, y)
        }
      }
      ctx.stroke()
    }
    
    // Add cell-like structures to the walls
    ctx.fillStyle = 'rgba(255, 150, 180, 0.4)'
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * track.width
      const y = Math.random() * track.height
      const size = 20 + Math.random() * 40
      
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
    }
    
    // Draw the walls
    for (const wall of track.walls) {
      // Create a tube-like appearance for walls
      const wallGradient = ctx.createLinearGradient(
        wall.start.x, wall.start.y, 
        wall.end.x, wall.end.y
      )
      wallGradient.addColorStop(0, '#FF3377')
      wallGradient.addColorStop(0.5, '#DD1155')
      wallGradient.addColorStop(1, '#FF3377')
      
      ctx.strokeStyle = wallGradient
      ctx.lineWidth = 20 // Thicker walls
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(wall.start.x, wall.start.y)
      ctx.lineTo(wall.end.x, wall.end.y)
      ctx.stroke()
      
      // Add a highlight to give depth
      ctx.strokeStyle = 'rgba(255, 180, 200, 0.5)'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(wall.start.x, wall.start.y)
      ctx.lineTo(wall.end.x, wall.end.y)
      ctx.stroke()
    }
    
    // Draw checkpoints
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
    for (let i = 0; i < track.checkpoints.length; i++) {
      const checkpoint = track.checkpoints[i]
      const nextCheckpoint = track.checkpoints[(i + 1) % track.checkpoints.length]
      
      // Highlight the current checkpoint the player needs to reach
      if (i === nextCheckpointRef.current) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
      }
      
      ctx.beginPath()
      ctx.arc(checkpoint.x, checkpoint.y, checkpointRadius, 0, Math.PI * 2)
      ctx.fill()
      
      // Draw line to next checkpoint
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(checkpoint.x, checkpoint.y)
      ctx.lineTo(nextCheckpoint.x, nextCheckpoint.y)
      ctx.stroke()
    }
    
    // Draw checkered start line
    const startX = track.startLine.start.x
    const startY = track.startLine.start.y
    const endX = track.startLine.end.x
    
    // Calculate the length of the start line
    const lineLength = endX - startX
    
    // Determine the size of each square in the checkered pattern
    const squareSize = 10
    
    // Calculate how many squares we need
    const numSquares = Math.floor(lineLength / squareSize)
    
    // Draw the checkered pattern
    for (let i = 0; i < numSquares; i++) {
      // Alternate colors based on position
      if (i % 2 === 0) {
        ctx.fillStyle = '#ffffff' // White
      } else {
        ctx.fillStyle = '#000000' // Black
      }
      
      // Calculate square position
      const squareX = startX + i * squareSize
      
      // Draw the square (slightly taller than the line width for visibility)
      ctx.fillRect(squareX, startY - 8, squareSize, 16)
    }
    
    // Add black outline for the start line
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.strokeRect(startX, startY - 8, lineLength, 16)
    
    // Add "START" text
    ctx.fillStyle = '#fff'
    ctx.font = '14px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('START', (startX + endX) / 2, startY - 15)
  }
  
  const renderEntities = (ctx: CanvasRenderingContext2D) => {
    // Draw AI opponents
    gameContextRef.current.opponents.forEach(opponent => {
      ctx.save();
      
      // Translate to center of opponent
      const centerX = opponent.position.x + opponent.width / 2;
      const centerY = opponent.position.y + opponent.height / 2;
      
      // Calculate head radius once
      const opponentHeadRadius = opponent.width / 1.5;
      
      // Draw name above the opponent
      ctx.font = '10px Arial';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      
      // Draw name background for better readability
      const nameWidth = ctx.measureText(opponent.name).width + 4;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(
        centerX - nameWidth / 2, 
        centerY - opponentHeadRadius * 2.5 - 12, 
        nameWidth, 
        14
      );
      
      // Draw name text
      ctx.fillStyle = opponent.color;
      ctx.fillText(
        opponent.name, 
        centerX, 
        centerY - opponentHeadRadius * 2.5
      );
      
      ctx.translate(centerX, centerY);
      
      // Rotate based on opponent's rotation
      ctx.rotate((opponent.rotation * Math.PI) / 180);
      
      // Draw opponent "sperm" body
      
      // Draw the tail (wiggly)
      ctx.strokeStyle = opponent.color;
      ctx.lineWidth = opponentHeadRadius / 2.5;
      ctx.lineCap = 'round';
      
      // Get position data for this opponent
      const opponentTail = tailWaveRef.current.opponents[opponent.id];
      if (opponentTail && opponentTail.lastPositions.length > 1) {
        const positions = opponentTail.lastPositions;
        
        ctx.beginPath();
        // Start from the back of the head
        ctx.moveTo(-opponentHeadRadius / 2, 0);
        
        // Create a path through previous positions with enhanced wave effect
        for (let i = 0; i < positions.length - 1; i++) {
          // Add a more pronounced sine wave effect to the tail
          const waveAmplitude = opponentHeadRadius / 2 * (1 - i / positions.length); // Increased amplitude
          const wavePhase = tailWaveRef.current.offset + i * 1.8; // More frequency
          const waveY = Math.sin(wavePhase) * waveAmplitude;
          
          // Draw tail segment
          const segmentX = -opponentHeadRadius - (i + 1) * opponentHeadRadius / 2;
          const segmentY = waveY;
          
          ctx.lineTo(segmentX, segmentY);
        }
        
        // Taper the tail width
        ctx.strokeStyle = opponent.color;
        const gradient = ctx.createLinearGradient(-opponentHeadRadius / 2, 0, -opponentHeadRadius * 7, 0);
        gradient.addColorStop(0, opponent.color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = gradient;
        
        ctx.stroke();
      }
      
      // Draw the head (circle)
      const headGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, opponentHeadRadius);
      headGradient.addColorStop(0, opponent.color);
      headGradient.addColorStop(1, shadeColor(opponent.color, -20));
      ctx.fillStyle = headGradient;
      
      ctx.beginPath();
      ctx.arc(0, 0, opponentHeadRadius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
    
    // Draw player
    const player = gameContextRef.current.player;
    ctx.save();
    
    // Translate to center of player
    const playerCenterX = player.position.x + player.width / 2;
    const playerCenterY = player.position.y + player.height / 2;
    
    // Calculate head radius for player
    const playerHeadRadius = player.width / 1.5;
    
    // Draw name above the player
    ctx.font = '10px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    
    // Draw name background for better readability
    const nameWidth = ctx.measureText(player.name || 'You').width + 4;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(
      playerCenterX - nameWidth / 2, 
      playerCenterY - playerHeadRadius * 2.5 - 12, 
      nameWidth, 
      14
    );
    
    // Draw name text
    ctx.fillStyle = player.color;
    ctx.fillText(
      player.name || 'You', 
      playerCenterX, 
      playerCenterY - playerHeadRadius * 2.5
    );
    
    ctx.translate(playerCenterX, playerCenterY);
    
    // Rotate based on player's rotation
    ctx.rotate((player.rotation * Math.PI) / 180);
    
    // Draw player "sperm" with more detailed appearance
    
    // Draw the wiggly tail
    ctx.strokeStyle = player.color;
    ctx.lineWidth = playerHeadRadius / 2.5;
    ctx.lineCap = 'round';
    
    const playerTail = tailWaveRef.current.player;
    if (playerTail.lastPositions.length > 1) {
      const positions = playerTail.lastPositions;
      
      ctx.beginPath();
      // Start from the back of the head
      ctx.moveTo(-playerHeadRadius / 2, 0);
      
      // Create path through previous positions with enhanced wave effect
      for (let i = 0; i < positions.length - 1; i++) {
        // Add a stronger sine wave effect to the tail
        const waveAmplitude = playerHeadRadius / 2 * (1 - i / positions.length); // Increased amplitude
        const wavePhase = tailWaveRef.current.offset + i * 1.8; // More frequency
        const waveY = Math.sin(wavePhase) * waveAmplitude;
        
        // Draw tail segment
        const segmentX = -playerHeadRadius - (i + 1) * playerHeadRadius / 2;
        const segmentY = waveY;
        
        ctx.lineTo(segmentX, segmentY);
      }
      
      // Taper the tail width with gradient - make it longer
      const gradient = ctx.createLinearGradient(-playerHeadRadius / 2, 0, -playerHeadRadius * 7, 0);
      gradient.addColorStop(0, player.color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.strokeStyle = gradient;
      
      ctx.stroke();
    }
    
    // Draw the head (circle) with gradient
    const headGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, playerHeadRadius);
    headGradient.addColorStop(0, player.color);
    headGradient.addColorStop(1, shadeColor(player.color, -20));
    ctx.fillStyle = headGradient;
    
    ctx.beginPath();
    ctx.arc(0, 0, playerHeadRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Add a highlight to the player's head
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(-playerHeadRadius / 5, -playerHeadRadius / 5, playerHeadRadius / 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  };
  
  const renderHUD = (ctx: CanvasRenderingContext2D) => {
    // Draw semi-transparent background for better readability
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, 160, 100)
    
    ctx.fillStyle = '#fff'
    ctx.font = '16px Arial'
    ctx.textAlign = 'left'
    
    // Draw lap counter
    ctx.fillText(`Lap: ${gameContextRef.current.player.laps + 1}/3`, 10, 25)
    
    // Draw timer
    ctx.fillText(`Time: ${formatTime(gameContextRef.current.time)}`, 10, 50)
    
    // Draw current lap time
    ctx.fillText(`Lap Time: ${formatTime(gameContextRef.current.player.currentLapTime)}`, 10, 75)
    
    // Draw best lap time if available
    if (gameContextRef.current.player.bestLapTime !== null) {
      ctx.fillRect(0, 100, 160, 25)
      ctx.fillStyle = '#FFFF00' // Yellow for best time
      ctx.fillText(`Best Lap: ${formatTime(gameContextRef.current.player.bestLapTime)}`, 10, 120)
    }
    
    // Add position indicator (simplified)
    const positions = [...gameContextRef.current.opponents, gameContextRef.current.player]
      .sort((a, b) => b.laps - a.laps)
    
    const playerRank = positions.findIndex(entity => entity.id === gameContextRef.current.player.id) + 1
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(track.width - 80, 0, 80, 40)
    ctx.fillStyle = playerRank === 1 ? '#FFD700' : '#fff' // Gold for 1st place
    ctx.font = '18px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${playerRank}${getRankSuffix(playerRank)} Place`, track.width - 40, 25)
  }
  
  // Helper function for rank suffixes
  const getRankSuffix = (rank: number): string => {
    if (rank === 1) return 'st'
    if (rank === 2) return 'nd'
    if (rank === 3) return 'rd'
    return 'th'
  }
  
  const renderTitleScreen = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const width = canvas.width / window.devicePixelRatio
    const height = canvas.height / window.devicePixelRatio
    
    // Create a background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, '#FF90B3')  // Pink color at top
    gradient.addColorStop(1, '#FF5C8D')  // Darker pink color at bottom
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    
    // Add some swimming "sperm" particles in the background
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const size = 3 + Math.random() * 7
      
      // Draw small swimming sperm cells
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
      
      // Draw tail
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x - size, y)
      
      // Wavy tail
      for (let j = 1; j <= 5; j++) {
        const amplitude = size / 2
        const offset = j % 2 === 0 ? amplitude : -amplitude
        ctx.lineTo(x - size - j * size * 1.5, y + offset)
      }
      
      ctx.stroke()
    }
    
    // Add title text
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 48px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('SPERM RACER', width / 2, height / 4)
    
    // Add subtitle
    ctx.font = '24px Arial'
    ctx.fillText('The Race to Fertilization', width / 2, height / 4 + 40)
    
    // Add name input instruction
    ctx.font = '20px Arial'
    ctx.fillText('Enter your name:', width / 2, height / 2 - 40)
    
    // Draw a stylized input box
    const inputBoxWidth = 250
    const inputBoxHeight = 40
    const inputBoxX = width / 2 - inputBoxWidth / 2
    const inputBoxY = height / 2 - 20
    
    // Draw input box shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.fillRect(inputBoxX + 3, inputBoxY + 3, inputBoxWidth, inputBoxHeight)
    
    // Draw input box
    ctx.fillStyle = '#fff'
    ctx.fillRect(inputBoxX, inputBoxY, inputBoxWidth, inputBoxHeight)
    
    // Draw input box border
    ctx.strokeStyle = '#FF5C8D'
    ctx.lineWidth = 2
    ctx.strokeRect(inputBoxX, inputBoxY, inputBoxWidth, inputBoxHeight)
    
    // Draw player name
    ctx.fillStyle = '#000'
    ctx.textAlign = 'left'
    ctx.font = '18px Arial'
    ctx.fillText(playerName + (Math.floor(Date.now() / 500) % 2 === 0 ? '|' : ''), inputBoxX + 10, inputBoxY + 25)
    
    // Add start instructions
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.textAlign = 'center'
    ctx.font = '20px Arial'
    
    if (isMobile()) {
      ctx.fillText('Tap to Start', width / 2, height / 2 + 80)
      ctx.font = '16px Arial'
      ctx.fillText('Use the joystick to control', width / 2, height / 2 + 110)
    } else {
      ctx.fillText('Press SPACE to start', width / 2, height / 2 + 80)
      ctx.font = '16px Arial'
      ctx.fillText('Use arrow keys or WASD to control', width / 2, height / 2 + 110)
    }
    
    // Add best time if available
    if (bestTime) {
      ctx.fillStyle = '#FFD700'  // Gold color
      ctx.font = 'bold 18px Arial'
      ctx.fillText(`Best Time: ${formatTime(bestTime)}`, width / 2, height / 2 + 150)
    }
    
    // Add game instructions
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.font = '14px Arial'
    ctx.fillText('Race through the checkpoints', width / 2, height - 60)
    ctx.fillText('Reach the egg at the end to win!', width / 2, height - 40)
  }
  
  const renderCountdown = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const width = canvas.width / window.devicePixelRatio
    const height = canvas.height / window.devicePixelRatio
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(0, 0, width, height)
    
    // Draw the countdown number with animation effect
    ctx.fillStyle = '#fff'
    const fontSize = 84 + Math.sin(performance.now() / 200) * 10 // Pulsing animation
    ctx.font = `bold ${fontSize}px Arial`
    ctx.textAlign = 'center'
    ctx.fillText(countdown.toString(), width / 2, height / 2)
    
    // Add some text
    ctx.font = '24px Arial'
    ctx.fillText(countdown > 0 ? 'Get Ready...' : 'GO!', width / 2, height / 2 + 60)
  }
  
  const renderFinished = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const width = canvas.width / window.devicePixelRatio
    const height = canvas.height / window.devicePixelRatio
    
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(0, 0, width, height)
    
    // Create a light ray effect behind the text
    const centerX = width / 2
    const centerY = height / 3
    const outerRadius = Math.max(width, height)
    
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerRadius)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)')
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.1)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    
    // Main title
    ctx.fillStyle = '#fff'
    const titleText = gameContextRef.current.bestTime !== null && 
                     gameContextRef.current.time <= gameContextRef.current.bestTime
                     ? 'NEW RECORD!' 
                     : 'RACE COMPLETE!'
    
    ctx.font = 'bold 48px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(titleText, width / 2, height / 3)
    
    // Create a stylized box for the time
    const boxWidth = 300
    const boxHeight = 80
    const boxX = width / 2 - boxWidth / 2
    const boxY = height / 2 - boxHeight / 2
    
    // Box shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(boxX + 5, boxY + 5, boxWidth, boxHeight)
    
    // Box background
    const boxGradient = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxHeight)
    boxGradient.addColorStop(0, '#FF90B3')
    boxGradient.addColorStop(1, '#FF5C8D')
    ctx.fillStyle = boxGradient
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight)
    
    // Box border
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight)
    
    // Final time text
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 32px Arial'
    ctx.fillText(`Time: ${formatTime(gameContextRef.current.time)}`, width / 2, height / 2 + 15)
    
    // Add best time information if available
    if (gameContextRef.current.bestTime !== null) {
      ctx.font = '18px Arial'
      ctx.fillStyle = '#FFD700' // Gold for best time
      ctx.fillText(`Best: ${formatTime(gameContextRef.current.bestTime)}`, width / 2, height / 2 + 60)
    }
    
    // Restart prompt
    ctx.fillStyle = '#fff'
    ctx.font = '20px Arial'
    
    if (isMobile()) {
      ctx.fillText('Tap to restart', width / 2, height - 60)
    } else {
      ctx.fillText('Press SPACE to restart', width / 2, height - 60)
    }
  }
  
  const renderGameOver = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const width = canvas.width / window.devicePixelRatio
    const height = canvas.height / window.devicePixelRatio
    
    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(0, 0, width, height)
    
    // Game over text
    ctx.fillStyle = '#FF5C8D'
    ctx.font = 'bold 60px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('GAME OVER', width / 2, height / 3)
    
    // Add some context
    ctx.fillStyle = '#fff'
    ctx.font = '24px Arial'
    ctx.fillText('Your journey ends here', width / 2, height / 2)
    
    // Restart prompt
    ctx.font = '20px Arial'
    if (isMobile()) {
      ctx.fillText('Tap to try again', width / 2, height / 2 + 80)
    } else {
      ctx.fillText('Press SPACE to try again', width / 2, height / 2 + 80)
    }
  }
  
  // Helper function to darken/lighten colors
  const shadeColor = (color: string, percent: number): string => {
    if (color.startsWith('#')) {
      let R = parseInt(color.substring(1, 3), 16);
      let G = parseInt(color.substring(3, 5), 16);
      let B = parseInt(color.substring(5, 7), 16);

      R = Math.floor(R * (100 + percent) / 100);
      G = Math.floor(G * (100 + percent) / 100);
      B = Math.floor(B * (100 + percent) / 100);

      R = (R < 255) ? R : 255;
      G = (G < 255) ? G : 255;
      B = (B < 255) ? B : 255;

      R = (R > 0) ? R : 0;
      G = (G > 0) ? G : 0;
      B = (B > 0) ? B : 0;

      return `#${(R.toString(16).padStart(2, '0'))
        }${G.toString(16).padStart(2, '0')
        }${B.toString(16).padStart(2, '0')}`;
    } else {
      return color;
    }
  };
  
  // Handle name input
  const handleNameInput = useCallback((e: KeyboardEvent) => {
    if (gameContextRef.current.gameState !== 'title') return
    
    if (e.key === 'Backspace') {
      setPlayerName(prev => prev.slice(0, -1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      startGame()
    } else if (e.key.length === 1 && playerName.length < 15) {
      setPlayerName(prev => prev + e.key)
    }
  }, [playerName, startGame])

  // Handle touch for mobile devices
  const handleTouch = useCallback(() => {
    if (gameContextRef.current.gameState === 'title') {
      startGame()
    } else if (gameContextRef.current.gameState === 'gameOver' || gameContextRef.current.gameState === 'finished') {
      setGameState('title')
      gameContextRef.current.gameState = 'title'
    }
  }, [startGame])

  // Update viewport size on window resize
  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: Math.min(800, window.innerWidth),
        height: Math.min(600, window.innerHeight)
      })
    }
    
    // Set initial size
    handleResize()
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  // Setup event listeners and game loop
  useEffect(() => {
    // Check if on mobile and show joystick if needed
    setShowJoystick(isMobile())
    
    // Add event listeners for keyboard controls
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('keypress', handleNameInput)
    
    // Start game loop
    requestAnimationFrameRef.current = requestAnimationFrame(gameLoop)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('keypress', handleNameInput)
      cancelAnimationFrame(requestAnimationFrameRef.current)
    }
  }, [gameLoop, handleKeyDown, handleKeyUp, handleNameInput])
  
  return (
    <div 
      className="flex items-center justify-center min-h-screen"
      onClick={handleTouch}
    >
      <div className="relative">
        <Canvas 
          width={viewportSize.width} 
          height={viewportSize.height} 
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