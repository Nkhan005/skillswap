import { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import SkillNetwork from './SkillNetwork';

/**
 * The WebGL boundary.
 *
 * This module is the ONLY place that pulls in @react-three/fiber and three,
 * and it is imported lazily (see components/Hero.jsx). Vite follows that
 * dynamic import and puts everything reachable from here into a separate
 * chunk, so a visitor on a phone that cannot run WebGL - or who prefers
 * reduced motion - never downloads the three.js runtime at all.
 *
 * Keeping it in its own file is what makes that possible: a static import
 * anywhere in the app's main tree would drag three.js back into the entry
 * bundle no matter how it is rendered.
 */
export default function HeroCanvas({ animate = true }) {
  // A ref, not state. The pointer changes on every mousemove; routing that
  // through setState would re-render the React tree dozens of times a second
  // for a value only the animation loop reads.
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e) => {
      // Normalise to -1..1 around the viewport centre so the parallax maths
      // is resolution-independent.
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <Canvas
      // dpr capped at 1.75 rather than left at the device's native ratio. A
      // 3x phone screen means 9x the fragments to shade for a glow effect
      // nobody can see the extra detail in - it is the cheapest single win
      // for battery and frame rate.
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 8.5], fov: 52 }}
      gl={{
        antialias: true,
        // alpha so the CSS gradient behind the canvas shows through and the
        // scene sits in the page instead of on top of it.
        alpha: true,
        powerPreference: 'high-performance',
      }}
      // 'demand' renders a single frame and then stops, which is what the
      // reduced-motion path wants: the composition, without the movement.
      frameloop={animate ? 'always' : 'demand'}
      style={{ position: 'absolute', inset: 0 }}
    >
      <SkillNetwork pointer={pointer} animate={animate} />
    </Canvas>
  );
}
