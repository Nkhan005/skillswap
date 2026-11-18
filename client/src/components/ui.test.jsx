import { render, screen } from '@testing-library/react';
import { Avatar, TrustBadge, Stars } from './ui';

/**
 * These suites cover two things worth the effort: bugs that actually shipped
 * once, and the trust-band rules the product depends on. Tests for code that
 * never broke and encodes no rule tend to just restate the implementation.
 */

describe('Avatar', () => {
  it('builds initials from the first two words of a name', () => {
    // Arrange / Act
    render(<Avatar name="Gowthami Reddy" />);

    // Assert
    expect(screen.getByText('GR')).toBeInTheDocument();
  });

  it('handles a single-word name without crashing on the missing surname', () => {
    render(<Avatar name="Gowthami" />);

    expect(screen.getByText('G')).toBeInTheDocument();
  });

  it('ignores extra whitespace rather than turning it into blank initials', () => {
    render(<Avatar name="  Arjun   Mehta  " />);

    expect(screen.getByText('AM')).toBeInTheDocument();
  });

  it('falls back to ? when the name is empty', () => {
    render(<Avatar name="" />);

    expect(screen.getByText('?')).toBeInTheDocument();
  });

  // Regression: this rendered a <div>, which is invalid inside the <p> that
  // wraps it on the profile and match cards. React reports it as a hydration
  // error and the browser silently restructures the DOM around it.
  it('renders an inline element so it stays valid inside a paragraph', () => {
    const { container } = render(<Avatar name="Priya Nair" />);

    const el = container.firstChild;
    expect(el.tagName).toBe('SPAN');
  });

  it('renders the photo with the name as alt text when a src is supplied', () => {
    render(<Avatar name="Daniel Okafor" src="https://example.com/d.jpg" />);

    const img = screen.getByRole('img', { name: 'Daniel Okafor' });
    expect(img).toHaveAttribute('src', 'https://example.com/d.jpg');
  });

  it('hides the initials fallback from screen readers', () => {
    // The initials duplicate the name already announced next to the avatar,
    // so reading them out loud adds noise rather than information.
    const { container } = render(<Avatar name="Meera Iyer" />);

    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('TrustBadge', () => {
  // The band thresholds are a product rule, so they are asserted at the
  // boundaries - that is where an off-by-one in the table would hide.
  it.each([
    [100, 'Trusted'],
    [80, 'Trusted'],
    [79, 'Established'],
    [50, 'Established'],
    [49, 'Building'],
    [1, 'Building'],
    [0, 'New'],
  ])('scores %i as %s', (score, expected) => {
    render(<TrustBadge score={score} />);

    expect(screen.getByTitle(`Trust score ${score} of 100 - ${expected}`)).toBeInTheDocument();
  });

  it('shows the score out of 100 so a bare number cannot be misread', () => {
    render(<TrustBadge score={64} />);

    expect(screen.getByText('64')).toBeInTheDocument();
    expect(screen.getByText('/100')).toBeInTheDocument();
  });

  it('omits the /100 suffix in compact placements', () => {
    render(<TrustBadge score={64} showLabel={false} />);

    expect(screen.getByText('64')).toBeInTheDocument();
    expect(screen.queryByText('/100')).not.toBeInTheDocument();
  });

  it('treats a brand new member as New rather than Trusted', () => {
    // A zero score must not fall through the table and pick up the top band.
    render(<TrustBadge score={0} />);

    expect(screen.getByTitle(/New$/)).toBeInTheDocument();
  });
});

describe('Stars', () => {
  it('announces the rating as text for screen readers', () => {
    render(<Stars rating={4} />);

    expect(screen.getByLabelText('4 out of 5')).toBeInTheDocument();
  });

  it('always renders five stars so the row width never shifts', () => {
    const { container } = render(<Stars rating={2} />);

    expect(container.querySelectorAll('svg')).toHaveLength(5);
  });

  it('rounds a fractional rating to the nearest filled star', () => {
    // 3.6 should fill four, not three: averageRating is rarely a whole number.
    const { container } = render(<Stars rating={3.6} />);

    const filled = container.querySelectorAll('svg.fill-amber-400');
    expect(filled).toHaveLength(4);
  });

  it('fills nothing for an unrated member', () => {
    const { container } = render(<Stars rating={0} />);

    expect(container.querySelectorAll('svg.fill-amber-400')).toHaveLength(0);
  });
});
