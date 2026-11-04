import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copySkill, main, manifest, parseArgs, programs, wingetArgs, manualChecklist, run, isEntrypoint } from './cli.mjs';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pickgo-setup-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const name of manifest.skills) {
    const p = path.join(dir, '.agents/skills', name);
    fs.mkdirSync(p, { recursive: true }); fs.writeFileSync(path.join(p, 'SKILL.md'), 'source');
  }
  return dir;
}
test('strict options and profile selection', () => {
  assert.deepEqual(parseArgs(['install', '--dry-run', '--profile', 'web']), { mode: 'plan', profile: 'web' });
  assert.throws(() => parseArgs(['install', '--force']));
  assert.throws(() => parseArgs(['install', '--profile', 'typo']));
  assert.throws(() => parseArgs(['install', '--profile', 'toString']));
  assert.equal(programs('web').length, 1);
  assert.ok(programs('full').length > programs('agents').length);
});
test('plan performs no subprocesses or writes', t => {
  const base = fixture(t);
  assert.equal(main(['plan'], { base, execute: () => { throw new Error('must not run'); } }), 0);
  assert.equal(fs.existsSync(path.join(base, 'work')), false);
  assert.equal(fs.existsSync(path.join(base, '.claude')), false);
});
test('skill copy repeat is idempotent; conflict preserves whole destination', t => {
  const base = fixture(t), source = path.join(base, '.agents/skills', manifest.skills[0]), target = path.join(base, 'target');
  assert.equal(copySkill(source, target), 'ready');
  assert.equal(copySkill(source, target), 'ready');
  fs.writeFileSync(path.join(target, 'SKILL.md'), 'personal');
  fs.writeFileSync(path.join(source, 'new.txt'), 'new');
  assert.equal(copySkill(source, target), 'conflict');
  assert.equal(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8'), 'personal');
  assert.equal(fs.existsSync(path.join(target, 'new.txt')), false);
});
test('destination ancestor junction cannot redirect writes', t => {
  const base = fixture(t), external = path.join(base, 'external'), link = path.join(base, 'redirect');
  fs.mkdirSync(external); fs.symlinkSync(external, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => copySkill(path.join(base, '.agents/skills', manifest.skills[0]), path.join(link, 'skill')), /링크/);
  assert.deepEqual(fs.readdirSync(external), []);
});
test('source link rejected', t => {
  const base = fixture(t), source = path.join(base, '.agents/skills', manifest.skills[0]);
  fs.symlinkSync(path.join(base, '.agents'), path.join(source, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => copySkill(source, path.join(base, 'target')), /링크/);
});
test('installer failure recorded, successful later operations continue, no false success', t => {
  const base = fixture(t), calls = [];
  const execute = (cmd, args) => {
    calls.push([cmd, args]);
    if (cmd === 'winget.exe' && args[0] === '--version') return { ok: true };
    return { ok: false, code: 77 };
  };
  assert.equal(main(['install', '--profile', 'web'], { base, platform: 'win32', execute }), 1);
  assert.ok(calls.some(([, args]) => args[0] === 'install'));
  const reports = fs.readdirSync(path.join(base, 'work/team-setup'));
  const data = JSON.parse(fs.readFileSync(path.join(base, 'work/team-setup', reports.find(f => f.endsWith('.json')))));
  assert.ok(data.results.some(r => r.name === 'Git' && r.status === 'failed'));
  assert.equal(data.manualVerificationRequired, true);
  assert.ok(fs.existsSync(path.join(base, '.claude/skills', manifest.skills[0], 'SKILL.md')));
});
test('existing programs never upgraded, doctor does not write', t => {
  const base = fixture(t), execute = (_cmd, args) => { assert.notEqual(args[0], 'install'); return { ok: true, text: 'version' }; };
  assert.equal(main(['install', '--profile', 'web'], { base, platform: 'win32', execute }), 0);
  const before = fs.readdirSync(path.join(base, 'work/team-setup'));
  assert.equal(main(['doctor', '--profile', 'web'], { base, platform: 'win32', execute }), 0);
  assert.deepEqual(fs.readdirSync(path.join(base, 'work/team-setup')), before);
});
test('unsupported OS install is rejected before mutation', t => {
  const base = fixture(t);
  assert.throws(() => main(['install'], { base, platform: 'linux' }), /Windows/);
  assert.equal(fs.existsSync(path.join(base, '.claude')), false);
});
test('commands are noninteractive; manual gates explicit', () => {
  const args = wingetArgs('Git.Git', true);
  for (const flag of ['--exact', '--silent', '--disable-interactivity', '--no-upgrade']) assert.ok(args.includes(flag));
  assert.ok(!args.includes('--force'));
  assert.match(manualChecklist('full'), /서명/);
  assert.match(manualChecklist('agents'), /default\/hyundai_ai/);
  assert.doesNotMatch(manualChecklist('web'), /Android Studio/);
});
test('real child process exit failure is preserved', () => {
  assert.equal(run(process.execPath, ['-e', 'process.exit(7)']).code, 7);
  assert.equal(run('pickgo-command-does-not-exist', []).ok, false);
});
test('Windows npm-style command shim works from a path with spaces', { skip: process.platform !== 'win32' }, t => {
  const base = fixture(t), bin = path.join(base, 'shim bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'pickgo-shim.cmd'), '@echo off\r\necho shim-ok\r\nexit /b 0\r\n');
  const oldPath = process.env.PATH;
  process.env.PATH = `${bin}${path.delimiter}${oldPath}`;
  try {
    const result = run('pickgo-shim', ['--version']);
    assert.equal(result.ok, true, result.text);
    assert.match(result.text, /shim-ok/);
    fs.writeFileSync(path.join(bin, 'pickgo-shim.cmd'), '@echo off\r\nexit /b 7\r\n');
    assert.equal(run('pickgo-shim', []).code, 7);
  } finally { process.env.PATH = oldPath; }
});
test('existing broken Codex never triggers npm reinstall', t => {
  const base = fixture(t), calls = [];
  const execute = (cmd, args) => {
    calls.push([cmd, args]);
    if (cmd === 'codex') return { ok: false, code: 9 };
    return { ok: true, text: 'version' };
  };
  assert.equal(main(['install', '--profile', 'agents'], { base, platform: 'win32', execute }), 1);
  assert.ok(!calls.some(([,args]) => args.includes('--global')));
});
test('doctor fails when registered CLI cannot execute', t => {
  const base = fixture(t);
  for (const name of manifest.skills) copySkill(path.join(base, '.agents/skills', name), path.join(base, '.claude/skills', name));
  assert.equal(main(['doctor', '--profile', 'web'], { base, platform: 'win32', execute: (cmd) => ({ ok: cmd !== 'git', code: cmd === 'git' ? 'ENOENT' : 0 }) }), 1);
});
test('entrypoint detection resolves junction alias', t => {
  const base = fixture(t), alias = path.join(base, 'alias');
  fs.symlinkSync(path.resolve('tools/team-setup'), alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(isEntrypoint(path.join(alias, 'cli.mjs')), true);
});
