'use client'

import dynamic from 'next/dynamic'

// Dynamically import the Game component with no SSR
// This is important because our game uses browser APIs
const Game = dynamic(() => import('./game/Game'), { ssr: false })

export default function GameClient() {
  return <Game />
} 