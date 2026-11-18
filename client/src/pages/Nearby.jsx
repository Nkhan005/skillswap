import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ShieldCheck, Info, Users } from 'lucide-react';
import { endpoints } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Avatar, Chip, TrustBadge, Spinner, EmptyState, ErrorNote } from '../components/ui';

/**
 * Lazy, for the same reason as the hero: maplibre-gl is a large WebGL library
 * and most sessions never open this page. Loading it on demand keeps it out
 * of the bundle every other page pays for.
 */
const NearbyMap = lazy(() => import('../components/NearbyMap'));

/** The presets from the handwritten notes. */
const RADII = [1, 5, 10, 20];

/** Central Hyderabad, used only when a member has set no location at all. */
const FALLBACK_CENTRE = [78.4867, 17.385];

export default function Nearby() {
  const { user } = useAuth();
  const [radiusKm, setRadiusKm] = useState(10);
  const [mutualOnly, setMutualOnly] = useState(false);
  const [matches, setMatches] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  // useMemo so the array identity is stable. A fresh [lng, lat] literal on
  // every render would retrigger the map's effects continuously, refitting
  // the viewport in a loop.
  const centre = useMemo(() => {
    const coords = user?.location?.coordinates;
    return Array.isArray(coords) && coords.length === 2 ? coords : FALLBACK_CENTRE;
  }, [user]);

  const hasLocation = Array.isArray(user?.location?.coordinates);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);

    endpoints.matching
      .nearby({ radius: radiusKm, mutualOnly: String(mutualOnly), skillFilter: 'false' })
      .then((res) => {
        if (cancelled) return;
        setMatches(res.data.matches || []);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Could not load members nearby');
        setStatus('error');
      });

    // Guard against a slow response for an old radius overwriting a newer
    // one: without this, clicking 1km then 20km can leave 1km's results on
    // screen if the first request happens to finish last.
    return () => {
      cancelled = true;
    };
  }, [radiusKm, mutualOnly]);

  const handleSelect = useCallback((match) => setSelected(match), []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <MapPin className="text-brand-600" size={24} />
          People near you
        </h1>
        <p className="mt-1 text-slate-600">
          Everyone inside your chosen radius, whether or not your skills already overlap.
        </p>
      </header>

      {/* Radius selector ------------------------------------------------- */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Search radius"
          className="inline-flex rounded-xl border border-slate-200 bg-white p-1"
        >
          {RADII.map((km) => (
            <button
              key={km}
              type="button"
              onClick={() => setRadiusKm(km)}
              aria-pressed={radiusKm === km}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                radiusKm === km ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {km} km
            </button>
          ))}
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={mutualOnly}
            onChange={(e) => setMutualOnly(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          Mutual matches only
        </label>

        {status === 'ready' && (
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
            <Users size={15} />
            {matches.length} within {radiusKm} km
          </span>
        )}
      </div>

      {!hasLocation && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Info size={18} className="mt-0.5 shrink-0" />
          <p>
            You have not set your location yet, so this map is centred on a default point.{' '}
            <Link to="/profile" className="font-semibold underline">
              Add it to your profile
            </Link>{' '}
            to see who is genuinely near you.
          </p>
        </div>
      )}

      {status === 'error' && <ErrorNote>{error}</ErrorNote>}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Map ------------------------------------------------------------ */}
        <div>
          <Suspense
            fallback={
              <div className="grid h-[460px] place-items-center rounded-2xl border border-slate-200 bg-slate-50">
                <Spinner label="Loading map" />
              </div>
            }
          >
            <NearbyMap
              centre={centre}
              radiusKm={radiusKm}
              matches={matches}
              onSelect={handleSelect}
            />
          </Suspense>

          {/*
            Stated plainly rather than buried in a privacy policy. People
            decide what to share based on what they think is published, so
            telling them the truth here is part of the feature working.
          */}
          <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-mint-600" />
            Members are shown as approximate areas, offset by up to 450 m. Exact
            locations are never published &mdash; distances stay accurate because they
            are calculated before the offset is applied. You can widen this to city
            level, or hide yourself entirely, from your profile.
          </p>
        </div>

        {/* Companion list -------------------------------------------------- */}
        <div>
          {status === 'loading' && <Spinner label="Finding people nearby" />}

          {status === 'ready' && matches.length === 0 && (
            <EmptyState
              icon={MapPin}
              title="Nobody here yet"
              description={`No members within ${radiusKm} km. Try a wider radius.`}
            />
          )}

          {status === 'ready' && matches.length > 0 && (
            <ul className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
              {matches.map((match) => (
                <li key={match.user._id}>
                  <Link
                    to={`/profile/${match.user._id}`}
                    onMouseEnter={() => handleSelect(match)}
                    className={`flex items-start gap-3 rounded-xl border p-3 transition hover:border-brand-300 hover:bg-brand-50/40 ${
                      selected?.user?._id === match.user._id
                        ? 'border-brand-400 bg-brand-50/60'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <Avatar name={match.user.name} src={match.user.avatarUrl} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-slate-900">
                          {match.user.name}
                        </span>
                        {match.matchType === 'mutual' && <Chip tone="mint">Mutual</Chip>}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {match.distanceKm} km away
                        {match.user.city ? ` · ${match.user.city}` : ''}
                      </p>
                      {match.theyTeachMe?.length > 0 && (
                        <p className="mt-1 truncate text-xs text-slate-600">
                          Teaches: {match.theyTeachMe.slice(0, 3).join(', ')}
                        </p>
                      )}
                    </div>
                    <TrustBadge score={match.user.trustScore ?? 0} size="sm" showLabel={false} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
