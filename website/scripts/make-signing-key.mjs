// ---------------------------------------------------------------------------
// Make a credential signing key.
//
//   npm run make-signing-key
//
// Prints an Ed25519 key pair and what to do with it. The key is generated on
// this machine and never leaves it — nothing is sent anywhere, and this script
// makes no network call.
//
// The private key is printed to the terminal and NOT written to a file, so it
// does not end up committed by accident. Copy it out of the terminal.
// ---------------------------------------------------------------------------

import { generateKeyPairSync, createHash } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const keyId = createHash('sha256').update(publicKeyPem.replace(/\s+/g, '')).digest('hex').slice(0, 16);

console.log(`
================================================================================
 ICOF GLOBAL UNIVERSITY — CREDENTIAL SIGNING KEY
 Key id: ${keyId}     Algorithm: Ed25519
================================================================================

1. COPY EVERYTHING BETWEEN THE LINES BELOW, including the BEGIN and END lines.

--------------------------------------------------------------------------------
${privateKeyPem.trim()}
--------------------------------------------------------------------------------

2. In Vercel: Settings -> Environment Variables -> Add New.
     Name:  CREDENTIAL_SIGNING_KEY
     Value: what you just copied
     Environments: Production (and Preview, if you want signing there too)

3. Redeploy. Vercel does not apply a new variable to a running deployment.

4. Check it: open  /api/credential/key  on the site. It should report
   "configured": true and key id ${keyId}.

5. Sign what is already on the register: Credentials -> Register ->
   Document signing -> "Sign them". Nothing about those credentials changes
   except that a signature is added.

--------------------------------------------------------------------------------
 KEEP THIS KEY. Losing it does not invalidate anything already signed, but
 nothing can ever be re-signed under it. Do not commit it, do not email it.
 It is not written to any file by this script.
--------------------------------------------------------------------------------

 The matching PUBLIC key, which is safe to share and is published automatically
 at /api/credential/key once the private key is set:

${publicKeyPem.trim()}
`);
