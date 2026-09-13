// ---------------------------------------------------------------------------
// NO COMPONENT IS DECLARED INSIDE ANOTHER COMPONENT.
//
// ---------------------------------------------------------------------------
// THE BUG THIS EXISTS FOR
// ---------------------------------------------------------------------------
//
// The University, on the appointment form: "immediately I type a letter the
// cursor goes off and the window cannot input character why".
//
// `Field` was declared inside the form component. A component declared inside
// another is A NEW FUNCTION ON EVERY RENDER, and React compares element types
// by identity — so on every keystroke it saw a component it had never seen
// before, threw the entire subtree away, and mounted a fresh one. The typed
// character was kept in state; the <input> it had been typed into no longer
// existed, so the focus went with it. One letter per click, on every field.
//
// ---------------------------------------------------------------------------
// WHY A TEST AND NOT CARE
// ---------------------------------------------------------------------------
//
// NOTHING ABOUT THE MARKUP WAS WRONG. Reading the JSX finds nothing, because
// the JSX is correct; the fault is entirely in WHERE the declaration sits, and
// it looks like tidy factoring. It is invisible on inspection and obvious the
// instant somebody types — which is the worst combination, because it reaches
// the University rather than the person who wrote it.
//
// A second one was found the same day in AdmissionOpenings, where the symptom
// was quieter — a checkbox losing keyboard focus on each tick — and had
// therefore never been reported at all.
//
// ---------------------------------------------------------------------------
// WHAT COUNTS AS A COMPONENT
// ---------------------------------------------------------------------------
//
// A Capitalised binding, declared at an INDENTED position (so: inside
// something), whose value is a function that returns JSX. The three things
// that look like that and are not components are excluded by name and shape:
//
//   const Icon = cond ? A : B        — choosing an already-defined component
//   const Comp = asChild ? Slot : 'a'  — the shadcn/ui `asChild` idiom
//   const LADDER = [42, 38, …]       — a capitalised constant, not a function
//
// Those hold a REFERENCE to a component rather than defining one, so their
// identity is stable across renders and React keeps the DOM node.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The project root: this file is src/lib/, so two levels up.
const root = new URL('../../', import.meta.url).pathname;

let failures = 0;
const fail = (msg) => { failures += 1; console.error(`FAIL  ${msg}`); };

/** Every .tsx under a directory. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Strip // and /* *\/ comments, so a comment about this rule never trips it. */
function decomment(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

const files = [
  ...walk(join(root, 'src', 'components')),
  ...walk(join(root, 'src', 'app')),
];

// An INDENTED declaration of a Capitalised name bound to a function.
//   const Field = ({ … }) => …      const Field = (props) => …
//   const Field = function …         function Field(…) {
const NESTED = /^([ \t]+)(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\(|function\b|async\s*\()/;
const NESTED_FN = /^([ \t]+)(?:async\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\(/;

console.log('\nNo component is declared inside another component\n');

const offenders = [];

for (const file of files) {
  const lines = decomment(readFileSync(file, 'utf8')).split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const m = NESTED.exec(line) ?? NESTED_FN.exec(line);
    if (!m) continue;

    // DOES IT RETURN JSX? A capitalised indented function that returns a
    // string, a number or a class name is not a component and remounts
    // nothing. Look at the declaration and the few lines after it.
    const window = lines.slice(i, i + 25).join('\n');
    const body = window.slice(window.indexOf(m[2]) + m[2].length);

    // `=> (` followed by a tag, `=> <tag`, or a `return (` / `return <tag`.
    const returnsJsx =
      /=>\s*\(\s*<[A-Za-z]/.test(body)
      || /=>\s*<[A-Za-z]/.test(body)
      || /return\s*\(\s*<[A-Za-z]/.test(body)
      || /return\s*<[A-Za-z]/.test(body);

    if (returnsJsx) {
      offenders.push({
        file: file.replace(root, ''),
        line: i + 1,
        name: m[2],
      });
    }
  }
}

if (offenders.length > 0) {
  for (const o of offenders) {
    fail(`${o.file}:${o.line} — <${o.name}> is declared inside another component.\n`
      + '      React re-creates it on every render, throws away the DOM it produced and\n'
      + '      builds it again — so any focused input inside it loses focus on every\n'
      + '      keystroke. Move it to module scope and pass what it needs as props.');
  }
} else {
  console.log(`ok    ${files.length} .tsx files, none declares a component inside another`);
}

// ---------------------------------------------------------------------------
// AND THE RULE CAN REFUSE SOMETHING — proved, not assumed.
// ---------------------------------------------------------------------------
//
// A guard nobody has watched refuse anything is a guard nobody has tested.
// This runs the same detection over the exact shape that broke the appointment
// form and asserts it is caught.
{
  const specimen = [
    'export default function Form() {',
    '  const [v, setV] = useState("");',
    '  const Field = ({ id, label, children }) => (',
    '    <div className="space-y-1.5">',
    '      <label htmlFor={id}>{label}</label>',
    '      {children}',
    '    </div>',
    '  );',
    '  return <Field id="a" label="b"><input value={v} /></Field>;',
    '}',
  ];

  let caught = false;
  for (let i = 0; i < specimen.length; i += 1) {
    const m = NESTED.exec(specimen[i]) ?? NESTED_FN.exec(specimen[i]);
    if (!m) continue;
    const window = specimen.slice(i, i + 25).join('\n');
    const body = window.slice(window.indexOf(m[2]) + m[2].length);
    if (/=>\s*\(\s*<[A-Za-z]/.test(body) || /=>\s*<[A-Za-z]/.test(body)
        || /return\s*\(\s*<[A-Za-z]/.test(body) || /return\s*<[A-Za-z]/.test(body)) {
      caught = true;
    }
  }

  if (caught) {
    console.log('ok    the rule catches the declaration that broke the appointment form');
  } else {
    fail('the rule did NOT catch the exact shape that broke the appointment form, so it '
      + 'is guarding nothing');
  }
}

console.log(failures === 0
  ? '\nNo nested component declarations.'
  : `\n${failures} nested component declaration(s) — typing into them loses focus.`);

process.exit(failures === 0 ? 0 : 1);
