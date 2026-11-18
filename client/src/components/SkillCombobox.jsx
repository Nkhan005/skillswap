import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, Plus, Check } from 'lucide-react';

/**
 * A skill picker.
 *
 * ---------------------------------------------------------------------------
 * Why a combobox and not a <select>
 *
 * There are around a hundred skills across ten categories. A native select
 * with that many options is genuinely painful on a phone, and it offers no
 * way to type - so a member looking for "Hyderabadi Cuisine" has to scroll
 * past everything else to reach it.
 *
 * A combobox lets them type a few letters and matches against the aliases
 * too, so typing "biryani" finds "Hyderabadi Cuisine" and typing "js" finds
 * "JavaScript". The member does not have to guess the platform's vocabulary.
 *
 * ---------------------------------------------------------------------------
 * Why the ARIA attributes are not decoration
 *
 * A div full of clickable divs is invisible to a screen reader - it announces
 * nothing about what the control is, that a list has appeared, or which
 * option is active. The combobox pattern needs four things to work:
 *
 *   role="combobox" + aria-expanded   what it is, and whether the list is open
 *   role="listbox" / role="option"    the list and its items
 *   aria-activedescendant             which option is highlighted, WITHOUT
 *                                     moving focus out of the text input
 *   aria-selected                     which option is currently active
 *
 * aria-activedescendant is the subtle one. Arrow keys move a visual highlight
 * while the caret stays in the input, so focus never actually moves. Without
 * it, a sighted user sees the highlight move and a screen reader user hears
 * nothing at all.
 * ---------------------------------------------------------------------------
 */

export default function SkillCombobox({
  catalog = [],
  popular = [],
  selected = [],
  onAdd,
  placeholder = 'Type to search skills…',
  label,
  describedBy,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const wrapRef = useRef(null);

  // useId rather than a module counter: it stays stable across renders and
  // unique across multiple comboboxes on the same page, which this form has
  // (one for teaching, one for learning).
  const baseId = useId();
  const listId = `${baseId}-listbox`;

  const selectedKeys = useMemo(
    () => new Set(selected.map((s) => String(s).toLowerCase())),
    [selected]
  );

  /** How many members already teach each skill, for the popularity hint. */
  const teacherCounts = useMemo(() => {
    const map = new Map();
    popular.forEach((p) => map.set(String(p.name).toLowerCase(), p.teachers));
    return map;
  }, [popular]);

  /**
   * Flatten to a single ranked list when searching, keep the category
   * grouping when browsing.
   *
   * Searching and browsing are different tasks: a member who types is looking
   * for one specific thing and wants the best match first, while a member who
   * opens the list cold is exploring and wants the structure.
   */
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();

    if (!q) {
      return catalog.map((group) => ({
        category: group.category,
        skills: group.skills.filter((s) => !selectedKeys.has(s.name.toLowerCase())),
      }));
    }

    const scored = [];
    for (const group of catalog) {
      for (const skill of group.skills) {
        if (selectedKeys.has(skill.name.toLowerCase())) continue;

        const name = skill.name.toLowerCase();
        const aliasHit = (skill.aliases || []).some((a) => a.toLowerCase().includes(q));

        // Rank: exact match, then prefix, then substring, then alias-only.
        // Without this, typing "java" can list "JavaScript" below unrelated
        // skills that merely contain the letters.
        let score = -1;
        if (name === q) score = 0;
        else if (name.startsWith(q)) score = 1;
        else if (name.includes(q)) score = 2;
        else if (aliasHit) score = 3;

        if (score >= 0) scored.push({ ...skill, category: group.category, score });
      }
    }

    scored.sort(
      (a, b) =>
        a.score - b.score ||
        (teacherCounts.get(b.name.toLowerCase()) || 0) -
          (teacherCounts.get(a.name.toLowerCase()) || 0) ||
        a.name.localeCompare(b.name)
    );

    return [{ category: 'Matches', skills: scored.slice(0, 40) }];
  }, [catalog, query, selectedKeys, teacherCounts]);

  /** One flat array so arrow keys can walk across category boundaries. */
  const flat = useMemo(() => results.flatMap((g) => g.skills), [results]);

  const trimmed = query.trim();
  const exactExists = flat.some((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  const alreadyChosen = selectedKeys.has(trimmed.toLowerCase());
  const canAddCustom = trimmed.length >= 2 && !exactExists && !alreadyChosen;

  // Index length changes as the query narrows the list, so an index that was
  // valid a keystroke ago can point past the end.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Close when a click lands outside the component. Checking `relatedTarget`
  // on blur alone misses clicks on non-focusable areas, so this is needed too.
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Keep the highlighted option inside the scroll viewport.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const commit = (name) => {
    if (!name) return;
    onAdd?.(name);
    setQuery('');
    setActiveIndex(0);
    // Focus stays in the input so several skills can be added in a row
    // without reaching for the mouse between each one.
    inputRef.current?.focus();
  };

  const total = flat.length + (canAddCustom ? 1 : 0);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (total === 0) return;
      // Wrap around: pressing up from the first item reaches the last, which
      // is what the listbox pattern specifies and what people expect.
      setActiveIndex((i) => (e.key === 'ArrowDown' ? (i + 1) % total : (i - 1 + total) % total));
      return;
    }

    if (e.key === 'Enter') {
      // Only swallow Enter when the listbox is actually open with something
      // highlighted; otherwise the surrounding form can never be submitted
      // from the keyboard.
      if (!open || total === 0) return;
      e.preventDefault();
      if (activeIndex < flat.length) commit(flat[activeIndex].name);
      else if (canAddCustom) commit(trimmed);
      return;
    }

    if (e.key === 'Escape') {
      // Clear the query first, close on a second press: a member who mistyped
      // usually wants the text gone, not the whole list dismissed.
      if (query) setQuery('');
      else setOpen(false);
      return;
    }

    if (e.key === 'Tab') setOpen(false);
  };

  let runningIndex = -1;

  return (
    <div ref={wrapRef} className="relative">
      {label && (
        <label
          htmlFor={`${baseId}-input`}
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          id={`${baseId}-input`}
          ref={inputRef}
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-describedby={describedBy}
          aria-activedescendant={
            open && activeIndex < flat.length && flat[activeIndex]
              ? `${baseId}-opt-${activeIndex}`
              : undefined
          }
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {open && (
        <div
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label={label || 'Skills'}
          className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {results.map((group) =>
            group.skills.length === 0 ? null : (
              <div key={group.category}>
                {/*
                  presentation role: this heading is a visual grouping, and
                  leaving it as a plain child of the listbox would have a
                  screen reader announce it as a selectable option.
                */}
                <p
                  role="presentation"
                  className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400"
                >
                  {group.category}
                </p>

                {group.skills.map((skill) => {
                  runningIndex += 1;
                  const index = runningIndex;
                  const teachers = teacherCounts.get(skill.name.toLowerCase());

                  return (
                    <div
                      key={skill.name}
                      id={`${baseId}-opt-${index}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      data-active={index === activeIndex}
                      // onMouseDown, not onClick: mousedown fires before the
                      // input's blur, so the list is still open when the
                      // selection is made.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        commit(skill.name);
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${
                        index === activeIndex ? 'bg-brand-50 text-brand-900' : 'text-slate-700'
                      }`}
                    >
                      <span className="truncate">{skill.name}</span>
                      {teachers > 0 && (
                        <span className="shrink-0 text-xs text-slate-400">
                          {teachers} {teachers === 1 ? 'teacher' : 'teachers'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {canAddCustom &&
            (() => {
              runningIndex += 1;
              const index = runningIndex;
              return (
                <div
                  id={`${baseId}-opt-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  data-active={index === activeIndex}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(trimmed);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`mt-1 flex cursor-pointer items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-sm ${
                    index === activeIndex ? 'bg-brand-50 text-brand-900' : 'text-slate-700'
                  }`}
                >
                  <Plus size={14} className="shrink-0 text-brand-600" />
                  <span className="truncate">
                    Add &ldquo;<strong>{trimmed}</strong>&rdquo; as a new skill
                  </span>
                </div>
              );
            })()}

          {flat.length === 0 && !canAddCustom && (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              {alreadyChosen ? 'You have already added that one.' : 'No skills match that search.'}
            </p>
          )}
        </div>
      )}

      {selected.length > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <Check size={13} className="text-mint-600" />
          {selected.length} selected
        </p>
      )}
    </div>
  );
}
