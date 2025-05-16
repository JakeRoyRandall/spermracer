# Sperm Racer

A cartoon-style, top-down racing game designed for mobile browsers. Players control a character navigating a short track against AI opponents, trying to achieve the best time.

## Features

- Mobile-friendly with virtual joystick controls
- Cartoon visual style
- AI opponents
- Time-based racing
- Horizontal gameplay optimized for mobile
- Single race track (expandable)

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Shadcn UI for UI components
- Canvas API for game rendering
- NippleJS for virtual joystick

## Development Plan

### Phase 1: Setup & Core Engine
- [x] Project initialization
- [ ] Game canvas setup
- [ ] Basic physics engine
- [ ] Player movement

### Phase 2: Player Controls & Track
- [ ] Virtual joystick implementation
- [ ] Character design and animation
- [ ] Track design
- [ ] Collision detection

### Phase 3: Game Logic & AI
- [ ] Race timing system
- [ ] AI opponent behavior
- [ ] Game states (start, racing, finish)
- [ ] Score tracking

### Phase 4: Polish & Launch
- [ ] Visual effects and animations
- [ ] Sound effects
- [ ] Performance optimization
- [ ] Responsive testing

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Visit http://localhost:3000 to view the game.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
