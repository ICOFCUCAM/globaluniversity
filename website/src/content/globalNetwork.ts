// ---------------------------------------------------------------------------
// THE NODES ON THE GLOBAL NETWORK MAP.
//
// Every entry here is a place this university can name and a person can go to,
// or a fellowship it demonstrably belongs to. The list is short on purpose.
//
// WHAT IS NOT HERE, AND WHY NOT.
//
// A brief for this section proposed showing "🇨🇲 Cameroon, South Africa,
// Zambia", "students across Africa, Europe, the Americas and Asia", "countries
// where graduates serve" and a "global alumni network". Those would make the
// strongest map on this page and not one of them can be evidenced:
//
//   South Africa and Zambia appear nowhere in this system — not in the
//   campuses, the faculty roster, the partner list or the accreditation
//   content. Putting a pin on a country because it would look good is the
//   difference between a map and a poster.
//
//   Student and alumni geography comes from the student register, which is
//   empty. The query is one line long and waiting; see PENDING_MEASURES in
//   institutionalFacts.ts.
//
// A world map is the most checkable thing a university publishes. Every pin is
// a claim that somebody is there, and the first person to ask "which students
// in Brazil?" ends the conversation — and takes the accreditation claim, the
// credit values and the sealed certificate down with it.
//
// TO ADD A NODE: it needs a name, a real coordinate, and a kind that describes
// what it actually is. If it is a partner, it is a partner; if the university
// teaches there, it is a campus. Those are different claims and the legend
// keeps them apart.
// ---------------------------------------------------------------------------

export type NodeKind = 'campus' | 'centre' | 'fellowship' | 'online';

export interface NetworkNode {
  name: string;
  lat: number;
  lon: number;
  kind: NodeKind;
  /** Spoken form, used in the map's accessible description. */
  kindLabel: string;
}

export const NETWORK_KINDS: Record<
  NodeKind,
  { label: string; fill: string; dot: number; halo: number }
> = {
  campus: { label: 'University campus', fill: '#f7dc79', dot: 5.5, halo: 20 },
  centre: { label: 'Professional development centre', fill: '#e9c14a', dot: 4.5, halo: 15 },
  fellowship: { label: 'ICOF fellowship — colleges and seminaries', fill: '#a99ccd', dot: 3.8, halo: 12 },
  online: { label: 'Online, worldwide', fill: '#ffffff', dot: 4, halo: 14 },
};

export const NETWORK_NODES: NetworkNode[] = [
  // The university's own places.
  //
  // ONE NODE FOR TWO CAMPUSES. Buea and Douala are sixty kilometres apart —
  // half a degree of longitude — and at world scale their dots and their labels
  // sit on top of each other, which rendered as "Doeala". Two illegible pins
  // communicate less than one legible one, and the campus section below gives
  // each of them a photograph, an address and its own map link. A world map is
  // for showing reach, not for navigation.
  {
    name: 'Cameroon — Buea & Douala',
    lat: 4.1,
    lon: 9.5,
    kind: 'campus',
    kindLabel: 'principal campus at Buea and the School of Theology at Douala',
  },
  {
    name: 'Nigeria — PPDI-RC',
    lat: 9.08,
    lon: 8.68,
    kind: 'centre',
    kindLabel: 'professional development and applied research centre',
  },

  // The International Circle of Faith, which this university was founded
  // within and whose reach it describes on the About page: "a contemporary
  // movement... with a global reach... unites ministers and ministries
  // worldwide". These mark the continents that fellowship is stated to span,
  // NOT individual institutions the university can name — which is why they
  // carry their own legend entry rather than being drawn as campuses.
  {
    name: 'The Americas',
    lat: 38.0,
    lon: -95.0,
    kind: 'fellowship',
    kindLabel: 'ICOF fellowship of colleges and seminaries',
  },
  {
    name: 'Europe',
    lat: 50.5,
    lon: 8.0,
    kind: 'fellowship',
    kindLabel: 'ICOF fellowship of colleges and seminaries',
  },
  {
    name: 'Asia',
    lat: 22.0,
    lon: 92.0,
    kind: 'fellowship',
    kindLabel: 'ICOF fellowship of colleges and seminaries',
  },
];
