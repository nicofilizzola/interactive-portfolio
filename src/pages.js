import { LANDING_ROUTE, hashForRoute, titleForRoute } from './routes.js';

// Lorem ipsum, per the spec — but differentiated enough to verify routing by
// eye. Each page carries its own heading, a visible copy of its own hash, and a
// distinct paragraph count, so a wrong-face bug reads as "wrong page" rather
// than "the text looks different".
export const PAGES = {
  work: {
    title: titleForRoute('work'),
    blocks: [
      'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.',
      'Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae.',
      'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.',
      'Sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.',
      'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.',
      'Sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat.',
    ],
  },
  writing: {
    title: titleForRoute('writing'),
    blocks: [
      'At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium.',
      'Voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati.',
      'Similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.',
      'Et harum quidem rerum facilis est et expedita distinctio.',
      'Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus.',
    ],
  },
  about: {
    title: titleForRoute('about'),
    blocks: [
      'Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae.',
      'Vel illum qui dolorem eum fugiat quo voluptas nulla pariatur.',
      'Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet.',
      'Ut et voluptates repudiandae sint et molestiae non recusandae.',
    ],
  },
  contact: {
    title: titleForRoute('contact'),
    blocks: [
      'Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores.',
      'Alias consequatur aut perferendis doloribus asperiores repellat.',
      'Omnis voluptas assumenda est, omnis dolor repellendus.',
    ],
  },
  play: {
    title: titleForRoute('play'),
    blocks: [
      'Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam.',
      'Nisi ut aliquid ex ea commodi consequatur quis autem vel eum.',
    ],
  },
};

// Pure and DOM-free, so it unit-tests; src/main.js does the single innerHTML
// assignment. Every string here is project-authored, so this is not a
// sanitisation question — it becomes one the moment any content comes from
// outside this repo.
//
// The h1 is focusable (tabindex="-1") so main.js can move focus to it after a
// route change: without that a screen-reader user gets no indication that
// anything happened.
export function renderPage(route) {
  if (route === LANDING_ROUTE) return '';

  const page = PAGES[route];
  if (page === undefined) return '';

  const paragraphs = page.blocks.map((block) => `<p>${block}</p>`).join('\n      ');

  return `<article>
      <h1 tabindex="-1">${page.title}</h1>
      <p class="page-hash">${hashForRoute(route)}</p>
      ${paragraphs}
    </article>`;
}
