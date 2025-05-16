import { AIOpponent, Vector2D } from '../../types'

// CPU player names
const CPU_NAMES = ['Balaji', 'Donovan', 'Andy', 'Jake']

export function updateAIOpponent(ai: AIOpponent, deltaTime: number): void {
  // Check if AI has waypoints
  if (ai.waypoints.length === 0) return
  
  // Get current waypoint
  const currentWaypoint = ai.waypoints[ai.currentWaypoint]
  
  // Calculate direction to waypoint
  const directionToWaypoint = {
    x: currentWaypoint.x - ai.position.x - ai.width / 2,
    y: currentWaypoint.y - ai.position.y - ai.height / 2
  }
  
  // Normalize direction vector
  const distance = Math.sqrt(
    directionToWaypoint.x * directionToWaypoint.x + 
    directionToWaypoint.y * directionToWaypoint.y
  )
  
  if (distance > 0) {
    directionToWaypoint.x /= distance
    directionToWaypoint.y /= distance
  }
  
  // Set AI acceleration
  const accelerationFactor = ai.speed * (0.8 + ai.difficulty * 0.4) // Scale with difficulty
  ai.acceleration.x = directionToWaypoint.x * accelerationFactor
  ai.acceleration.y = directionToWaypoint.y * accelerationFactor
  
  // Calculate angle to waypoint (for rotation)
  const angleToWaypoint = Math.atan2(directionToWaypoint.y, directionToWaypoint.x) * 180 / Math.PI
  
  // Smoothly rotate towards the waypoint
  const angleDifference = ((angleToWaypoint - ai.rotation + 540) % 360) - 180
  const rotationSpeed = 240 * deltaTime // degrees per second
  
  if (Math.abs(angleDifference) > 5) {
    if (angleDifference > 0) {
      ai.rotation += Math.min(rotationSpeed, angleDifference)
    } else {
      ai.rotation -= Math.min(rotationSpeed, Math.abs(angleDifference))
    }
  }
  
  // Normalize rotation to 0-360 degrees
  ai.rotation = ((ai.rotation % 360) + 360) % 360
  
  // Check if we've reached the waypoint (within a certain radius)
  const waypointRadius = 30 // pixels
  if (distance < waypointRadius) {
    // Move to next waypoint
    ai.currentWaypoint = (ai.currentWaypoint + 1) % ai.waypoints.length
  }
}

export function generateAIOpponents(
  count: number,
  startPosition: Vector2D,
  waypoints: Vector2D[],
  colors: string[] = ['red', 'blue', 'green', 'yellow', 'purple']
): AIOpponent[] {
  const opponents: AIOpponent[] = []
  
  for (let i = 0; i < count; i++) {
    // Position opponents in a grid at the start position
    const row = Math.floor(i / 2)
    const col = i % 2
    
    const opponent: AIOpponent = {
      id: `ai-${i}`,
      name: CPU_NAMES[i % CPU_NAMES.length], // Assign a name from the preset list
      position: {
        x: startPosition.x + col * 30, // 30 pixels apart horizontally
        y: startPosition.y + row * 30  // 30 pixels apart vertically
      },
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
      rotation: 0,
      width: 20,
      height: 20,
      color: colors[i % colors.length],
      speed: 150 + Math.random() * 50, // Base speed with some randomness
      maxSpeed: 200 + Math.random() * 100, // Max speed with some randomness
      friction: 0.1 + Math.random() * 0.1, // Friction with some randomness
      colliding: false,
      waypoints: [...waypoints], // Copy the waypoints
      currentWaypoint: 0,
      difficulty: 0.5 + Math.random() * 0.5, // Random difficulty 0.5-1.0
      laps: 0,
      lapTimes: []
    }
    
    opponents.push(opponent)
  }
  
  return opponents
} 