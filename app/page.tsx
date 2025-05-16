import dynamic from 'next/dynamic'

// Dynamically import the Game component with no SSR
// This is important because our game uses browser APIs
const Game = dynamic(() => import('./components/game/Game'), { ssr: false })

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center">
      <Game />
    </main>
  )
}
