'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Canvas from './Canvas'
import Joystick from './Joystick'
import { GameContext, GameState, Track, Vector2D, PowerUp } from '../../types'
import { generateId, formatTime, isMobile, generateAvatarUrl } from '../../lib/utils'
import { updateEntityPhysics, applyPlayerControls, applyJoystickControl } from '../../lib/game-engine/physics'
import { checkTrackCollisions } from '../../lib/game-engine/collision'
import { updateAIOpponent, generateAIOpponents } from '../../lib/game-engine/ai'

// Track definition (a longer track that takes more time to complete)
const trackWidth = 2000
const trackHeight = 6000 // Even longer track
const checkpointRadius = 50

// Egg finish area configuration
const eggPosition = { x: trackWidth / 2, y: trackHeight - 300 }
const eggRadius = 300 // Much larger egg

// Power-up configuration
const powerUpRadius = 25
const boostDuration = 3000 // 3 seconds of speed boost
const slowdownDuration = 5000 // 5 seconds of slowdown
const powerUpRespawnTime = 10000 // 10 seconds to respawn

// Create a narrower, curved track with clear boundaries
const track: Track = {
  width: trackWidth,
  height: trackHeight,
  walls: [
    // Outer walls
    { start: { x: 0, y: 0 }, end: { x: trackWidth, y: 0 } },
    { start: { x: trackWidth, y: 0 }, end: { x: trackWidth, y: trackHeight } },
    { start: { x: trackWidth, y: trackHeight }, end: { x: 0, y: trackHeight } },
    { start: { x: 0, y: trackHeight }, end: { x: 0, y: 0 } },
    
    // Entry tube - narrower
    { start: { x: trackWidth / 2 - 100, y: 0 }, end: { x: trackWidth / 2 - 100, y: 500 } },
    { start: { x: trackWidth / 2 + 100, y: 0 }, end: { x: trackWidth / 2 + 100, y: 500 } },
    
    // First curve - right turn
    { start: { x: trackWidth / 2 - 100, y: 500 }, end: { x: trackWidth - 300, y: 800 } },
    { start: { x: trackWidth / 2 + 100, y: 500 }, end: { x: trackWidth - 150, y: 900 } },
    
    // Path along right side
    { start: { x: trackWidth - 300, y: 800 }, end: { x: trackWidth - 300, y: 1500 } },
    { start: { x: trackWidth - 150, y: 900 }, end: { x: trackWidth - 150, y: 1500 } },
    
    // Second curve - left turn
    { start: { x: trackWidth - 300, y: 1500 }, end: { x: trackWidth / 2, y: 1800 } },
    { start: { x: trackWidth - 150, y: 1500 }, end: { x: trackWidth / 2 + 100, y: 1900 } },
    
    // Center path
    { start: { x: trackWidth / 2, y: 1800 }, end: { x: trackWidth / 2, y: 2500 } },
    { start: { x: trackWidth / 2 + 100, y: 1900 }, end: { x: trackWidth / 2 + 200, y: 2500 } },
    
    // Third curve - left turn
    { start: { x: trackWidth / 2, y: 2500 }, end: { x: 300, y: 2800 } },
    { start: { x: trackWidth / 2 + 200, y: 2500 }, end: { x: 450, y: 2900 } },
    
    // Path along left side
    { start: { x: 300, y: 2800 }, end: { x: 300, y: 3500 } },
    { start: { x: 450, y: 2900 }, end: { x: 450, y: 3500 } },
    
    // Fourth curve - right turn
    { start: { x: 300, y: 3500 }, end: { x: trackWidth / 2 - 150, y: 3800 } },
    { start: { x: 450, y: 3500 }, end: { x: trackWidth / 2 - 50, y: 3900 } },
    
    // Path to loop
    { start: { x: trackWidth / 2 - 150, y: 3800 }, end: { x: trackWidth / 2 - 150, y: 4300 } },
    { start: { x: trackWidth / 2 - 50, y: 3900 }, end: { x: trackWidth / 2 - 50, y: 4300 } },
    
    // Loop start
    { start: { x: trackWidth / 2 - 150, y: 4300 }, end: { x: trackWidth / 2 - 300, y: 4500 } },
    { start: { x: trackWidth / 2 - 50, y: 4300 }, end: { x: trackWidth / 2 + 300, y: 4500 } },
    
    // Loop lower part
    { start: { x: trackWidth / 2 - 300, y: 4500 }, end: { x: trackWidth / 2 - 300, y: 4700 } },
    { start: { x: trackWidth / 2 + 300, y: 4500 }, end: { x: trackWidth / 2 + 300, y: 4700 } },
    
    // Loop end
    { start: { x: trackWidth / 2 - 300, y: 4700 }, end: { x: trackWidth / 2 - 150, y: 4900 } },
    { start: { x: trackWidth / 2 + 300, y: 4700 }, end: { x: trackWidth / 2 + 150, y: 4900 } },
    
    // Final stretch to egg
    { start: { x: trackWidth / 2 - 150, y: 4900 }, end: { x: trackWidth / 2 - 250, y: 5500 } },
    { start: { x: trackWidth / 2 + 150, y: 4900 }, end: { x: trackWidth / 2 + 250, y: 5500 } },
  ],
  checkpoints: [
    // Place checkpoints along the path
    { x: trackWidth / 2, y: 300 },
    { x: trackWidth - 225, y: 1100 },
    { x: trackWidth / 2 + 100, y: 2200 },
    { x: 375, y: 3200 },
    { x: trackWidth / 2 - 100, y: 4100 },
    { x: trackWidth / 2, y: 4600 },
    { x: trackWidth / 2, y: 5200 }
  ],
  startLine: {
    start: { x: trackWidth / 2 - 100, y: 100 },
    end: { x: trackWidth / 2 + 100, y: 100 }
  }
}

// Waypoints for AI opponents to follow - follow the track's center path
const aiWaypoints: Vector2D[] = [
  { x: trackWidth / 2, y: 300 },
  { x: trackWidth - 225, y: 1100 },
  { x: trackWidth / 2 + 100, y: 2200 },
  { x: 375, y: 3200 },
  { x: trackWidth / 2 - 100, y: 4100 },
  { x: trackWidth / 2, y: 4600 },
  { x: trackWidth / 2, y: 5200 },
  { x: trackWidth / 2, y: 5700 } // Final waypoint at the egg
]

// Generate power-ups
function generatePowerUps(): PowerUp[] {
  const powerUps: PowerUp[] = []
  
  // Speed boost pills (blue) - place along the track
  const boostPositions = [
    { x: trackWidth / 2, y: 700 },
    { x: trackWidth - 225, y: 1300 },
    { x: trackWidth / 2 + 100, y: 2000 },
    { x: 375, y: 3000 },
    { x: trackWidth / 2 - 100, y: 3700 },
    { x: trackWidth / 2 - 200, y: 4600 },
    { x: trackWidth / 2 + 200, y: 4600 },
    { x: trackWidth / 2, y: 5000 }
  ]
  
  // Slowdown pills (white) - place at challenging spots
  const slowdownPositions = [
    { x: trackWidth - 225, y: 900 },
    { x: trackWidth / 2 + 150, y: 1700 },
    { x: trackWidth / 2 + 100, y: 2300 },
    { x: 375, y: 3300 },
    { x: trackWidth / 2 - 100, y: 4000 },
    { x: trackWidth / 2, y: 4500 },
    { x: trackWidth / 2, y: 4700 },
    { x: trackWidth / 2, y: 5100 }
  ]
  
  // Create speed boost power-ups
  boostPositions.forEach((pos, index) => {
    powerUps.push({
      id: `boost-${index}`,
      position: pos,
      type: 'boost',
      radius: powerUpRadius,
      collected: false,
      respawnTime: 0
    })
  })
  
  // Create slowdown power-ups
  slowdownPositions.forEach((pos, index) => {
    powerUps.push({
      id: `slowdown-${index}`,
      position: pos,
      type: 'slowdown',
      radius: powerUpRadius,
      collected: false,
      respawnTime: 0
    })
  })
  
  return powerUps
}

export default function Game() {
  const [gameState, setGameState] = useState<GameState>('title')
  const [showJoystick, setShowJoystick] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const [bestTime, setBestTime] = useState<number | null>(null)
  const [playerName, setPlayerName] = useState<string>('')
  const [nameInputActive, setNameInputActive] = useState(false)
  const [cameraPosition, setCameraPosition] = useState<Vector2D>({ x: 0, y: 0 })
  const [viewportSize, setViewportSize] = useState<{ width: number, height: number }>({ 
    width: 800, 
    height: 600 
  })
  const [leaderboard, setLeaderboard] = useState<{name: string, time: number}[]>([])
  const [checkpointsPassed, setCheckpointsPassed] = useState<boolean[]>([])
  const [characterImages, setCharacterImages] = useState<Record<string, HTMLImageElement | null>>({})
  
  // Input field reference
  const nameInputRef = useRef<HTMLInputElement>(null)
  
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
      currentLapTime: 0,
      speedBoostTime: 0,
      slowDownTime: 0
    },
    opponents: [],
    track,
    powerUps: generatePowerUps(),
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
        if (gameContextRef.current.gameState === 'title') {
          setGameState('nameEntry')
          gameContextRef.current.gameState = 'nameEntry'
          setTimeout(() => setNameInputActive(true), 100)
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
    player.position = { x: trackWidth / 2 - 10, y: 150 }
    player.velocity = { x: 0, y: 0 }
    player.acceleration = { x: 0, y: 0 }
    player.rotation = 0
    player.laps = 0
    player.lapTimes = []
    player.bestLapTime = null
    player.currentLapTime = 0
    player.speedBoostTime = 0
    player.slowDownTime = 0
    
    // Generate AI opponents (7 total)
    gameContextRef.current.opponents = generateAIOpponents(7, 
      { x: trackWidth / 2 + 20, y: 150 }, 
      aiWaypoints
    )
    
    // Add speed boost and slowdown properties to opponents
    gameContextRef.current.opponents.forEach(opponent => {
      opponent.speedBoostTime = 0
      opponent.slowDownTime = 0
    })
    
    // Reset camera position
    setCameraPosition({ 
      x: player.position.x - viewportSize.width / 2,
      y: player.position.y - viewportSize.height / 3
    })
    
    // Reset game state
    setCountdown(3)
    gameContextRef.current.countdown = 3
    gameContextRef.current.time = 0
    
    // Reset checkpoint tracking
    nextCheckpointRef.current = 0
    setCheckpointsPassed(Array(track.checkpoints.length).fill(false))
    
    // Reset power-ups
    gameContextRef.current.powerUps = generatePowerUps()
    
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
  }, [viewportSize.height, viewportSize.width])
  
  // Start game after name entry
  const handleNameSubmit = useCallback(() => {
    const name = playerName.trim() || "Player"
    gameContextRef.current.player.name = name
    setGameState('ready')
    gameContextRef.current.gameState = 'ready'
    startGame()
  }, [playerName, startGame])
  
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
      case 'nameEntry':
        // Don't apply camera transform for UI screens
        ctx.restore()
        renderNameEntryScreen(ctx, canvas)
        break
      case 'ready':
        renderTrack(ctx)
        renderPowerUps(ctx)
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
        
        // Apply speed modifications from power-ups for player
        if (gameContextRef.current.player.speedBoostTime > 0) {
          gameContextRef.current.player.speedBoostTime -= deltaTime * 1000
          gameContextRef.current.player.maxSpeed = 450 // Boosted speed
        } else if (gameContextRef.current.player.slowDownTime > 0) {
          gameContextRef.current.player.slowDownTime -= deltaTime * 1000
          gameContextRef.current.player.maxSpeed = 150 // Slowed speed
        } else {
          gameContextRef.current.player.maxSpeed = 300 // Normal speed
        }
        
        updateEntityPhysics(gameContextRef.current.player, deltaTime)
        
        // Check collisions with track
        checkTrackCollisions(gameContextRef.current.player, gameContextRef.current.track)
        
        // Update AI opponents
        gameContextRef.current.opponents.forEach(opponent => {
          // Apply speed modifications from power-ups for AI
          if (opponent.speedBoostTime > 0) {
            opponent.speedBoostTime -= deltaTime * 1000
            opponent.maxSpeed = 350 // Boosted speed (slightly less than player)
          } else if (opponent.slowDownTime > 0) {
            opponent.slowDownTime -= deltaTime * 1000
            opponent.maxSpeed = 150 // Slowed speed
          } else {
            // Set normal speed based on opponent type
            if (opponent.name === 'Balaji' || opponent.name === 'Donovan') {
              opponent.maxSpeed = 350; // Fast opponents
            } else if (opponent.name === 'Dizzy' || opponent.name === 'Confused') {
              opponent.maxSpeed = 200; // Slow special behavior opponents
            } else {
              opponent.maxSpeed = 300; // Normal speed
            }
          }
          
          updateAIOpponent(opponent, deltaTime)
          updateEntityPhysics(opponent, deltaTime)
          checkTrackCollisions(opponent, gameContextRef.current.track)
        })
        
        // Update power-ups
        updatePowerUps(deltaTime)
        
        // Update tail animations
        updateTailAnimation(deltaTime)
        
        // Check checkpoints - make them mandatory
        const currentCheckpoint = gameContextRef.current.track.checkpoints[nextCheckpointRef.current]
        
        // Check if player reached the current checkpoint
        const distanceToCheckpoint = Math.sqrt(
          Math.pow(gameContextRef.current.player.position.x + gameContextRef.current.player.width / 2 - currentCheckpoint.x, 2) +
          Math.pow(gameContextRef.current.player.position.y + gameContextRef.current.player.height / 2 - currentCheckpoint.y, 2)
        )
        
        if (distanceToCheckpoint < checkpointRadius) {
          // Mark the checkpoint as passed
          const newCheckpointsPassed = [...checkpointsPassed];
          newCheckpointsPassed[nextCheckpointRef.current] = true;
          setCheckpointsPassed(newCheckpointsPassed);
          
          // Move to next checkpoint
          nextCheckpointRef.current = (nextCheckpointRef.current + 1) % gameContextRef.current.track.checkpoints.length
          
          // If we've completed a lap
          if (nextCheckpointRef.current === 0) {
            // Check if all checkpoints were passed
            if (newCheckpointsPassed.every(passed => passed)) {
              gameContextRef.current.player.laps++
              gameContextRef.current.player.lapTimes.push(gameContextRef.current.player.currentLapTime)
              
              // Update best lap time
              if (gameContextRef.current.player.bestLapTime === null || 
                  gameContextRef.current.player.currentLapTime < gameContextRef.current.player.bestLapTime) {
                gameContextRef.current.player.bestLapTime = gameContextRef.current.player.currentLapTime
              }
              
              // Reset current lap time and checkpoint tracking
              gameContextRef.current.player.currentLapTime = 0
              setCheckpointsPassed(Array(track.checkpoints.length).fill(false))
            } else {
              // Player tried to skip checkpoints, don't count this lap
              // Send them back to first checkpoint
              nextCheckpointRef.current = 0
              setCheckpointsPassed(Array(track.checkpoints.length).fill(false))
            }
          }
        }
        
        // Check if player has reached the egg finish area
        const distanceToEgg = Math.sqrt(
          Math.pow(gameContextRef.current.player.position.x + gameContextRef.current.player.width / 2 - eggPosition.x, 2) +
          Math.pow(gameContextRef.current.player.position.y + gameContextRef.current.player.height / 2 - eggPosition.y, 2)
        )
        
        if (distanceToEgg < eggRadius && checkpointsPassed.every(passed => passed)) {
          // Player has reached the egg after passing all checkpoints
          setGameState('finished')
          gameContextRef.current.gameState = 'finished'
          
          // Update best time
          if (bestTime === null || gameContextRef.current.time < bestTime) {
            setBestTime(gameContextRef.current.time)
            gameContextRef.current.bestTime = gameContextRef.current.time
          }
          
          // Update leaderboard
          const newEntry = {
            name: gameContextRef.current.player.name || "Player",
            time: gameContextRef.current.time
          }
          
          // Update leaderboard
          const newLeaderboard = [...leaderboard, newEntry]
            .sort((a, b) => a.time - b.time)
            .slice(0, 10); // Keep only top 10
            
          setLeaderboard(newLeaderboard);
        }
        
        // Render everything
        renderTrack(ctx)
        renderPowerUps(ctx)
        renderEggFinishArea(ctx)
        renderEntities(ctx)
        
        // Reset transform for UI
        ctx.restore()
        renderHUD(ctx)
        break
      case 'finished':
        renderTrack(ctx)
        renderPowerUps(ctx)
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
  }, [showJoystick, bestTime, cameraPosition, viewportSize.height, viewportSize.width, checkpointsPassed, leaderboard])
  
  // Update power-ups (respawn collected ones)
  const updatePowerUps = (deltaTime: number) => {
    const { player, opponents, powerUps } = gameContextRef.current
    
    powerUps.forEach(powerUp => {
      // If already collected, update respawn timer
      if (powerUp.collected) {
        powerUp.respawnTime -= deltaTime * 1000
        if (powerUp.respawnTime <= 0) {
          powerUp.collected = false
        }
        return
      }
      
      // Check collision with player
      const distanceToPlayer = Math.sqrt(
        Math.pow(player.position.x + player.width / 2 - powerUp.position.x, 2) +
        Math.pow(player.position.y + player.height / 2 - powerUp.position.y, 2)
      )
      
      if (distanceToPlayer < powerUp.radius + player.width / 2) {
        // Collect power-up
        powerUp.collected = true
        powerUp.respawnTime = powerUpRespawnTime
        
        // Apply effect
        if (powerUp.type === 'boost') {
          player.speedBoostTime = boostDuration
          player.slowDownTime = 0 // Cancel any slowdown effect
        } else if (powerUp.type === 'slowdown') {
          player.slowDownTime = slowdownDuration
          player.speedBoostTime = 0 // Cancel any boost effect
        }
      }
      
      // Check collision with AI opponents
      opponents.forEach(opponent => {
        const distanceToOpponent = Math.sqrt(
          Math.pow(opponent.position.x + opponent.width / 2 - powerUp.position.x, 2) +
          Math.pow(opponent.position.y + opponent.height / 2 - powerUp.position.y, 2)
        )
        
        if (distanceToOpponent < powerUp.radius + opponent.width / 2) {
          // Collect power-up
          powerUp.collected = true
          powerUp.respawnTime = powerUpRespawnTime
          
          // Apply effect
          if (powerUp.type === 'boost') {
            opponent.speedBoostTime = boostDuration
            opponent.slowDownTime = 0 // Cancel any slowdown effect
          } else if (powerUp.type === 'slowdown') {
            opponent.slowDownTime = slowdownDuration
            opponent.speedBoostTime = 0 // Cancel any boost effect
          }
        }
      })
    })
  }
  
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
      ctx.save()
      
      // Translate to center of opponent
      const centerX = opponent.position.x + opponent.width / 2
      const centerY = opponent.position.y + opponent.height / 2
      
      // Calculate head radius once
      const opponentHeadRadius = opponent.width / 1.5
      
      // Draw name above the opponent
      ctx.font = '10px Arial'
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      
      // Draw name background for better readability
      const nameWidth = ctx.measureText(opponent.name).width + 4
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fillRect(
        centerX - nameWidth / 2, 
        centerY - opponentHeadRadius * 2.5 - 12, 
        nameWidth, 
        14
      )
      
      // Draw name text
      ctx.fillStyle = opponent.color
      ctx.fillText(
        opponent.name, 
        centerX, 
        centerY - opponentHeadRadius * 2.5
      )
      
      ctx.translate(centerX, centerY)
      
      // Rotate based on opponent's rotation
      ctx.rotate((opponent.rotation * Math.PI) / 180)
      
      // Draw opponent "sperm" body
      
      // Draw the tail (wiggly)
      ctx.strokeStyle = opponent.color
      ctx.lineWidth = opponentHeadRadius / 2.5
      ctx.lineCap = 'round'
      
      // Get position data for this opponent
      const opponentTail = tailWaveRef.current.opponents[opponent.id]
      if (opponentTail && opponentTail.lastPositions.length > 1) {
        const positions = opponentTail.lastPositions
        
        ctx.beginPath()
        // Start from the back of the head
        ctx.moveTo(-opponentHeadRadius / 2, 0)
        
        // Create a path through previous positions with enhanced wave effect
        for (let i = 0; i < positions.length - 1; i++) {
          // Add a more pronounced sine wave effect to the tail
          const waveAmplitude = opponentHeadRadius / 2 * (1 - i / positions.length) // Increased amplitude
          const wavePhase = tailWaveRef.current.offset + i * 1.8 // More frequency
          const waveY = Math.sin(wavePhase) * waveAmplitude
          
          // Draw tail segment
          const segmentX = -opponentHeadRadius - (i + 1) * opponentHeadRadius / 2
          const segmentY = waveY
          
          ctx.lineTo(segmentX, segmentY)
        }
        
        // Taper the tail width
        ctx.strokeStyle = opponent.color
        const gradient = ctx.createLinearGradient(-opponentHeadRadius / 2, 0, -opponentHeadRadius * 7, 0)
        gradient.addColorStop(0, opponent.color)
        gradient.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.strokeStyle = gradient
        
        ctx.stroke()
      }
      
      // Check if we have an image for this opponent
      const characterImage = characterImages[opponent.name]
      
      if (characterImage) {
        // Draw the character image as the head
        const imgSize = opponentHeadRadius * 2
        ctx.drawImage(
          characterImage,
          -opponentHeadRadius, // x position centered
          -opponentHeadRadius, // y position centered
          imgSize,
          imgSize
        )
      } else {
        // Fallback to drawing a circle if image not loaded
        const headGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, opponentHeadRadius)
        headGradient.addColorStop(0, opponent.color)
        headGradient.addColorStop(1, shadeColor(opponent.color, -20))
        ctx.fillStyle = headGradient
        
        ctx.beginPath()
        ctx.arc(0, 0, opponentHeadRadius, 0, Math.PI * 2)
        ctx.fill()
      }
      
      ctx.restore()
    })
    
    // Draw player
    const player = gameContextRef.current.player
    ctx.save()
    
    // Translate to center of player
    const playerCenterX = player.position.x + player.width / 2
    const playerCenterY = player.position.y + player.height / 2
    
    // Calculate head radius for player
    const playerHeadRadius = player.width / 1.5
    
    // Draw name above the player
    ctx.font = '10px Arial'
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    
    // Draw name background for better readability
    const nameWidth = ctx.measureText(player.name || 'You').width + 4
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(
      playerCenterX - nameWidth / 2, 
      playerCenterY - playerHeadRadius * 2.5 - 12, 
      nameWidth, 
      14
    )
    
    // Draw name text
    ctx.fillStyle = player.color
    ctx.fillText(
      player.name || 'You', 
      playerCenterX, 
      playerCenterY - playerHeadRadius * 2.5
    )
    
    ctx.translate(playerCenterX, playerCenterY)
    
    // Rotate based on player's rotation
    ctx.rotate((player.rotation * Math.PI) / 180)
    
    // Draw player "sperm" with more detailed appearance
    
    // Draw the wiggly tail
    ctx.strokeStyle = player.color
    ctx.lineWidth = playerHeadRadius / 2.5
    ctx.lineCap = 'round'
    
    const playerTail = tailWaveRef.current.player
    if (playerTail.lastPositions.length > 1) {
      const positions = playerTail.lastPositions
      
      ctx.beginPath()
      // Start from the back of the head
      ctx.moveTo(-playerHeadRadius / 2, 0)
      
      // Create path through previous positions with enhanced wave effect
      for (let i = 0; i < positions.length - 1; i++) {
        // Add a stronger sine wave effect to the tail
        const waveAmplitude = playerHeadRadius / 2 * (1 - i / positions.length) // Increased amplitude
        const wavePhase = tailWaveRef.current.offset + i * 1.8 // More frequency
        const waveY = Math.sin(wavePhase) * waveAmplitude
        
        // Draw tail segment
        const segmentX = -playerHeadRadius - (i + 1) * playerHeadRadius / 2
        const segmentY = waveY
        
        ctx.lineTo(segmentX, segmentY)
      }
      
      // Taper the tail width with gradient - make it longer
      const gradient = ctx.createLinearGradient(-playerHeadRadius / 2, 0, -playerHeadRadius * 7, 0)
      gradient.addColorStop(0, player.color)
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.strokeStyle = gradient
      
      ctx.stroke()
    }
    
    // Check if we have a player image
    const playerImage = characterImages['You']
    
    if (playerImage) {
      // Draw the player image as the head
      const imgSize = playerHeadRadius * 2
      ctx.drawImage(
        playerImage,
        -playerHeadRadius, // x position centered
        -playerHeadRadius, // y position centered
        imgSize,
        imgSize
      )
    } else {
      // Fallback to drawing a circle if image not loaded
      const headGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, playerHeadRadius)
      headGradient.addColorStop(0, player.color)
      headGradient.addColorStop(1, shadeColor(player.color, -20))
      ctx.fillStyle = headGradient
      
      ctx.beginPath()
      ctx.arc(0, 0, playerHeadRadius, 0, Math.PI * 2)
      ctx.fill()
      
      // Add a highlight to the player's head
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.beginPath()
      ctx.arc(-playerHeadRadius / 5, -playerHeadRadius / 5, playerHeadRadius / 4, 0, Math.PI * 2)
      ctx.fill()
    }
    
    ctx.restore()
  }
  
  const renderHUD = (ctx: CanvasRenderingContext2D) => {
    // Draw semi-transparent background for better readability
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(0, 0, 200, 150)
    
    ctx.fillStyle = '#fff'
    ctx.font = '16px Arial'
    ctx.textAlign = 'left'
    
    // Draw lap counter
    ctx.fillText(`Lap Progress:`, 10, 25)
    
    // Draw checkpoint indicators
    const checkpointBoxWidth = 15
    const checkpointBoxGap = 5
    const startX = 10
    const startY = 35
    
    checkpointsPassed.forEach((passed, index) => {
      // Draw box outline
      ctx.strokeStyle = passed ? '#33FF33' : '#FFFFFF'
      ctx.lineWidth = 2
      ctx.strokeRect(
        startX + index * (checkpointBoxWidth + checkpointBoxGap),
        startY,
        checkpointBoxWidth,
        checkpointBoxWidth
      )
      
      // Fill if passed
      if (passed) {
        ctx.fillStyle = 'rgba(50, 255, 50, 0.5)'
        ctx.fillRect(
          startX + index * (checkpointBoxWidth + checkpointBoxGap) + 2,
          startY + 2,
          checkpointBoxWidth - 4,
          checkpointBoxWidth - 4
        )
      }
      
      // Highlight current checkpoint
      if (index === nextCheckpointRef.current) {
        ctx.strokeStyle = '#FFFF00'
        ctx.lineWidth = 3
        ctx.strokeRect(
          startX + index * (checkpointBoxWidth + checkpointBoxGap) - 2,
          startY - 2,
          checkpointBoxWidth + 4,
          checkpointBoxWidth + 4
        )
      }
    })
    
    // Draw timer
    ctx.fillStyle = '#fff'
    ctx.fillText(`Time: ${formatTime(gameContextRef.current.time)}`, 10, 75)
    
    // Draw current lap time
    ctx.fillText(`Lap Time: ${formatTime(gameContextRef.current.player.currentLapTime)}`, 10, 100)
    
    // Draw best lap time if available
    if (gameContextRef.current.player.bestLapTime !== null) {
      ctx.fillRect(0, 150, 200, 25)
      ctx.fillStyle = '#FFFF00' // Yellow for best time
      ctx.fillText(`Best Lap: ${formatTime(gameContextRef.current.player.bestLapTime)}`, 10, 170)
    }
    
    // Show player status effects
    if (gameContextRef.current.player.speedBoostTime > 0) {
      ctx.fillStyle = '#00AAFF'
      ctx.fillText(`BOOST: ${Math.ceil(gameContextRef.current.player.speedBoostTime / 1000)}s`, 10, 125)
    } else if (gameContextRef.current.player.slowDownTime > 0) {
      ctx.fillStyle = '#FFFFFF'
      ctx.fillText(`SLOW: ${Math.ceil(gameContextRef.current.player.slowDownTime / 1000)}s`, 10, 125)
    }
    
    // Add position indicator
    const positions = [...gameContextRef.current.opponents, gameContextRef.current.player]
      .sort((a, b) => {
        // Compare by checkpoints and progress
        if (b.laps !== a.laps) return b.laps - a.laps;
        
        // If at same checkpoint, use distance to next checkpoint
        const nextCheckpoint = gameContextRef.current.track.checkpoints[nextCheckpointRef.current];
        
        const distA = Math.sqrt(
          Math.pow(a.position.x - nextCheckpoint.x, 2) + 
          Math.pow(a.position.y - nextCheckpoint.y, 2)
        );
        
        const distB = Math.sqrt(
          Math.pow(b.position.x - nextCheckpoint.x, 2) + 
          Math.pow(b.position.y - nextCheckpoint.y, 2)
        );
        
        return distA - distB;
      });
    
    const playerRank = positions.findIndex(entity => entity.id === gameContextRef.current.player.id) + 1
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(ctx.canvas.width / window.devicePixelRatio - 100, 0, 100, 50)
    ctx.fillStyle = getPositionColor(playerRank)
    ctx.font = '24px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${playerRank}${getRankSuffix(playerRank)}`, ctx.canvas.width / window.devicePixelRatio - 50, 30)
  }
  
  // Helper function for rank suffixes
  const getRankSuffix = (rank: number): string => {
    if (rank === 1) return 'st'
    if (rank === 2) return 'nd'
    if (rank === 3) return 'rd'
    return 'th'
  }
  
  // Helper function for position colors
  const getPositionColor = (position: number): string => {
    switch (position) {
      case 1:
        return '#FFD700' // Gold
      case 2:
        return '#C0C0C0' // Silver
      case 3:
        return '#CD7F32' // Bronze
      default:
        return '#FFFFFF' // White
    }
  }
  
  const renderNameEntryScreen = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
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
    
    // Add name entry instructions
    ctx.font = '24px Arial'
    ctx.fillText('Enter Your Name:', width / 2, height / 2 - 60)
    
    // Draw a stylized input box
    const inputBoxWidth = 300
    const inputBoxHeight = 50
    const inputBoxX = width / 2 - inputBoxWidth / 2
    const inputBoxY = height / 2 - 30
    
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
    ctx.font = '24px Arial'
    ctx.fillText(playerName + (Math.floor(Date.now() / 500) % 2 === 0 ? '|' : ''), inputBoxX + 15, inputBoxY + 33)
    
    // Draw submit button
    const buttonWidth = 150
    const buttonHeight = 40
    const buttonX = width / 2 - buttonWidth / 2
    const buttonY = height / 2 + 50
    
    // Button shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.fillRect(buttonX + 3, buttonY + 3, buttonWidth, buttonHeight)
    
    // Button background
    const buttonGradient = ctx.createLinearGradient(buttonX, buttonY, buttonX, buttonY + buttonHeight)
    buttonGradient.addColorStop(0, '#FF5C8D')
    buttonGradient.addColorStop(1, '#FF4070')
    ctx.fillStyle = buttonGradient
    ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight)
    
    // Button border
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight)
    
    // Button text
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.font = '20px Arial'
    ctx.fillText('START RACE', buttonX + buttonWidth / 2, buttonY + 27)
    
    // Draw instructions
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.font = '16px Arial'
    ctx.fillText('Press ENTER to start the race', width / 2, height / 2 + 120)
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
    
    // Draw a play button
    const buttonWidth = 200
    const buttonHeight = 60
    const buttonX = width / 2 - buttonWidth / 2
    const buttonY = height / 2 - 30
    
    // Button shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.fillRect(buttonX + 3, buttonY + 3, buttonWidth, buttonHeight)
    
    // Button background
    const buttonGradient = ctx.createLinearGradient(buttonX, buttonY, buttonX, buttonY + buttonHeight)
    buttonGradient.addColorStop(0, '#FF5C8D')
    buttonGradient.addColorStop(1, '#FF4070')
    ctx.fillStyle = buttonGradient
    ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight)
    
    // Button border
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight)
    
    // Button text
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.font = '24px Arial'
    ctx.fillText('PLAY GAME', buttonX + buttonWidth / 2, buttonY + 38)
    
    // Add best time if available
    if (bestTime) {
      ctx.fillStyle = '#FFD700'  // Gold color
      ctx.font = 'bold 18px Arial'
      ctx.fillText(`Best Time: ${formatTime(bestTime)}`, width / 2, height / 2 + 80)
    }
    
    // Add game instructions
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.font = '14px Arial'
    ctx.fillText('Race through the fallopian tube', width / 2, height - 60)
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
    
    // Create a celebration animation
    const currentTime = Date.now()
    // Reset animation every 10 seconds - used for timing the confetti patterns
    const animationStartTime = currentTime % 10000
    const animationProgress = animationStartTime / 10000 // Used for wave patterns
    
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(0, 0, width, height)
    
    // Draw confetti particles with wave pattern based on animationProgress
    for (let i = 0; i < 100; i++) {
      // Use animationProgress to create wave patterns in confetti
      const x = (Math.sin(currentTime / 1000 + i + animationProgress * Math.PI * 2) * 0.5 + 0.5) * width
      const y = ((currentTime / 1000 + i * 0.1 + animationProgress) % 1) * height
      const size = 5 + Math.sin(currentTime / 500 + i + animationProgress * 5) * 3
      const hue = (i * 3.6 + currentTime / 50 + animationProgress * 360) % 360
      
      ctx.fillStyle = `hsla(${hue}, 100%, 60%, 0.8)`
      ctx.beginPath()
      
      // Alternate between different confetti shapes
      if (i % 3 === 0) {
        // Circle
        ctx.arc(x, y, size, 0, Math.PI * 2)
      } else if (i % 3 === 1) {
        // Square
        ctx.rect(x - size / 2, y - size / 2, size, size)
      } else {
        // Triangle
        ctx.moveTo(x, y - size)
        ctx.lineTo(x + size * 0.866, y + size * 0.5)
        ctx.lineTo(x - size * 0.866, y + size * 0.5)
        ctx.closePath()
      }
      
      ctx.fill()
    }
    
    // Create a light ray effect behind the text
    const centerX = width / 2
    const centerY = height / 5
    const outerRadius = Math.max(width, height)
    
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerRadius)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)')
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.2)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    
    // Main title with pulsing animation
    const pulseSize = Math.sin(currentTime / 200) * 5
    ctx.fillStyle = '#FFDD33'
    ctx.font = `bold ${48 + pulseSize}px Arial`
    ctx.textAlign = 'center'
    ctx.fillText('CONGRATULATIONS!', width / 2, height / 5)
    
    // Draw a trophy icon
    const trophyX = width / 2
    const trophyY = height / 3
    const trophySize = 40 + Math.sin(currentTime / 500) * 5
    
    // Trophy cup
    ctx.fillStyle = '#FFD700'
    ctx.beginPath()
    ctx.arc(trophyX, trophyY - trophySize / 2, trophySize / 2, 0, Math.PI, true)
    ctx.fill()
    
    // Trophy stem and base
    ctx.fillRect(trophyX - trophySize / 10, trophyY - trophySize / 2, trophySize / 5, trophySize / 1.5)
    ctx.fillRect(trophyX - trophySize / 2, trophyY + trophySize / 4, trophySize, trophySize / 8)
    
    // Trophy handles
    ctx.beginPath()
    ctx.arc(trophyX - trophySize / 2, trophyY - trophySize / 3, trophySize / 4, Math.PI / 2, -Math.PI / 2, true)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(trophyX + trophySize / 2, trophyY - trophySize / 3, trophySize / 4, -Math.PI / 2, Math.PI / 2, true)
    ctx.stroke()
    
    // Player time
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 32px Arial'
    ctx.fillText(`Your Time: ${formatTime(gameContextRef.current.time)}`, width / 2, height / 2)
    
    // Leaderboard background
    const leaderboardWidth = width * 0.7
    const leaderboardHeight = height * 0.35
    const leaderboardX = width / 2 - leaderboardWidth / 2
    const leaderboardY = height / 2 + 20
    
    // Box shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(leaderboardX + 5, leaderboardY + 5, leaderboardWidth, leaderboardHeight)
    
    // Box background
    const boxGradient = ctx.createLinearGradient(leaderboardX, leaderboardY, leaderboardX, leaderboardY + leaderboardHeight)
    boxGradient.addColorStop(0, '#333344')
    boxGradient.addColorStop(1, '#222233')
    ctx.fillStyle = boxGradient
    ctx.fillRect(leaderboardX, leaderboardY, leaderboardWidth, leaderboardHeight)
    
    // Box border
    ctx.strokeStyle = '#5555AA'
    ctx.lineWidth = 2
    ctx.strokeRect(leaderboardX, leaderboardY, leaderboardWidth, leaderboardHeight)
    
    // Leaderboard title
    ctx.fillStyle = '#FFDD33'
    ctx.font = 'bold 24px Arial'
    ctx.fillText('LEADERBOARD', width / 2, leaderboardY + 30)
    
    // Leaderboard entries
    const combinedLeaderboard = [...leaderboard]
    
    // Add current entry if not already in leaderboard
    const playerTime = gameContextRef.current.time
    if (!combinedLeaderboard.some(entry => entry.name === gameContextRef.current.player.name && entry.time === playerTime)) {
      combinedLeaderboard.push({
        name: gameContextRef.current.player.name || "Player",
        time: playerTime
      })
    }
    
    // Sort and limit to top 5 for display
    const displayLeaderboard = combinedLeaderboard
      .sort((a, b) => a.time - b.time)
      .slice(0, 5)
    
    // Draw the entries
    ctx.textAlign = 'left'
    ctx.font = '18px Arial'
    
    displayLeaderboard.forEach((entry, index) => {
      const isCurrentPlayer = entry.name === gameContextRef.current.player.name && entry.time === playerTime
      
      // Highlight current player
      if (isCurrentPlayer) {
        ctx.fillStyle = 'rgba(255, 220, 80, 0.3)'
        ctx.fillRect(
          leaderboardX + 10, 
          leaderboardY + 50 + index * 30 - 20, 
          leaderboardWidth - 20, 
          25
        )
        ctx.fillStyle = '#FFDD33'
      } else {
        ctx.fillStyle = '#FFFFFF'
      }
      
      // Rank
      ctx.fillText(`${index + 1}.`, leaderboardX + 20, leaderboardY + 50 + index * 30)
      
      // Name
      ctx.fillText(entry.name, leaderboardX + 60, leaderboardY + 50 + index * 30)
      
      // Time
      ctx.textAlign = 'right'
      ctx.fillText(formatTime(entry.time), leaderboardX + leaderboardWidth - 20, leaderboardY + 50 + index * 30)
      
      ctx.textAlign = 'left'
    })
    
    // Play again button
    const buttonWidth = 150
    const buttonHeight = 40
    const buttonX = width / 2 - buttonWidth / 2
    const buttonY = height - 60
    
    // Button shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.fillRect(buttonX + 3, buttonY + 3, buttonWidth, buttonHeight)
    
    // Button background
    const buttonGradient = ctx.createLinearGradient(buttonX, buttonY, buttonX, buttonY + buttonHeight)
    buttonGradient.addColorStop(0, '#FF5C8D')
    buttonGradient.addColorStop(1, '#FF4070')
    ctx.fillStyle = buttonGradient
    ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight)
    
    // Button border
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight)
    
    // Button text
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.font = '20px Arial'
    ctx.fillText('PLAY AGAIN', buttonX + buttonWidth / 2, buttonY + 27)
  }
  
  // Helper function to shade a color (used for gradients)
  const shadeColor = (color: string, percent: number): string => {
    let R = parseInt(color.substring(1, 3), 16)
    let G = parseInt(color.substring(3, 5), 16)
    let B = parseInt(color.substring(5, 7), 16)

    R = Math.floor(R * (100 + percent) / 100)
    G = Math.floor(G * (100 + percent) / 100)
    B = Math.floor(B * (100 + percent) / 100)

    R = R < 255 ? R : 255
    G = G < 255 ? G : 255
    B = B < 255 ? B : 255

    const RR = R.toString(16).length === 1 ? '0' + R.toString(16) : R.toString(16)
    const GG = G.toString(16).length === 1 ? '0' + G.toString(16) : G.toString(16)
    const BB = B.toString(16).length === 1 ? '0' + B.toString(16) : B.toString(16)

    return '#' + RR + GG + BB
  }
  
  // Render the power-ups
  const renderPowerUps = (ctx: CanvasRenderingContext2D) => {
    gameContextRef.current.powerUps.forEach(powerUp => {
      if (powerUp.collected) return // Don't render collected power-ups
      
      if (powerUp.type === 'boost') {
        // Speed boost pill (blue)
        const pillGradient = ctx.createRadialGradient(
          powerUp.position.x, powerUp.position.y, 0,
          powerUp.position.x, powerUp.position.y, powerUp.radius
        )
        pillGradient.addColorStop(0, '#00DDFF')
        pillGradient.addColorStop(0.7, '#00AAFF')
        pillGradient.addColorStop(1, '#0088DD')
        
        ctx.fillStyle = pillGradient
        ctx.beginPath()
        ctx.arc(powerUp.position.x, powerUp.position.y, powerUp.radius, 0, Math.PI * 2)
        ctx.fill()
        
        // Add a subtle glow
        const glowRadius = powerUp.radius * 1.3
        
        const glowGradient = ctx.createRadialGradient(
          powerUp.position.x, powerUp.position.y, powerUp.radius * 0.8,
          powerUp.position.x, powerUp.position.y, glowRadius
        )
        glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)')
        glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
        
        ctx.fillStyle = glowGradient
        ctx.beginPath()
        ctx.arc(powerUp.position.x, powerUp.position.y, glowRadius, 0, Math.PI * 2)
        ctx.fill()
        
        // Draw a lightning bolt symbol
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 2
        ctx.beginPath()
        
        // Zigzag lightning bolt
        ctx.moveTo(powerUp.position.x - powerUp.radius * 0.3, powerUp.position.y - powerUp.radius * 0.4)
        ctx.lineTo(powerUp.position.x, powerUp.position.y - powerUp.radius * 0.1)
        ctx.lineTo(powerUp.position.x - powerUp.radius * 0.3, powerUp.position.y + powerUp.radius * 0.1)
        ctx.lineTo(powerUp.position.x + powerUp.radius * 0.3, powerUp.position.y + powerUp.radius * 0.4)
        
        ctx.stroke()
      } else if (powerUp.type === 'slowdown') {
        // Slowdown pill (white)
        const pillGradient = ctx.createRadialGradient(
          powerUp.position.x, powerUp.position.y, 0,
          powerUp.position.x, powerUp.position.y, powerUp.radius
        )
        pillGradient.addColorStop(0, '#FFFFFF')
        pillGradient.addColorStop(0.7, '#F0F0F0')
        pillGradient.addColorStop(1, '#E0E0E0')
        
        ctx.fillStyle = pillGradient
        ctx.beginPath()
        ctx.arc(powerUp.position.x, powerUp.position.y, powerUp.radius, 0, Math.PI * 2)
        ctx.fill()
        
        // Add a subtle glow
        const glowRadius = powerUp.radius * 1.3
        
        const glowGradient = ctx.createRadialGradient(
          powerUp.position.x, powerUp.position.y, powerUp.radius * 0.8,
          powerUp.position.x, powerUp.position.y, glowRadius
        )
        glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)')
        glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
        
        ctx.fillStyle = glowGradient
        ctx.beginPath()
        ctx.arc(powerUp.position.x, powerUp.position.y, glowRadius, 0, Math.PI * 2)
        ctx.fill()
        
        // Draw a slowdown symbol (X)
        ctx.strokeStyle = '#FF0000'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(powerUp.position.x - powerUp.radius * 0.3, powerUp.position.y - powerUp.radius * 0.3)
        ctx.lineTo(powerUp.position.x + powerUp.radius * 0.3, powerUp.position.y + powerUp.radius * 0.3)
        ctx.stroke()
        
        ctx.beginPath()
        ctx.moveTo(powerUp.position.x + powerUp.radius * 0.3, powerUp.position.y - powerUp.radius * 0.3)
        ctx.lineTo(powerUp.position.x - powerUp.radius * 0.3, powerUp.position.y + powerUp.radius * 0.3)
        ctx.stroke()
      }
    })
  }
  
  // Render game over screen
  const renderGameOver = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const width = canvas.width / window.devicePixelRatio
    const height = canvas.height / window.devicePixelRatio
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(0, 0, width, height)
    
    ctx.fillStyle = '#ff4444'
    ctx.font = 'bold 48px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('GAME OVER', width / 2, height / 2)
    
    ctx.fillStyle = '#ffffff'
    ctx.font = '24px Arial'
    ctx.fillText('Press SPACE to play again', width / 2, height / 2 + 60)
  }
  
  // Handle touch input for mobile
  const handleTouch = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Check if we're on a mobile device
    if (!isMobile()) return
    
    if (gameContextRef.current.gameState === 'ready' || 
        gameContextRef.current.gameState === 'racing') {
      setShowJoystick(true)
    }
    
    // Handle game state changes on touch
    switch (gameContextRef.current.gameState) {
      case 'title':
        setGameState('nameEntry')
        gameContextRef.current.gameState = 'nameEntry'
        setTimeout(() => setNameInputActive(true), 100)
        break
      case 'nameEntry':
        if (nameInputRef.current) {
          nameInputRef.current.focus()
        }
        break
      case 'finished':
        // Check if touch is on the play again button
        const canvas = gameContextRef.current.canvas
        if (!canvas) return
        
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        
        // Check play again button bounds
        const buttonWidth = 150
        const buttonHeight = 40
        const buttonX = (canvas.width / window.devicePixelRatio) / 2 - buttonWidth / 2
        const buttonY = (canvas.height / window.devicePixelRatio) - 60
        
        if (x >= buttonX && x <= buttonX + buttonWidth &&
            y >= buttonY && y <= buttonY + buttonHeight) {
          setGameState('ready')
          gameContextRef.current.gameState = 'ready'
          startGame()
        }
        break
    }
  }, [startGame, isMobile, nameInputActive, nameInputRef])
  
  // Load character images
  useEffect(() => {
    const loadImage = (name: string, style: string) => {
      const img = new Image()
      img.src = generateAvatarUrl(name, style)
      img.onload = () => {
        setCharacterImages(prev => ({
          ...prev,
          [name]: img
        }))
      }
      img.onerror = () => {
        console.error(`Failed to load image for ${name}`)
      }
    }

    // Load images for all characters with different styles for variety
    loadImage('Balaji', 'avataaars')
    loadImage('Donovan', 'bottts')
    loadImage('Andy', 'micah')
    loadImage('Jake', 'adventurer')
    loadImage('Dizzy', 'bottts')
    loadImage('Backwards', 'avataaars')
    loadImage('Confused', 'micah')
    loadImage('You', 'adventurer')
  }, []) // Empty dependency array ensures this runs only once on mount
  
  // Initialize game loop and event listeners
  useEffect(() => {
    // Handle window resize
    const handleResize = () => {
      const width = Math.min(800, window.innerWidth)
      const height = Math.min(600, window.innerHeight)
      setViewportSize({ width, height })
      
      // Update camera position
      setCameraPosition({ 
        x: gameContextRef.current.player.position.x - width / 2,
        y: gameContextRef.current.player.position.y - height / 3
      })
    }
    
    // Initial sizing
    handleResize()
    
    // Add event listeners
    window.addEventListener('resize', handleResize)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    // Start game loop
    requestAnimationFrameRef.current = requestAnimationFrame(gameLoop)
    
    // Check if mobile and enable joystick
    if (isMobile()) {
      setShowJoystick(true)
    }
    
    return () => {
      // Clean up
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      cancelAnimationFrame(requestAnimationFrameRef.current)
    }
  }, [gameLoop, handleKeyDown, handleKeyUp, isMobile])
  
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
        {nameInputActive && (
          <input
            ref={nameInputRef}
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value.slice(0, 15))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleNameSubmit()
                e.preventDefault()
              }
            }}
            className="opacity-0 absolute top-0 left-0 w-1 h-1"
            autoFocus
          />
        )}
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