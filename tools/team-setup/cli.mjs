#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '../..');
export const manifest = JSON.parse(fs.readFileSync(path.join(here, 'manifest.json'), 'utf8'));
const levels = { web: 0, agents: 1, full: 2 };
export function parseArgs(args) {
  let mode = args.shift() ?? 'plan';
  let profile = 'full';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile') profile = args[++i];
    else if (args[i] === '--dry-run') mode = 'plan';
    else throw new Error(`알 수 없는 옵션: ${args[i]}`);
  }
  if (!['install', 'plan', 'doctor'].includes(mode) || !Object.hasOwn(levels, profile)) throw new Error('사용법: [install|plan|doctor] [--profile web|agents|full] [--dry-run]');
  return { mode, profile };
}
export function programs(profile) { return manifest.programs.filter(p => levels[p.profile] <= levels[profile]); }
export function wingetArgs(id, install = false) {
  return [install ? 'install' : 'list', '--id', id, '--exact', '--source', 'winget', '--accept-source-agreements', '--disable-interactivity', ...(install ? ['--silent', '--accept-package-agreements', '--no-upgrade'] : [])];
}
export function resolveCommand(command) {
  if (path.isAbsolute(command)) return fs.existsSync(command) ? command : null;
  const extensions = process.platform === 'win32' ? (/\.(exe|com|cmd|bat)$/i.test(command) ? [''] : ['.exe', '.com', '.cmd', '.bat']) : [''];
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    // Do not execute a same-name file from the checkout or a relative PATH entry.
    if (!path.isAbsolute(dir) || path.resolve(dir).toLowerCase() === root.toLowerCase()) continue;
    for (const ext of extensions) {
      const candidate = path.join(dir, command + ext);
      try { if (fs.statSync(candidate).isFile()) return candidate; } catch { /* next candidate */ }
    }
  }
  return null;
}
export function run(command, args, inherit = false) {
  const candidate = resolveCommand(command);
  if (!candidate) return { ok: false, code: 'ENOENT', text: '' };
  command = candidate;
  // npm exposes Windows commands as .cmd shims. Invoke via PowerShell with
  // literal arguments, not cmd.exe string concatenation or shell:true.
  if (process.platform === 'win32') {
    if (/\.(cmd|bat)$/i.test(candidate)) {
      const literal = s => "'" + s.replaceAll("'", "''") + "'";
      const script = `& ${[candidate, ...args].map(literal).join(' ')}; exit $LASTEXITCODE`;
      command = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
      args = ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];
    }
  }
  const r = spawnSync(command, args, { cwd: root, shell: false, windowsHide: true, encoding: 'utf8', timeout: inherit ? 1200000 : 60000, stdio: inherit ? 'inherit' : 'pipe' });
  return { ok: !r.error && r.status === 0, code: r.error?.code ?? r.status, text: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}
// Reject symlinks/junctions at every existing ancestor, including broken links.
export function assertPlain(target) {
  let cursor = path.resolve(target);
  while (true) {
    try { if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`링크 경로 거부: ${cursor}`); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
}
function tree(dir, relative = '') {
  assertPlain(dir);
  const result = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(relative, e.name), full = path.join(dir, e.name);
    if (e.isSymbolicLink()) throw new Error(`스킬 링크 거부: ${full}`);
    if (e.isDirectory()) result.push(...tree(full, rel));
    else if (e.isFile()) result.push(rel);
    else throw new Error(`일반 파일 아님: ${full}`);
  }
  return result;
}
export function copySkill(source, target) {
  assertPlain(source); assertPlain(target);
  const files = tree(source);
  // Preflight the entire skill: never create a mixed version after a conflict.
  for (const rel of files) {
    const dest = path.join(target, rel); assertPlain(dest);
    if (fs.existsSync(dest) && (!fs.statSync(dest).isFile() || !fs.readFileSync(dest).equals(fs.readFileSync(path.join(source, rel))))) return 'conflict';
  }
  for (const rel of files) {
    const dest = path.join(target, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (!fs.existsSync(dest)) fs.copyFileSync(path.join(source, rel), dest, fs.constants.COPYFILE_EXCL);
  }
  return 'ready';
}
export function manualChecklist(profile) {
  const lines = ['# PICKGO 공동작업자 설정', '', '자동 설치 결과와 별개로 아래 항목은 본인 확인이 필요합니다.', ''];
  if (levels[profile] >= 1) {
    lines.push('- [ ] Codex 데스크톱 설치/로그인 및 이 저장소 열기: https://developers.openai.com/codex/app', '- [ ] Claude 본인 계정 로그인, gh auth login (원하는 저장소만 허용).', '- [ ] Codex 플러그인 디렉터리(https://chatgpt.com/plugins)에서 아래 이름 검색. 계정별 제공/연결 상태를 확인하고 새 채팅에서 도구 호출 검증.', ...manifest.plugins.map(p => `- [ ] ${p.name}: ${p.role} (${p.required ? '협업 권장' : '선택'}; 설치/인증 미확인)`), '- [ ] ai-memory: 담당자에게 승인된 서버 연결 경로를 받고 본인 클라이언트에 연결. default/hyundai_ai 범위와 접근 권한 검증. 연결 후 공식 routing install로 관리 스킬 설치. 로컬 개인 DB/토큰/다른 프로젝트 기억 복사 금지.', '- [ ] Dot: 본인 ChatGPT에서 조사 대화/회신 경로 확인. 기존 사용자의 대화 ID·예약·세션 복사 금지.', '- [ ] Claude 모델: 검수 claude-haiku-5-5, 기획 claude-opus-5-5. 가용성 실제 확인, 불가 시 차단 보고 (자동 대체 없음).');
  }
  if (profile === 'full') lines.push('- [ ] Android Studio 첫 실행 → SDK Manager: API 34 / build-tools / platform-tools / emulator / command-line tools. 라이선스 직접 검토.', '- [ ] Gradle 8.9 확보: https://gradle.org/releases/ (공식 checksum 검증). AGP 8.7.3/JDK 17.', '- [ ] Pleos 개발자 접근 및 Emulator 공식 설정: https://document.pleos.ai/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator', '- [ ] NaviHelper 3.0.5 / navi-data 3.0.4 / navi-aidl 3.0.1 확보 후 experiments/pickgo-navigation/README.md 및 build.gradle의 로컬 경로 대조. 현재 Gradle 캐시 참조 방식은 새 PC에서 자동 재현되지 않음.', '- [ ] 본인 debug 서명 설정 별도 준비. 기존 개인 키 복사/자동 생성 없음. Android 빌드/에뮬레이터 실행 성공을 별도 검증.');
  lines.push('- [ ] AGENTS.md, DEVELOPMENT_GUIDE.md 전체와 최신 docs/ 기록 읽기. J-01 재개 금지.', '- [ ] npm test / npm start 로 로컬 웹 확인. 실제 차량/SDK 검증과 구분.', '', '자동 설치는 개인 설정·Git 신원·권한·비밀값을 복제하지 않습니다.');
  return lines.join('\n') + '\n';
}
export function main(args = process.argv.slice(2), { base = root, platform = process.platform, execute = run } = {}) {
  const { mode, profile } = parseArgs([...args]);
  if (Number(process.versions.node.split('.')[0]) < manifest.nodeMinimum) throw new Error('Node.js 22 이상을 설치하세요.');
  const selected = programs(profile), results = [];
  const add = (name, status, detail = '') => { results.push({ name, status, detail }); console.log(`[${status}] ${name} ${detail}`); };
  console.log(`PICKGO setup 0.1.0 | ${mode} | ${profile}`);
  if (mode === 'plan') {
    for (const p of selected) console.log(`winget ${wingetArgs(p.id, true).join(' ')}`);
    if (levels[profile] >= 1) console.log(`npm install --global @openai/codex@${manifest.codexVersion} (기존 CLI 있으면 보존)`);
    console.log('프로젝트 .agents/skills → .claude/skills (동일 파일 유지, 충돌 시 보존/실패)');
    console.log(manualChecklist(profile)); return 0;
  }
  if (mode === 'install' && platform !== 'win32') throw new Error('자동 프로그램 설치는 Windows 전용입니다. plan/doctor는 다른 OS에서도 사용 가능합니다.');
  add('Node.js', 'ready', process.version);
  const hasWinget = platform === 'win32' && execute('winget.exe', ['--version']).ok;
  for (const p of selected) {
    const probe = p.command && execute(p.command, p.args);
    if (probe?.ok) { add(p.name, 'ready', probe.text.split('\n')[0]); continue; }
    if (hasWinget && execute('winget.exe', wingetArgs(p.id)).ok) { add(p.name, mode === 'doctor' && p.command ? 'missing' : 'installed', '패키지 등록 확인; PATH/실행은 새 터미널에서 확인'); continue; }
    if (mode === 'install' && hasWinget) {
      const r = execute('winget.exe', wingetArgs(p.id, true), true);
      add(p.name, r.ok ? 'installed' : 'failed', r.ok ? '새 터미널에서 doctor 재실행' : `종료 ${r.code}${typeof r.code === 'number' ? ' / 0x' + (r.code >>> 0).toString(16) : ''}`);
    } else add(p.name, 'missing', hasWinget ? '설치 필요' : 'WinGet 미확인; README 수동 설치 경로 참조');
  }
  if (levels[profile] >= 1) {
    const c = execute('codex', ['--version']);
    if (c.ok) add('Codex CLI', 'ready', c.text);
    else if (c.code !== 'ENOENT') add('Codex CLI', 'failed', `기존 명령 실행 실패 ${c.code}; 자동 재설치하지 않음`);
    else if (mode === 'install' && process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)) {
      const r = execute(process.execPath, [process.env.npm_execpath, 'install', '--global', `@openai/codex@${manifest.codexVersion}`, '--no-fund', '--no-audit'], true);
      add('Codex CLI', r.ok ? 'installed' : 'failed', `종료 ${r.code}; 새 터미널에서 codex --version 확인`);
    } else add('Codex CLI', 'missing', 'npm run setup -- --profile agents 로 설치');
  }
  for (const name of manifest.skills) {
    const source = path.join(base, '.agents/skills', name), target = path.join(base, '.claude/skills', name);
    try {
      assertPlain(source);
      if (!fs.existsSync(path.join(source, 'SKILL.md'))) throw new Error('원본 SKILL.md 없음');
      if (mode === 'install') add(name, copySkill(source, target));
      else {
        assertPlain(target);
        const matches = tree(source).every(rel => { const dest = path.join(target, rel); assertPlain(dest); return fs.existsSync(dest) && fs.statSync(dest).isFile() && fs.readFileSync(dest).equals(fs.readFileSync(path.join(source, rel))); });
        add(name, matches ? 'ready' : 'missing', 'Codex 원본 및 Claude 사본 비교');
      }
    } catch (e) { add(name, 'failed', e.message); }
  }
  if (mode === 'install') {
    const out = path.join(base, 'work/team-setup'); assertPlain(out);
    fs.mkdirSync(out, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-') + '-' + randomUUID();
    const report = path.join(out, `report-${stamp}.json`), checklist = path.join(out, `checklist-${stamp}.md`);
    for (const f of [report, checklist]) assertPlain(f);
    fs.writeFileSync(report, JSON.stringify({ schemaVersion: 1, profile, results, manualVerificationRequired: true }, null, 2) + '\n', { flag: 'wx' });
    fs.writeFileSync(checklist, manualChecklist(profile), { flag: 'wx' });
    console.log(`결과: ${report}\n남은 설정: ${checklist}`);
  }
  console.log('플러그인/로그인/SDK/서명/모델 접근은 미검증입니다. tools/team-setup/README.md 참조.');
  return results.some(r => ['failed', 'missing', 'conflict'].includes(r.status)) ? 1 : 0;
}
export function isEntrypoint(entry) {
  if (!entry) return false;
  const a = fs.realpathSync.native(entry), b = fs.realpathSync.native(fileURLToPath(import.meta.url));
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}
if (isEntrypoint(process.argv[1])) {
  try { process.exitCode = main(); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
