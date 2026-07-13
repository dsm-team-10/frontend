// 침수 위험 점수 산정 — 기획서의 가중치 모델을 실제 지리 신호로 계산합니다.
//
// 이 서비스가 실제로 갖고 있지 않은 것: 매물 인벤토리(직방/네이버부동산류의 사유 데이터).
// 이 서비스가 만드는 것: 공개 지형·하천·침수이력 신호를 하나의 위험 점수/등급으로
// 변환하는 판단 로직 그 자체. mockDb의 매물은 예시이지만, 아래 계산은 각 매물에 실제로
// 매겨진 해발고도(Open-Elevation API)·최근접 하천까지 거리(OpenStreetMap Overpass API)·
// 공개 침수 이력(보도자료·재해연보)를 그대로 대입한 결과입니다.

export const WEIGHTS = {
  floodHistory: 40,
  banjiha: 25,
  lowGround: 20,
  nearRiver: 15,
  weakDrainage: 10,
  highGround: -20,
};

export const LOW_GROUND_ELEV_M = 25; // 이 미만이면 저지대
export const HIGH_GROUND_ELEV_M = 55; // 이 이상이면 고지대
export const RIVER_PROXIMITY_M = 300; // 하천 인접 기준 거리

// 점수(대략 -20~110)를 강수 임계점(mm/h, 26~112)으로 변환합니다.
// 점수가 높을수록(취약할수록) 더 적은 비에도 침수 임계점에 도달합니다.
function scoreToThreshold(score) {
  return Math.round(Math.min(112, Math.max(26, 118 - score * 0.85)));
}

export function computeFloodRisk({
  elevationM,
  riverDistanceM,
  hasFloodHistory,
  banjiha,
  weakDrainage,
}) {
  const factors = [];
  let score = 0;

  const add = (label, points) => {
    score += points;
    factors.push({ label, points });
  };

  if (hasFloodHistory) add('과거 침수 이력', WEIGHTS.floodHistory);
  if (banjiha) add('반지하 구조', WEIGHTS.banjiha);
  if (elevationM < LOW_GROUND_ELEV_M) add('저지대 (해발 25m 미만)', WEIGHTS.lowGround);
  if (riverDistanceM <= RIVER_PROXIMITY_M) add(`하천 ${RIVER_PROXIMITY_M}m 이내`, WEIGHTS.nearRiver);
  if (weakDrainage) add('배수시설 부족 구간', WEIGHTS.weakDrainage);
  if (elevationM >= HIGH_GROUND_ELEV_M) add('고지대 (해발 55m 이상)', WEIGHTS.highGround);

  return { score, threshold: scoreToThreshold(score), factors };
}
