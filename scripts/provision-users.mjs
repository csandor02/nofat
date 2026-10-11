import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const url = process.env.PROVISION_SUPABASE_URL;
const requested = [
  { slot: 1, display_name: 'Catalina', email: 'catalina@3digit.club', password: '3digit-2000' },
  { slot: 2, display_name: 'Cristian', email: 'cristian@3digit.club', password: '3digit-2000' },
];

if (!url) {
  throw new Error('Set PROVISION_SUPABASE_URL.');
}

const projectRef = new URL(url).hostname.split('.')[0];
let keys;
try {
  // Keep CLI output in memory: --reveal returns the active server secret key.
  const output = execFileSync(process.execPath, ['x', 'supabase', 'projects', 'api-keys', '--project-ref', projectRef, '--reveal', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  keys = JSON.parse(output);
} catch {
  throw new Error(`Could not retrieve API keys for ${projectRef}. Run [1mbunx supabase login[0m and ensure your account has access to that project.`);
}
const keyRecord = keys.find((key) => key.type === 'secret' && key.api_key?.startsWith('sb_secret_'))
  ?? keys.find((key) => key.id === 'service_role' && key.type === 'legacy');
const secret = keyRecord?.api_key;
if (!secret) throw new Error(`Supabase CLI did not return a secret key for ${projectRef}.`);
if (keyRecord.type === 'legacy') {
  try {
    const payload = JSON.parse(Buffer.from(secret.split('.')[1], 'base64url').toString('utf8'));
    if (payload.ref !== projectRef || payload.role !== 'service_role') throw new Error('The CLI service key does not match the requested project or role.');
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('The CLI returned an unreadable service key.');
    throw error;
  }
}
console.log(`Using the Supabase CLI ${keyRecord.type === 'secret' ? 'secret' : 'service_role'} key for project ${projectRef} (key value hidden).`);

const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: existingMembers, error: memberError } = await client.from('members').select('user_id,slot,display_name');
if (memberError) throw memberError;

for (const member of requested) {
  const slot = existingMembers?.find((row) => row.slot === member.slot);
  const { data: users, error: listError } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  const existingUser = users.users.find((user) => user.email?.toLowerCase() === member.email.toLowerCase());
  if (slot) {
    if (!existingUser || slot.user_id !== existingUser.id || slot.display_name !== member.display_name) throw new Error(`Slot ${member.slot} already belongs to a different identity.`);
    console.log(`${member.display_name}: already provisioned (${existingUser.id})`);
    continue;
  }
  let user = existingUser;
  if (!user) {
    const { data, error } = await client.auth.admin.createUser({ email: member.email, password: member.password, email_confirm: true });
    if (error) throw error;
    user = data.user;
  }
  const { error: insertError } = await client.from('members').insert({ user_id: user.id, slot: member.slot, display_name: member.display_name });
  if (insertError) throw insertError;
  console.log(`${member.display_name}: provisioned (${user.id})`);
}

console.log('Provisioning complete. No credentials were printed.');
