from pathlib import Path
import json,hashlib
root=Path('experiments/pickup-board');out=Path('docs/evidence/pickgo-design-review-2026-11-06')
files=['app.mjs','phone-page.mjs','proximity-page.mjs','recommendation/page.mjs','server.mjs']
for f in files:
 p=out/'before-fix'/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((root/f).read_bytes())
(root/'place-label.mjs').write_text('''// Presentation only: keep the canonical place and mapPoint unchanged for API/navigation.
export function placeLabel(place, proposed = false) {
  if (!place) return '확인 전';
  return /^지도 핀 \\(-?\\d+\\.\\d{7}, -?\\d+\\.\\d{7}\\)$/.test(place)
    ? (proposed ? '지도에서 제안한 장소' : '지도에서 선택한 장소')
    : place;
}
''',encoding='utf-8')
for f in files[:-1]:
 p=root/f;s=p.read_text(encoding='utf-8');s="import { placeLabel } from '"+('../' if '/' in f else './')+"place-label.mjs';\n"+s
 if f=='app.mjs':
  s=s.replace("state?.place || '확인 전'",'placeLabel(state?.place)').replace("$('proposedPlace').textContent = state.proposal.place;","$('proposedPlace').textContent = placeLabel(state.proposal.place, true);")
 elif f=='phone-page.mjs':s=s.replace('${state.place}', '${placeLabel(state.place)}')
 elif f=='proximity-page.mjs':s=s.replace('fresh() ? state.place', 'fresh() ? placeLabel(state.place)')
 else:s=s.replace('${state.place}', '${placeLabel(state.place)}').replace("$('proposed').textContent=state.proposal.place", "$('proposed').textContent=placeLabel(state.proposal.place, true)")
 p.write_text(s,encoding='utf-8')
p=root/'server.mjs';s=p.read_text(encoding='utf-8').replace('const files = {',"const files = { '/place-label.mjs': ['place-label.mjs', 'text/javascript'],");p.write_text(s,encoding='utf-8')
with Path('docs/FILE_OWNERSHIP.md').open('a',encoding='utf-8') as f:f.write('\n2026-11-06 독립 디자인 검토 담당: 전용 보고·evidence 담당. 사용자 후속 좌표노출 수정 승인으로 app/phone-page/proximity-page/recommendation/page.mjs·신규 place-label.mjs·server 정적경로만 담당. 원본 showcase·API·좌표저장·Android 불변. 기존 미커밋 사본 전용 evidence/before-fix 보존.\n')
