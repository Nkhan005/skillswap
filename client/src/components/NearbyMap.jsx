import { useEffect, useRef } from 'react';
// maplibre-gl v6 publishes named exports only - there is no default export,
// and importing one fails at runtime rather than at build time. Map is
// aliased because it would otherwise shadow the JavaScript global.
import {
  Map as MapLibreMap,
  Marker,
  Popup,
  NavigationControl,
  GeolocateControl,
  LngLatBounds,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * The nearby map.
 *
 * ---------------------------------------------------------------------------
 * Why MapLibre, and why these tiles
 *
 * MapLibre GL renders VECTOR tiles: the browser is handed the geometry of
 * roads and labels and draws them itself. That means the map stays sharp at
 * any zoom and can be restyled to match the brand. Leaflet, the usual
 * alternative, draws raster images - fixed pictures that blur between zoom
 * levels and cannot be recoloured.
 *
 * The tiles come from OpenFreeMap, which needs no API key, imposes no request
 * limit, and permits commercial use. Google Maps would require a billing
 * account and restricts overlaying your own user data; most other providers
 * need a key that would have to be kept out of the client bundle.
 *
 * ---------------------------------------------------------------------------
 * What is plotted
 *
 * Never a real address. The server publishes `approxLocation`, which is the
 * member's true point displaced by a stable, secret-derived offset of up to
 * 450m (see server/src/utils/privacy.js). The circles drawn here are
 * deliberately large and soft so the rendering matches the honesty of the
 * data: an area, not a pin on a house.
 *
 * The distance labels are still exact, because the server computes those from
 * the real coordinates before blurring.
 * ---------------------------------------------------------------------------
 */

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

const BRAND = '#4f46e5';

/**
 * Approximate a circle on the globe as a polygon.
 *
 * A circle of fixed metres is not a circle in longitude/latitude space - it
 * is squashed horizontally, more so the further from the equator. Dividing
 * the east-west radius by cos(latitude) corrects that, so the search area
 * drawn on screen is the area actually queried.
 */
function circlePolygon([lng, lat], radiusKm, steps = 96) {
  const coords = [];
  const radiusLat = radiusKm / 110.574;
  const radiusLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));

  for (let i = 0; i <= steps; i += 1) {
    const theta = (i / steps) * 2 * Math.PI;
    coords.push([lng + radiusLng * Math.cos(theta), lat + radiusLat * Math.sin(theta)]);
  }

  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
    properties: {},
  };
}

function escapeHtml(value) {
  // Popup content is set via innerHTML by MapLibre, so anything originating
  // from another user has to be escaped. A member could otherwise put markup
  // in their display name and have it execute in every viewer's browser.
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

export default function NearbyMap({ centre, radiusKm, matches, onSelect }) {
  const container = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const ready = useRef(false);

  // --- Create the map exactly once ----------------------------------------
  useEffect(() => {
    if (map.current || !container.current) return undefined;

    map.current = new MapLibreMap({
      container: container.current,
      style: STYLE_URL,
      center: centre,
      zoom: 11,
      attributionControl: { compact: true },
    });

    map.current.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.current.addControl(
      new GeolocateControl({ trackUserLocation: false }),
      'top-right'
    );

    map.current.on('load', () => {
      ready.current = true;

      map.current.addSource('radius', { type: 'geojson', data: circlePolygon(centre, radiusKm) });
      map.current.addLayer({
        id: 'radius-fill',
        type: 'fill',
        source: 'radius',
        paint: { 'fill-color': BRAND, 'fill-opacity': 0.07 },
      });
      map.current.addLayer({
        id: 'radius-line',
        type: 'line',
        source: 'radius',
        paint: {
          'line-color': BRAND,
          'line-width': 1.5,
          'line-dasharray': [2, 2],
          'line-opacity': 0.5,
        },
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
      ready.current = false;
    };
    // Deliberately empty: the map instance must outlive prop changes. Later
    // effects mutate it imperatively instead of tearing it down, because
    // recreating a GL map on every render is both slow and visibly jarring.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Follow the radius and centre ---------------------------------------
  useEffect(() => {
    if (!map.current) return;

    const apply = () => {
      const source = map.current?.getSource('radius');
      if (!source) return;

      const ring = circlePolygon(centre, radiusKm);
      source.setData(ring);

      // Frame the whole search area rather than guessing a zoom level, so
      // 1km and 20km both fill the viewport sensibly.
      const bounds = new LngLatBounds();
      ring.geometry.coordinates[0].forEach((c) => bounds.extend(c));
      map.current.fitBounds(bounds, { padding: 48, duration: 600, maxZoom: 15 });
    };

    if (ready.current) apply();
    else map.current.once('load', apply);
  }, [centre, radiusKm]);

  // --- Redraw member markers ----------------------------------------------
  useEffect(() => {
    if (!map.current) return;

    const draw = () => {
      markers.current.forEach((m) => m.remove());
      markers.current = [];

      // The viewer's own position, drawn differently so the centre of the
      // search is never mistaken for another member.
      const self = document.createElement('div');
      self.className = 'ss-map-self';
      self.setAttribute('aria-hidden', 'true');
      markers.current.push(
        new Marker({ element: self }).setLngLat(centre).addTo(map.current)
      );

      matches.forEach((match) => {
        const coords = match.user?.approxLocation?.coordinates;
        // A member set to 'hidden' publishes no point. They still appear in
        // the list beside the map; they simply are not plotted.
        if (!Array.isArray(coords)) return;

        const el = document.createElement('button');
        el.type = 'button';
        el.className = `ss-map-pin ${match.matchType === 'mutual' ? 'is-mutual' : ''}`;
        el.setAttribute('aria-label', `${match.user.name}, ${match.distanceKm} km away`);

        const teaches = (match.theyTeachMe || []).slice(0, 3).map(escapeHtml).join(', ');

        const popup = new Popup({ offset: 18, closeButton: false }).setHTML(
          `<div class="ss-popup">
             <p class="ss-popup-name">${escapeHtml(match.user.name)}</p>
             <p class="ss-popup-meta">${escapeHtml(match.distanceKm)} km away${
               match.matchType === 'mutual' ? ' &middot; mutual match' : ''
             }</p>
             ${teaches ? `<p class="ss-popup-skills">Can teach you: ${teaches}</p>` : ''}
             <p class="ss-popup-note">Approximate area, not an exact location</p>
           </div>`
        );

        el.addEventListener('click', () => onSelect?.(match));

        markers.current.push(
          new Marker({ element: el })
            .setLngLat(coords)
            .setPopup(popup)
            .addTo(map.current)
        );
      });
    };

    if (ready.current) draw();
    else map.current.once('load', draw);

    return () => {
      markers.current.forEach((m) => m.remove());
      markers.current = [];
    };
  }, [matches, centre, onSelect]);

  return (
    <div
      ref={container}
      className="h-[460px] w-full overflow-hidden rounded-2xl border border-slate-200"
      // The map is a visual alternative to the list rendered beside it.
      // Labelling it as a group keeps it announced, while the list remains the
      // accessible path to the same information.
      role="group"
      aria-label={`Map of members within ${radiusKm} km, shown as approximate areas`}
    />
  );
}

export { circlePolygon };
