import { Entity, Player, Track, Vector2D } from '../../types'
import { lineIntersection } from '../utils'

export function checkTrackCollisions(entity: Entity, track: Track): boolean {
  // Set initial collision state to false
  let collision = false
  
  // Create the entity's bounding box lines
  const topLeft = { x: entity.position.x, y: entity.position.y }
  const topRight = { x: entity.position.x + entity.width, y: entity.position.y }
  const bottomLeft = { x: entity.position.x, y: entity.position.y + entity.height }
  const bottomRight = { x: entity.position.x + entity.width, y: entity.position.y + entity.height }
  
  const entityLines = [
    { start: topLeft, end: topRight },
    { start: topRight, end: bottomRight },
    { start: bottomRight, end: bottomLeft },
    { start: bottomLeft, end: topLeft }
  ]
  
  // Check each wall of the track against each line of the entity
  for (const wall of track.walls) {
    for (const line of entityLines) {
      const intersection = lineIntersection(
        line.start,
        line.end,
        wall.start,
        wall.end
      )
      
      if (intersection) {
        collision = true
        
        // Calculate the normal vector of the wall
        const wallVector = {
          x: wall.end.x - wall.start.x,
          y: wall.end.y - wall.start.y
        }
        
        const wallNormal = {
          x: -wallVector.y,
          y: wallVector.x
        }
        
        // Normalize the wall normal
        const length = Math.sqrt(wallNormal.x * wallNormal.x + wallNormal.y * wallNormal.y)
        wallNormal.x /= length
        wallNormal.y /= length
        
        // Calculate the dot product of velocity and normal
        const dot = entity.velocity.x * wallNormal.x + entity.velocity.y * wallNormal.y
        
        // Reflect the velocity vector off the wall
        entity.velocity.x -= 2 * dot * wallNormal.x
        entity.velocity.y -= 2 * dot * wallNormal.y
        
        // Reduce velocity (energy loss)
        entity.velocity.x *= 0.7
        entity.velocity.y *= 0.7
        
        // Move entity away from wall
        const pushDistance = 2 // pixels to push away
        entity.position.x += wallNormal.x * pushDistance
        entity.position.y += wallNormal.y * pushDistance
      }
    }
  }
  
  return collision
}

export function checkCheckpointCollision(
  player: Player,
  checkpointIndex: number,
  checkpoint: Vector2D,
  nextCheckpoint: Vector2D,
  radius: number
): boolean {
  // Create a line between checkpoint and next checkpoint
  const checkpointLine = {
    start: checkpoint,
    end: nextCheckpoint
  }
  
  // Get the center of the player
  const playerCenter = {
    x: player.position.x + player.width / 2,
    y: player.position.y + player.height / 2
  }
  
  // Check if player's center is within radius of the checkpoint line
  // First, find the closest point on the line to the player
  const lineVector = {
    x: checkpointLine.end.x - checkpointLine.start.x,
    y: checkpointLine.end.y - checkpointLine.start.y
  }
  
  const lineLength = Math.sqrt(lineVector.x * lineVector.x + lineVector.y * lineVector.y)
  
  // Normalize line vector
  const lineDirection = {
    x: lineVector.x / lineLength,
    y: lineVector.y / lineLength
  }
  
  // Vector from checkpoint to player center
  const checkpointToPlayer = {
    x: playerCenter.x - checkpointLine.start.x,
    y: playerCenter.y - checkpointLine.start.y
  }
  
  // Project checkpointToPlayer onto the line direction
  const projection = 
    checkpointToPlayer.x * lineDirection.x + 
    checkpointToPlayer.y * lineDirection.y
  
  // Clamp projection to line segment
  const clampedProjection = Math.max(0, Math.min(lineLength, projection))
  
  // Find the closest point on the line
  const closestPoint = {
    x: checkpointLine.start.x + lineDirection.x * clampedProjection,
    y: checkpointLine.start.y + lineDirection.y * clampedProjection
  }
  
  // Check if distance to closest point is less than radius
  const distanceSquared = 
    Math.pow(playerCenter.x - closestPoint.x, 2) + 
    Math.pow(playerCenter.y - closestPoint.y, 2)
  
  return distanceSquared <= radius * radius
}

export function checkStartLineCollision(
  player: Player,
  startLine: { start: Vector2D; end: Vector2D }
): boolean {
  // Get previous and current player positions
  const previousPosition = {
    x: player.position.x - player.velocity.x,
    y: player.position.y - player.velocity.y
  }
  
  const currentPosition = {
    x: player.position.x,
    y: player.position.y
  }
  
  // Check if player crossed the start line
  const intersection = lineIntersection(
    previousPosition,
    currentPosition,
    startLine.start,
    startLine.end
  )
  
  return intersection !== null
} 