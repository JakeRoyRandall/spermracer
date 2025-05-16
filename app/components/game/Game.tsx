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
  const [bestTime, setBestTime] = useState<number | null>(null)
  
  const gameContextRef = useRef<GameContext>({
    canvas: null,
    ctx: null,
    gameState: 'title',
    player: {
      id: generateId(),
      name: 'You',
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
    // Update wave offset for animation
    tailWaveRef.current.offset += deltaTime * 10;
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
    
    // Keep only the most recent positions
    if (tailWaveRef.current.player.lastPositions.length > 8) {
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
      
      // Keep only the most recent positions
      if (tailWaveRef.current.opponents[opponent.id].lastPositions.length > 8) {
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
        renderHUD(ctx)
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
    // Draw outer track (representing the reproductive tract)
    ctx.fillStyle = '#FF90B3' // Pink color for reproductive tract
    ctx.fillRect(0, 0, track.width, track.height)
    
    // Create a pattern for the background
    ctx.fillStyle = '#E56B9F' // Slightly darker pink
    for (let x = 0; x < track.width; x += 30) {
      for (let y = 0; y < track.height; y += 30) {
        // Create a wavy pattern
        if ((x + y) % 60 === 0) {
          ctx.fillRect(x, y, 15, 15)
        }
      }
    }
    
    // Draw inner track (representing the center pathway)
    ctx.fillStyle = '#FFDDE5' // Lighter pink
    ctx.fillRect(
      trackWallThickness * 4, 
      trackWallThickness * 2, 
      track.width - trackWallThickness * 8, 
      track.height - trackWallThickness * 4
    )
    
    // Add texture to the inner track
    ctx.fillStyle = '#FFE6ED' // Even lighter pink
    for (let x = trackWallThickness * 4; x < track.width - trackWallThickness * 4; x += 20) {
      for (let y = trackWallThickness * 2; y < track.height - trackWallThickness * 2; y += 20) {
        if ((x + y) % 40 === 0) {
          ctx.fillRect(x, y, 10, 10)
        }
      }
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
    
    // Draw start line
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(track.startLine.start.x, track.startLine.start.y)
    ctx.lineTo(track.startLine.end.x, track.startLine.end.y)
    ctx.stroke()
    
    // Add "START" text
    ctx.fillStyle = '#fff'
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('START', (track.startLine.start.x + track.startLine.end.x) / 2, track.startLine.start.y - 5)
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
          
          // Create a path through previous positions with wave effect
          for (let i = 0; i < positions.length - 1; i++) {
            // Add a sine wave effect to the tail
            const waveAmplitude = opponentHeadRadius / 3 * (1 - i / positions.length);
            const wavePhase = tailWaveRef.current.offset + i * 1.5;
            const waveY = Math.sin(wavePhase) * waveAmplitude;
            
            // Draw tail segment
            const segmentX = -opponentHeadRadius - (i + 1) * opponentHeadRadius / 2;
            const segmentY = waveY;
            
            ctx.lineTo(segmentX, segmentY);
          }
          
          // Taper the tail width
          ctx.strokeStyle = opponent.color;
          const gradient = ctx.createLinearGradient(-opponentHeadRadius / 2, 0, -opponentHeadRadius * 5, 0);
          gradient.addColorStop(0, opponent.color);
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.strokeStyle = gradient;
        
        ctx.stroke();
      }
      
      // Draw the head (circle)
      const headGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, headRadius);
      headGradient.addColorStop(0, opponent.color);
      headGradient.addColorStop(1, shadeColor(opponent.color, -20));
      ctx.fillStyle = headGradient;
      
      ctx.beginPath();
      ctx.arc(0, 0, headRadius, 0, Math.PI * 2);
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
    const headRadius = player.width / 1.5;
    
    // Draw the wiggly tail
    ctx.strokeStyle = player.color;
    ctx.lineWidth = headRadius / 2.5;
    ctx.lineCap = 'round';
    
    const playerTail = tailWaveRef.current.player;
    if (playerTail.lastPositions.length > 1) {
      const positions = playerTail.lastPositions;
      
      ctx.beginPath();
      // Start from the back of the head
      ctx.moveTo(-headRadius / 2, 0);
      
      // Create path through previous positions with wave effect
      for (let i = 0; i < positions.length - 1; i++) {
        // Add a sine wave effect to the tail
        const waveAmplitude = headRadius / 3 * (1 - i / positions.length);
        const wavePhase = tailWaveRef.current.offset + i * 1.5;
        const waveY = Math.sin(wavePhase) * waveAmplitude;
        
        // Draw tail segment
        const segmentX = -headRadius - (i + 1) * headRadius / 2;
        const segmentY = waveY;
        
        ctx.lineTo(segmentX, segmentY);
      }
      
      // Taper the tail width with gradient
      const gradient = ctx.createLinearGradient(-headRadius / 2, 0, -headRadius * 5, 0);
      gradient.addColorStop(0, player.color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.strokeStyle = gradient;
      
      ctx.stroke();
    }
    
    // Draw the head (circle) with gradient
    const headGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, headRadius);
    headGradient.addColorStop(0, player.color);
    headGradient.addColorStop(1, shadeColor(player.color, -20));
    ctx.fillStyle = headGradient;
    
    ctx.beginPath();
    ctx.arc(0, 0, headRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Add a highlight to the player's head
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(-headRadius / 5, -headRadius / 5, headRadius / 4, 0, Math.PI * 2);
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
    ctx.fillText('SPERM RACER', width / 2, height / 3)
    
    // Add subtitle
    ctx.font = '24px Arial'
    ctx.fillText('The Race to Fertilization', width / 2, height / 3 + 40)
    
    // Add start instructions
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.font = '20px Arial'
    
    if (isMobile()) {
      ctx.fillText('Tap to Start', width / 2, height / 2 + 40)
      ctx.font = '16px Arial'
      ctx.fillText('Use the joystick to control', width / 2, height / 2 + 70)
    } else {
      ctx.fillText('Press SPACE to start', width / 2, height / 2 + 40)
      ctx.font = '16px Arial'
      ctx.fillText('Use arrow keys or WASD to control', width / 2, height / 2 + 70)
    }
    
    // Add best time if available
    if (bestTime) {
      ctx.fillStyle = '#FFD700'  // Gold color
      ctx.font = 'bold 18px Arial'
      ctx.fillText(`Best Time: ${formatTime(bestTime)}`, width / 2, height / 2 + 120)
    }
    
    // Add game instructions
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.font = '14px Arial'
    ctx.fillText('Race through the checkpoints', width / 2, height - 60)
    ctx.fillText('Complete 3 laps to win', width / 2, height - 40)
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