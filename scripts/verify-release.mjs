import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed.`);
}

function redactKeys(text) {
  return text
    .replace(/\b(?:sb_secret|sb_publishable)_[A-Za-z0-9_-]+/g, '[redacted API key]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted JWT]');
}

function runQuiet(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    const diagnostic = redactKeys(`${result.stdout ?? ''}${result.stderr ?? ''}`);
    if (diagnostic.trim()) process.stderr.write(diagnostic);
    throw new Error(`${command} ${args.join(' ')} failed.`);
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(redactKeys(result.stderr || `${command} failed.`));
  return result.stdout;
}

try {
  runQuiet('npx', ['supabase', 'start']);
  console.log('Local Supabase stack started (API keys suppressed).');
  run('npx', ['supabase', 'db', 'reset']);
  const status = JSON.parse(capture('npx', ['supabase', 'status', '-o', 'json']));
  const apiUrl = status.API_URL;
  const hostname = new URL(apiUrl).hostname;
  if (!['localhost', '127.0.0.1'].includes(hostname)) throw new Error('Release tests refuse to use a non-local backend.');
  const fixtures = [
    { email: 'catalina@3digit.club', password: '3digit-2000', slot: 1, display_name: 'Catalina' },
    { email: 'cristian@3digit.club', password: '3digit-2000', slot: 2, display_name: 'Cristian' },
    { email: 'outsider@3digit.local', password: 'Local-Outsider-2026' },
  ];
  const admin = createClient(apiUrl, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const fixture of fixtures) {
    const { data, error } = await admin.auth.admin.createUser({ email: fixture.email, password: fixture.password, email_confirm: true });
    if (error) throw error;
    if (fixture.slot) {
      const { error: memberError } = await admin.from('members').insert({ user_id: data.user.id, slot: fixture.slot, display_name: fixture.display_name });
      if (memberError) throw memberError;
    }
  }
  const env = {
    ...process.env,
    VITE_SUPABASE_URL: apiUrl,
    VITE_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
    TEST_MEMBER_LOGIN: 'true',
  };
  run('npm', ['run', 'test:db'], { env });
  run('npm', ['run', 'test'], { env });
  run('npx', ['playwright', 'test'], { env });
} finally {
  spawnSync('npx', ['supabase', 'stop'], { stdio: 'inherit' });
}
