import { Link } from 'react-router-dom';
import { ArrowRight, Clock, MapPin, ShieldCheck, Repeat } from 'lucide-react';
import Hero from '../components/Hero';

/**
 * The public front door.
 *
 * Until now `/` redirected straight to /dashboard, which bounced a logged-out
 * visitor on to /login. So the only thing a first-time visitor ever saw was a
 * password field for an account they did not have, with nothing explaining
 * what the site does or what a "time credit" is.
 *
 * A marketplace cannot acquire users that way. This page answers three
 * questions before asking for a signup: what is this, how does it work, and
 * why would I trust it.
 */

const STEPS = [
  {
    icon: Repeat,
    title: 'List what you can teach',
    body: 'Pick the skills you are confident in and the ones you want to pick up. Both sides matter - the matching engine looks for two-way overlap, not just what you need.',
  },
  {
    icon: Clock,
    title: 'Teach an hour, earn a credit',
    body: 'Every completed hour of teaching credits your wallet. Credits are the only currency here, and they are created by teaching rather than bought.',
  },
  {
    icon: ArrowRight,
    title: 'Spend it on anything',
    body: 'Your credit is not tied to the person you taught. Teach Python, spend it learning guitar from somebody else entirely.',
  },
];

const PILLARS = [
  {
    icon: MapPin,
    title: 'People actually near you',
    body: 'Search within 1, 5, 10 or 20 km. Distance is measured on real geography, so "nearby" means nearby.',
  },
  {
    icon: ShieldCheck,
    title: 'Trust you can inspect',
    body: 'Every member carries a trust score built from reviews, completed swaps and how reliably they reply. The formula is published, not a black box.',
  },
  {
    icon: Clock,
    title: 'No money, by design',
    body: 'There is no payment step, no subscription and no card on file. An hour of your time is worth an hour of anyone else’s.',
  },
];

export default function Landing() {
  return (
    <main className="bg-white">
      <Hero />

      {/* How it works ---------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            How a swap works
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Three steps, no payment at any point.
          </p>
        </div>

        <ol className="mt-14 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="absolute -top-3 left-6 inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {i + 1}
              </span>
              <step.icon className="mt-2 text-brand-600" size={24} />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Why it holds together ------------------------------------------- */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Why it does not fall apart
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              A barter economy only works if people can find each other and trust what they
              find.
            </p>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {PILLARS.map((pillar) => (
              <div key={pillar.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <pillar.icon size={20} />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing call to action ------------------------------------------ */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:py-24">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          You already know something worth teaching
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
          Signing up is free and you start with credits in your wallet, so you can take your
          first lesson before you have given one.
        </p>
        <Link
          to="/register"
          className="mt-10 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          Create a free account
          <ArrowRight size={16} />
        </Link>
      </section>
    </main>
  );
}
