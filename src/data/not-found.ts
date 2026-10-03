// The 404 page's words. The links come from the menus in nav.ts.
import { mainNav, paths } from './nav';
import { edition2027 } from './edition-2027';

const notes: Record<string, string> = {
  [paths.home]: `KCD Texas ${edition2027.year} in ${edition2027.city}`,
  [paths.cfp]: 'The call for proposals',
  [paths.sponsors]: `Sponsor KCD Texas ${edition2027.year}`,
  [paths.tickets]: 'Tickets and how to hear first',
  [paths.edition2026]: 'The 2026 program and recordings',
  [paths.about]: 'Who runs KCD Texas',
};

export const notFound = {
  title: 'Page not found · KCD Texas',
  description: 'This page doesn’t exist on kcdtexas.org.',
  kicker: 'Error 404',
  // The smoke test looks for this heading.
  heading: 'This page doesn\'t exist',
  lead: 'It may have moved. Try one of these pages, or email us and we’ll point you to it.',
  links: [{ href: paths.home, label: 'Home' }, ...mainNav].map((l) => ({ ...l, note: notes[l.href] })),
} as const;
