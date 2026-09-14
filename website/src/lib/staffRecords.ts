// ---------------------------------------------------------------------------
// WHAT A POST MAKES SOMEBODY, AND WHAT IT DOES NOT.
//
// ---------------------------------------------------------------------------
// WHY THE ROLE IS NOT A DROPDOWN
// ---------------------------------------------------------------------------
//
// When an officer opens a staff record, the account needs a role. The obvious
// thing is to ask — and the obvious thing is wrong: it would let somebody
// appointed to a lectureship be given a Registrar's account, with nobody having
// approved that and nothing in the record saying it happened.
//
// The University already decided what the post is when it filed the position
// under a family. That decision was taken once, by the office that keeps the
// register of posts, and this reads it. An account's powers then follow from
// the appointment rather than from whoever happened to open the record.
//
// ---------------------------------------------------------------------------
// AND WHERE THE MAPPING IS NOT OBVIOUS, IT IS THE NARROWER ONE
// ---------------------------------------------------------------------------
//
// `executive` and `academic-administration` cover several offices between them
// — a Vice-Chancellor and a Director of Academic Affairs are both executive,
// and they do not hold the same powers. A family cannot tell them apart, so
// neither is given the greater role: an account that can do too much is a
// mistake nobody notices, and an account that can do too little is a mistake
// somebody reports on the first morning.
//
// THE SUPERADMINISTRATOR RAISES IT WHERE THE POST REALLY IS SENIOR. That is a
// deliberate second act by the office that assigns roles, which is where a
// grant of that size belongs.
// ---------------------------------------------------------------------------

import type { UserRole } from './types';

/**
 * The families whose holders teach, and therefore need a row in `lecturers` as
 * well as one in the staff register.
 *
 * A DEAN TEACHES. Faculty leadership is included because a Dean who cannot be
 * allocated a course is a Dean who cannot do half their job — and the teaching
 * record is what allocates one.
 */
export const TEACHES: string[] = ['academic-staff', 'faculty-leadership'];

/**
 * The role an account gets, from the family the post is filed under.
 *
 * A post filed under `other`, or under nothing at all, comes back as the LEAST
 * that lets somebody sign in and see their own record — because a post nobody
 * filed is a post nobody decided the powers of.
 */
const BY_FAMILY: Record<string, UserRole> = {
  'academic-staff': 'lecturer',
  'faculty-leadership': 'dean',
  'academic-administration': 'academic-office',
  'student-services': 'student-affairs',
  ict: 'admin',
  administration: 'registrar',
  // SEE THE HEADER. `executive` covers the Vice-Chancellor and it covers a
  // Director; a family cannot tell them apart, so this is the narrower of the
  // two and the Superadministrator raises it where the post really is senior.
  executive: 'academic-office',
};

/**
 * NOT A ROLE THIS MAPPING WILL EVER PRODUCE.
 *
 * `superadmin` is system custody and `chancellor` and `vice-chancellor` are the
 * University's two most senior offices. None of the three may be minted by
 * opening a staff record — the staff route already refuses to grant at or above
 * the granter's own rank, and this makes it impossible rather than refused.
 */
export const NEVER_FROM_AN_APPOINTMENT: UserRole[] = [
  'superadmin', 'chancellor', 'vice-chancellor',
];

export function roleForFamily(family: string | null | undefined): UserRole {
  const role = BY_FAMILY[String(family ?? '')];
  if (!role || NEVER_FROM_AN_APPOINTMENT.includes(role)) {
    // A POST NOBODY FILED GETS THE SMALLEST ACCOUNT THERE IS. They can sign in
    // and see their own staff record; anything more is a decision somebody has
    // to take on purpose.
    return 'lecturer';
  }
  return role;
}
