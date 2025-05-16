import { AIOpponent, Vector2D } from '../../types'

// CPU player names
const CPU_NAMES = ['Balaji', 'Donovan', 'Andy', 'Jake', 'Dizzy', 'Backwards', 'Confused']

export function updateAIOpponent(ai: AIOpponent, deltaTime: number): void {
  // Special behavior for the spinning sperm
  if (ai.name === 'Dizzy') {
    // Just spin in place with larger circles
    ai.rotation += 720 * deltaTime; // Spin twice as fast
    
    // Add a circular motion
    const circleRadius = 100;
    const circleSpeed = 1.0;
    const circleCenterX = ai.position.x;
    const circleCenterY = ai.position.y;
    
    ai.acceleration.x = Math.cos(Date.now() / 1000 * circleSpeed) * ai.speed;
    ai.acceleration.y = Math.sin(Date.now() / 1000 * circleSpeed) * ai.speed;
    
    // Keep the sperm roughly in the same area
    const distanceFromCenter = Math.sqrt(
      Math.pow(ai.position.x - circleCenterX, 2) + 
      Math.pow(ai.position.y - circleCenterY, 2)
    );
    
    if (distanceFromCenter > circleRadius) {
      // Pull back toward center
      const directionToCenter = {
        x: circleCenterX - ai.position.x,
        y: circleCenterY - ai.position.y
      };
      
      // Normalize
      const distance = Math.sqrt(
        directionToCenter.x * directionToCenter.x + 
        directionToCenter.y * directionToCenter.y
      );
      
      if (distance > 0) {
        directionToCenter.x /= distance;
        directionToCenter.y /= distance;
      }
      
      // Apply force toward center
      ai.acceleration.x += directionToCenter.x * ai.speed * 2;
      ai.acceleration.y += directionToCenter.y * ai.speed * 2;
    }
    
    return;
  }
  
  // Special behavior for confused sperm - random direction changes
  if (ai.name === 'Confused') {
    // Change direction randomly more frequently
    if (Math.random() < 0.1) { // 10% chance per frame to change direction
      ai.acceleration.x = (Math.random() - 0.5) * ai.speed * 3;
      ai.acceleration.y = (Math.random() - 0.5) * ai.speed * 3;
      // Random rotation
      ai.rotation = Math.random() * 360;
    }
    
    // Add jitter
    ai.acceleration.x += (Math.random() - 0.5) * ai.speed * 0.5;
    ai.acceleration.y += (Math.random() - 0.5) * ai.speed * 0.5;
    
    return;
  }
  
  // Slow down "Backwards" a bit
  if (ai.name === 'Backwards') {
    ai.speed = Math.max(ai.speed * 0.98, 70); // Gradually slow down to minimum speed
  }
  
  // Make Balaji and Donovan smarter with better pathfinding
  if (ai.name === 'Balaji' || ai.name === 'Donovan') {
    // Add some lookahead pathfinding - look at the next waypoint too
    const nextWaypointIndex = (ai.currentWaypoint + 1) % ai.waypoints.length;
    const currentWaypoint = ai.waypoints[ai.currentWaypoint];
    const nextWaypoint = ai.waypoints[nextWaypointIndex];
    
    // Weight between current and next waypoint (0.8 current, 0.2 next)
    const targetX = currentWaypoint.x * 0.8 + nextWaypoint.x * 0.2;
    const targetY = currentWaypoint.y * 0.8 + nextWaypoint.y * 0.2;
    
    // Calculate direction to blended waypoint
    const directionToWaypoint = {
      x: targetX - ai.position.x - ai.width / 2,
      y: targetY - ai.position.y - ai.height / 2
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
    
    // Set AI acceleration with higher factor for smart AIs
    const accelerationFactor = ai.speed * (1.0 + ai.difficulty * 0.5) // Enhanced acceleration
    ai.acceleration.x = directionToWaypoint.x * accelerationFactor
    ai.acceleration.y = directionToWaypoint.y * accelerationFactor
    
    // Better angle calculation
    const angleToWaypoint = Math.atan2(directionToWaypoint.y, directionToWaypoint.x) * 180 / Math.PI
    
    // Faster rotation for smart AIs
    const angleDifference = ((angleToWaypoint - ai.rotation + 540) % 360) - 180
    const rotationSpeed = 360 * deltaTime // 50% faster rotation
    
    if (Math.abs(angleDifference) > 2) { // More precise angle control
      if (angleDifference > 0) {
        ai.rotation += Math.min(rotationSpeed, angleDifference)
      } else {
        ai.rotation -= Math.min(rotationSpeed, Math.abs(angleDifference))
      }
    }
    
    // Check if we've reached the waypoint (smaller radius = more precise navigation)
    const waypointRadius = 20 // pixels
    if (distance < waypointRadius) {
      // Move to next waypoint
      ai.currentWaypoint = (ai.currentWaypoint + 1) % ai.waypoints.length
    }
    
    return;
  }
  
  // Standard AI behavior for others
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
  colors: string[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'cyan']
): AIOpponent[] {
  const opponents: AIOpponent[] = []
  
  for (let i = 0; i < count; i++) {
    // Position opponents in a grid at the start position
    const row = Math.floor(i / 2)
    const col = i % 2
    
    // CPU name for this opponent
    const name = CPU_NAMES[i % CPU_NAMES.length]
    
    // Create a reversed waypoint path for Jake (making him go the wrong way)
    let opponentWaypoints
    let startPos = { ...startPosition }
    
    if (name === 'Jake' || name === 'Backwards') {
      // Reverse the waypoints array for Jake to make him go the wrong direction
      opponentWaypoints = [...waypoints].reverse()
      
      // Offset Jake's position slightly to avoid immediate collisions
      startPos = {
        x: startPosition.x + 50,
        y: startPosition.y - 30
      }
    } else if (name === 'Dizzy') {
      // Dizzy will spin in place mid-course
      opponentWaypoints = [...waypoints]
      
      // Position Dizzy in the middle of the first section
      startPos = {
        x: waypoints[1].x + 20,
        y: waypoints[1].y + 10
      }
    } else if (name === 'Confused') {
      // Confused sperm gets random waypoints
      opponentWaypoints = [...waypoints].sort(() => Math.random() - 0.5)
      
      // Start further back
      startPos = {
        x: startPosition.x - 30,
        y: startPosition.y + 40
      }
    } else {
      opponentWaypoints = [...waypoints]
    }
    
    const opponent: AIOpponent = {
      id: `ai-${i}`,
      name: name,
      position: {
        x: startPos.x + col * 30, // 30 pixels apart horizontally
        y: startPos.y + row * 30  // 30 pixels apart vertically
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
      waypoints: opponentWaypoints, // Use the appropriate waypoints
      currentWaypoint: 0,
      difficulty: 0.5 + Math.random() * 0.5, // Random difficulty 0.5-1.0
      laps: 0,
      lapTimes: [],
      speedBoostTime: 0,
      slowDownTime: 0
    }
    
    // Special settings for special sperms
    if (name === 'Balaji' || name === 'Donovan') {
      opponent.speed = 200;
      opponent.maxSpeed = 350;
      opponent.difficulty = 0.8 + Math.random() * 0.2; // Higher difficulty
      opponent.friction = 0.05; // Less friction
      
      // Special colors
      if (name === 'Balaji') {
        opponent.color = '#3399FF'; // Blue
      } else {
        opponent.color = '#FF5500'; // Orange
      }
    } else if (name === 'Dizzy') {
      opponent.speed = 70; // Slower speed
      opponent.color = '#FF00FF'; // Bright magenta to stand out
    } else if (name === 'Confused') {
      opponent.friction = 0.2; // More friction
      opponent.color = '#FFFF00'; // Yellow
    } else if (name === 'Andy') {
      opponent.color = '#22CC22'; // Green
      opponent.speed = 180; // Medium speed
    } else if (name === 'Jake' || name === 'Backwards') {
      opponent.color = '#FF3366'; // Pink
      opponent.speed = 160; // Medium-slow speed
    }
    
    opponents.push(opponent)
  }
  
  return opponents
} 