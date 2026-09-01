import { describe, expect, it } from 'vitest';
import { PAGES, renderPage } from '../src/pages.js';
import { LANDING_ROUTE, ROUTES, hashForRoute, titleForRoute } from '../src/routes.js';

describe('PAGES', () => {
  it('has a page for every route, and a route for every page', () => {
    expect(Object.keys(PAGES).sort()).toEqual(ROUTES.map((entry) => entry.route).sort());
  });

  it('titles each page with its user-visible section name', () => {
    expect(PAGES.work.title).toBe('Work');
    expect(PAGES.about.title).toBe('About');
    expect(PAGES.writing.title).toBe('Writing');
    expect(PAGES.play.title).toBe('Playground');
    expect(PAGES.contact.title).toBe('Contact');
  });

  it('gives every page a distinct paragraph count between 2 and 6', () => {
    const counts = ROUTES.map((entry) => PAGES[entry.route].blocks.length);
    expect(counts.every((count) => count >= 2 && count <= 6)).toBe(true);
    expect(new Set(counts).size).toBe(counts.length);
  });

  it('gives every page distinct text, so a wrong-face bug is visible', () => {
    const firstLines = ROUTES.map((entry) => PAGES[entry.route].blocks[0]);
    expect(new Set(firstLines).size).toBe(firstLines.length);
  });
});

describe('renderPage', () => {
  it('renders the heading, the route\'s own hash, and every paragraph', () => {
    const html = renderPage('writing');
    expect(html).toContain('<h1');
    expect(html).toContain('Writing');
    expect(html).toContain(hashForRoute('writing'));
    for (const block of PAGES.writing.blocks) {
      expect(html).toContain(`<p>${block}</p>`);
    }
  });

  it('makes the heading focusable, so a route change can be announced', () => {
    expect(renderPage('work')).toContain('tabindex="-1"');
  });

  it('renders nothing for the landing page', () => {
    expect(renderPage(LANDING_ROUTE)).toBe('');
    expect(renderPage('nonsense')).toBe('');
  });

  it('is pure: the same route renders identically every time', () => {
    expect(renderPage('about')).toBe(renderPage('about'));
  });

  it('renders each route with its own hash, not another route\'s', () => {
    for (const entry of ROUTES) {
      const html = renderPage(entry.route);
      expect(html).toContain(entry.hash);
      for (const other of ROUTES) {
        if (other.route !== entry.route) expect(html).not.toContain(other.hash);
      }
    }
  });
});
