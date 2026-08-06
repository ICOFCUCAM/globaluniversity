// ---------------------------------------------------------------------------
// The border catalogue.
//
// WHY A CATALOGUE AND NOT SIX DRAWINGS.
//
// A border is not a picture. It is a MOULDING SECTION plus a REPEAT: a profile
// cut across the run, and an ornament carved along it. Every frame in this
// catalogue shares the section — the mitred lengths, the lit and shaded relief
// passes, the corner cartouche, the fillets — and differs only in the course
// carved into it.
//
// That is not a saving of effort, it is the reason the set holds together. Six
// frames drawn independently are six frames from six workshops; six courses cut
// into one section are one institution's frames. A university that issues a
// certificate in one and a diploma in another should look like it meant to.
//
// WHY IT IS A REGISTER AND NOT A SWITCH STATEMENT. The same argument as the
// security patterns: an unnamed border cannot be specified to a printer, cited
// in a procedure, or defended if somebody copies it. "The gold one" is not a
// thing anybody can point at. "The ICOF Acanthus Course, 11mm band, in accent
// gold" is an instruction a print shop can follow.
//
// EVERY COURSE HERE IS GEOMETRY, not a traced photograph. A photograph of a
// carved frame carries the lighting of the room it was shot in, softens at
// print resolution, and — the reason that decides it — can be lifted from a
// scan of one certificate and dropped onto a forgery. Geometry drawn from an
// equation cannot be, which is the argument behind every other layer on the
// sheet.
// ---------------------------------------------------------------------------

/** The carved run. Selects which ornament ornateFrame() cuts into the section. */
export type BorderCourse =
  | 'acanthus'
  | 'laurel'
  | 'guilloche'
  | 'meander'
  | 'rope'
  | 'bead-reel'
  | 'plain';

/**
 * The tile's run as a multiple of the band's width.
 *
 * Held here rather than inside each case, because the repeat is a property of
 * the course and the frame has to know it before it draws anything. A course
 * whose repeat is wrong reads as a machine-made moulding cut to the wrong
 * length — the join shows.
 */
export const COURSE_RUN: Record<BorderCourse, number> = {
  acanthus: 1.55,
  laurel: 1.30,
  guilloche: 1.60,
  meander: 1.80,
  rope: 1.10,
  'bead-reel': 1.00,
  plain: 1.00,
};

export interface BorderStyle {
  id: BorderCourse;
  /** The name to use in a specification, an order or a procedure. */
  name: string;
  /** What it is, in one sentence somebody can act on. */
  what: string;
  /** Where it belongs, and where it does not. */
  use: string;
}

export const BORDER_CATALOGUE: BorderStyle[] = [
  {
    id: 'acanthus',
    name: 'The ICOF Acanthus Course™',
    what:
      'An S-stem with a leaf springing above it and below it, a volute at each turn and berries in ' +
      'the eyes of the scrolls — redrawn as vector geometry from the university’s own certificate ' +
      'of 2011, not traced from a photograph of it.',
    use:
      'The degree certificate. It is the university’s own carving and the most elaborate in the ' +
      'catalogue; on a document that is mostly table it would fight the table and win.',
  },
  {
    id: 'laurel',
    name: 'ICOF Laurel Course',
    what: 'Paired leaves along a stem, bound at intervals with a ribbon.',
    use:
      'Prizes, honorary awards, letters of commendation. The wreath is what a university confers ' +
      'for distinction, so it says something the acanthus does not.',
  },
  {
    id: 'guilloche',
    name: 'ICOF Guilloché Course',
    what: 'Two counter-running strands plaited round a row of eyes — the security printer’s border.',
    use:
      'Anything where the border itself is meant to be a control rather than a decoration. Every ' +
      'crossing is fixed by the wave, so a hand copy drifts at every one of them at once.',
  },
  {
    id: 'meander',
    name: 'ICOF Greek Fret',
    what: 'The classical meander, cut as a band rather than drawn as a line so it takes the relief.',
    use:
      'Academic and severe. Suits a transcript or a statement of results better than a conferral, ' +
      'because it has no organic form to compete with type.',
  },
  {
    id: 'rope',
    name: 'ICOF Cable Moulding',
    what: 'Twisted strands cut into the section — the simplest carved run there is.',
    use:
      'The most robust at small sizes and on poor paper. Choose it when the document will be ' +
      'photocopied hard, or when the band is under about 8mm and finer carving would fill in.',
  },
  {
    id: 'bead-reel',
    name: 'ICOF Bead and Reel',
    what: 'The classical astragal: a sphere, two discs, a sphere, repeating.',
    use:
      'Quiet and formal. A good second border inside a heavier one, and a good only border on a ' +
      'certificate of attendance where a carved frame would overstate the award.',
  },
  {
    id: 'plain',
    name: 'ICOF Plain Ovolo',
    what: 'The moulded section with no carving at all — profile, relief, fillets and nothing else.',
    use:
      'Transcripts. A carved border beside columns of marks competes with the marks, and the ' +
      'legibility of the marks is that document’s whole job.',
  },
];

export function borderById(id: string): BorderStyle | undefined {
  return BORDER_CATALOGUE.find((b) => b.id === id);
}

/** The name to print in a specification for a given course. */
export function borderName(course: string): string {
  return borderById(course)?.name ?? course;
}
