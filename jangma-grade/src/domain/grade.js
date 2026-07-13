// 침수 안전등급의 표시 로직 (색상 · 라벨 · 강수 설명).
// 서버 데이터가 아니라 클라이언트에서 그대로 쓰는 순수 도메인 상수/함수입니다.

export const GRADES = [
  { min: 100, g: 'A', d: '100mm에도 안전' },
  { min: 80, g: 'B', d: '폭우에 강함' },
  { min: 60, g: 'C', d: '집중호우 주의' },
  { min: 40, g: 'D', d: '침수 위험' },
  { min: 0, g: 'E', d: '상시 취약' },
];

export const HEX = {
  A: '#1f9d6b',
  B: '#63b95a',
  C: '#eaa032',
  D: '#e5793a',
  E: '#e04b4b',
};

export const RAIN_DESCRIPTIONS = [
  { min: 120, t: '2022 서울 신대방동 기록(141.5mm)에 근접·초과하는 수준' },
  { min: 90, t: '극한 호우 — 2022 서울 신대방동급' },
  { min: 70, t: '물폭탄 (2022.8.8 서울 폭우 수준)' },
  { min: 50, t: '시간당 50mm — 하수 용량 초과' },
  { min: 30, t: '강한 비 — 저지대 물 고임' },
  { min: 10, t: '보통 비' },
  { min: 1, t: '약한 비' },
  { min: 0, t: '비가 오지 않는 상태 — 슬라이더를 올려보세요' },
];

export function gradeOf(threshold) {
  return GRADES.find((grade) => threshold >= grade.min);
}
