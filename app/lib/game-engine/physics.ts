import { Entity, Player } from '../../types'
import { angleToVector, clamp } from '../utils'

export function updateEntityPhysics(entity: Entity, deltaTime: number): void {
  // Apply acceleration to velocity
  entity.velocity.x += entity.acceleration.x * deltaTime
  entity.velocity.y += entity.acceleration.y * deltaTime
  
  // Apply friction
  const frictionFactor = 1 - entity.friction * deltaTime
  entity.velocity.x *= frictionFactor
  entity.velocity.y *= frictionFactor
  
  // Clamp velocity to max speed
  const currentSpeed = Math.sqrt(
    entity.velocity.x * entity.velocity.x + entity.velocity.y * entity.velocity.y
  )
  
  if (currentSpeed > entity.maxSpeed) {
    const ratio = entity.maxSpeed / currentSpeed
    entity.velocity.x *= ratio
    entity.velocity.y *= ratio
  }
  
  // Update position based on velocity
  entity.position.x += entity.velocity.x * deltaTime
  entity.position.y += entity.velocity.y * deltaTime
}

export function applyPlayerControls(player: Player, deltaTime: number): void {
  // Reset acceleration
  player.acceleration.x = 0
  player.acceleration.y = 0
  
  // Apply acceleration based on control inputs
  if (player.control.up) {
    const directionVector = angleToVector(player.rotation)
    player.acceleration.x = directionVector.x * player.speed
    player.acceleration.y = directionVector.y * player.speed
  }
  
  if (player.control.down) {
    const directionVector = angleToVector(player.rotation)
    player.acceleration.x = -directionVector.x * player.speed * 0.5 // Braking is half as powerful
    player.acceleration.y = -directionVector.y * player.speed * 0.5
  }
  
  // Rotate player based on left/right input
  const rotationSpeed = 150 // degrees per second
  if (player.control.left) {
    player.rotation -= rotationSpeed * deltaTime
  }
  if (player.control.right) {
    player.rotation += rotationSpeed * deltaTime
  }
  
  // Normalize rotation to 0-360 degrees
  player.rotation = ((player.rotation % 360) + 360) % 360
}

export function applyJoystickControl(
  player: Player, 
  angle: number | null, 
  force: number | null
): void {
  if (angle === null || force === null) return
  
  // Reset acceleration
  player.acceleration.x = 0
  player.acceleration.y = 0
  
  // Convert angle to direction vector
  player.rotation = angle
  
  // Apply acceleration based on joystick force (0-1)
  const normalizedForce = clamp(force, 0, 1)
  const directionVector = angleToVector(player.rotation)
  
  player.acceleration.x = directionVector.x * player.speed * normalizedForce
  player.acceleration.y = directionVector.y * player.speed * normalizedForce
}

export function checkEntityCollisions(entities: Entity[]): void {
  // Reset collision state
  entities.forEach(entity => {
    entity.colliding = false
  })
  
  // Check all entity pairs for collisions
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const entityA = entities[i]
      const entityB = entities[j]
      
      // Simple rectangular collision detection
      if (
        entityA.position.x < entityB.position.x + entityB.width &&
        entityA.position.x + entityA.width > entityB.position.x &&
        entityA.position.y < entityB.position.y + entityB.height &&
        entityA.position.y + entityA.height > entityB.position.y
      ) {
        // Mark both entities as colliding
        entityA.colliding = true
        entityB.colliding = true
        
        // Simple collision response - move entities apart
        const overlapX = Math.min(
          entityA.position.x + entityA.width - entityB.position.x,
          entityB.position.x + entityB.width - entityA.position.x
        )
        
        const overlapY = Math.min(
          entityA.position.y + entityA.height - entityB.position.y,
          entityB.position.y + entityB.height - entityA.position.y
        )
        
        // Push entities apart in the direction of least overlap
        if (overlapX < overlapY) {
          if (entityA.position.x < entityB.position.x) {
            entityA.position.x -= overlapX / 2
            entityB.position.x += overlapX / 2
          } else {
            entityA.position.x += overlapX / 2
            entityB.position.x -= overlapX / 2
          }
          
          // Reverse x velocity with some energy loss
          entityA.velocity.x *= -0.5
          entityB.velocity.x *= -0.5
        } else {
          if (entityA.position.y < entityB.position.y) {
            entityA.position.y -= overlapY / 2
            entityB.position.y += overlapY / 2
          } else {
            entityA.position.y += overlapY / 2
            entityB.position.y -= overlapY / 2
          }
          
          // Reverse y velocity with some energy loss
          entityA.velocity.y *= -0.5
          entityB.velocity.y *= -0.5
        }
      }
    }
  }
} 