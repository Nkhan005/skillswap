import { Suspense, lazy, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

/**
 * The lazy boundary.
 *
 * React.lazy turns this into a dynamic import(), which Vite treats as a code
 * split point. Three.js and @react-three/fiber land in their own chunk and are
 * fetched only when this component decides to render them - which it refuses
 * to do on machines without WebGL.
 *
 * Those visitors download none of it.
 */
const HeroCanvas = lazy(() => import('../three/HeroCanvas'));

/**
 * Can this browser actually run the scene, and does the user want movement?
 *
 * Two separate questions, deliberately:
 *   - WebGL support is a capability. Without it the canvas renders black.
 *   - prefers-reduced-motion is a preference, set by people who get motion
 *     sickness or migraines from drifting animation. Honouring it is not
 *     optional politeness; ignoring it makes the site unusable for them.
 *
 * The distinction matters because the answers differ: no WebGL means show the
 * static fallback, while reduced motion means show the scene without movement.
 */
function useSceneSupport() {
  const [support, setSupport] = useState({ webgl: false, animate: false, ready: false });

  useEffect(() => {
    // Probe with a throwaway canvas. Checking for `window.WebGLRenderingContext`
    // is not enough - the constructor exists on machines where context
    // creation still fails, e.g. with hardware acceleration switched off.
    let webgl = false;
    try {
      const canvas = document.createElement('canvas');
      webgl = Boolean(
        canvas.getContext('webgl2') ||
          canvas.getContext('webgl') ||
          canvas.getContext('experimental-webgl')
      );
    } catch {
      webgl = false;
    }

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setSupport({ webgl, animate: webgl && !query.matches, ready: true });

    apply();
    // The preference can change while the page is open (system settings), so
    // react to it rather than reading it once.
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  return support;
}

/**
 * The still image behind the canvas.
 *
 * It is always rendered, with the canvas layered over it. That means there is
 * never a blank rectangle while the 3D chunk downloads, and on a machine that
 * cannot run WebGL this *is* the hero - a composed gradient rather than an
 * apology.
 */
function StaticBackdrop() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900" />
      <div className="absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-mint-500/15 blur-3xl" />
    </div>
  );
}

export default function Hero() {
  const { webgl, animate, ready } = useSceneSupport();

  return (
    <section className="relative isolate overflow-hidden">
      <StaticBackdrop />

      {/*
        Rendered only once the probe has run. Mounting the canvas before we
        know the answer would download three.js on machines that are about to
        reject it, which defeats the whole arrangement.
      */}
      {ready && webgl && (
        <Suspense fallback={null}>
          <HeroCanvas animate={animate} />
        </Suspense>
      )}

      {/*
        The copy is real DOM text sitting above the canvas, not geometry inside
        it. Screen readers read it, search engines index it, and users can
        select and translate it - none of which is true of text baked into
        WebGL. This is the whole reason the 3D is a backdrop and not the page.
      */}
      <div className="relative mx-auto flex min-h-[560px] max-w-5xl flex-col items-center justify-center px-4 py-24 text-center sm:py-32">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-brand-200 backdrop-blur">
          <Sparkles size={14} />
          No money. No subscriptions. Just skills.
        </span>

        <h1 className="text-balance text-4xl font-bold tracking-tight text-white sm:text-6xl">
          Exchange Skills,{' '}
          <span className="bg-gradient-to-r from-brand-300 to-mint-400 bg-clip-text text-transparent">
            Not Money
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-slate-300">
          Teach what you know, learn what you do not. Earn a time credit for every hour
          you teach and spend it learning anything else on the platform &mdash; from
          guitar to Python to conversational Telugu.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/register"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
          >
            Start swapping free
            <ArrowRight size={16} />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
          >
            I already have an account
          </Link>
        </div>

        <p className="mt-8 text-sm text-slate-400">
          You start with free credits, so you can learn before you have taught anything.
        </p>
      </div>
    </section>
  );
}
