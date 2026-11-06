// Presentation only: keep the canonical place and mapPoint unchanged for API/navigation.
export function placeLabel(place, proposed = false) {
  if (!place) return '확인 전';
  return /^지도 핀 \(-?\d+\.\d{7}, -?\d+\.\d{7}\)$/.test(place)
    ? (proposed ? '지도에서 제안한 장소' : '지도에서 선택한 장소')
    : place;
}
