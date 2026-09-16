// ---------------------------------------------------------------------------
// THE DESIGN A DOCUMENT IS RENDERED WITH, READ SERVER-SIDE.
//
// ---------------------------------------------------------------------------
// THIS IS THE "AUTHORIZED CERTIFICATE ENGINE"
// ---------------------------------------------------------------------------
//
// The University's certificate ruling of 16 September 2026 draws it:
//
//     Academic Record → Eligibility Verification →
//     Authorized Certificate Engine → Official Certificate
//
//   "The user operating the ordinary academic system does not need to know
//    where the template is stored or how it is constructed. The system handles
//    that internally."
//
// That is this function, and it is why 101 can close `credential_templates` to
// every office but two without stopping anybody issuing anything. The design
// is read HERE, on the server, under the service key, which no row-level
// policy binds — so the officer asks for a document and never sees what it was
// made from.
//
// ---------------------------------------------------------------------------
// WHY IT IS A FILE
// ---------------------------------------------------------------------------
//
// Because it was a private function inside the delivery route, and the
// transcript route then needed the same thing to render the document at
// GENERATION time rather than at delivery time — §12: "the email should use
// the generated official document". Copying it would have left two readers of
// the University's design that could fall out of step about which version is
// active, which is the same class of fault `documentReference.ts` exists for.
// ---------------------------------------------------------------------------

import {
  defaultDesign, withDefaults,
  type CredentialDesign, type CredentialKind,
} from '@/lib/credentialTemplate';

/** The narrow shape of a Supabase client this needs — the service one. */
interface Db { from: (table: string) => any }

/**
 * The active design for a kind, or the built-in default.
 *
 * A READ FAILURE FALLS BACK RATHER THAN REFUSING. A deployment that has not run
 * the templates migration must still be able to hand a graduate their document,
 * and refusing here would make an un-run migration look like a broken
 * University.
 */
export async function activeCredentialDesign(
  db: Db,
  kind: CredentialKind,
): Promise<CredentialDesign> {
  try {
    const { data } = await db
      .from('credential_templates')
      .select('design')
      .eq('kind', kind)
      .eq('is_active', true)
      .maybeSingle();
    if (!data?.design) return defaultDesign(kind);
    return withDefaults(kind, data.design as Partial<CredentialDesign>);
  } catch {
    return defaultDesign(kind);
  }
}
