// 매물 조회 API (Mock).
//
// 지금은 mockDb의 로컬 데이터를 지연과 함께 돌려주지만, 시그니처는 실제
// 서버 호출과 동일하게 async/Promise 로 맞춰 두었습니다. 백엔드가 준비되면
// 이 파일 내부만 fetch() 또는 서버 액션('use server')으로 바꾸면 되고,
// 이 API를 쓰는 컴포넌트는 손댈 필요가 없습니다.
//
// thr(침수 임계점)은 데이터에 박아둔 값이 아니라, 매물의 실제 지리 신호
// (elevationM·riverDistanceM·hasFloodHistory 등)를 domain/floodScore.js의
// 가중치 로직에 통과시켜 여기서 계산합니다 — 판단 로직이 이 서비스의 핵심입니다.

import { computeFloodRisk } from '../domain/floodScore.js';
import { DEFAULT_REGION_ID, LISTINGS, REGIONS } from './mockDb.js';

export { DEFAULT_REGION_ID };

const NETWORK_DELAY = 260; // ms — 로딩 상태를 실제처럼 보이게 하는 지연

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveRegion(regionId) {
  return REGIONS.find((region) => region.id === regionId) ?? REGIONS[0];
}

function withComputedRisk(listing) {
  const { threshold, score, factors } = computeFloodRisk(listing);
  return { ...listing, thr: threshold, riskScore: score, riskFactors: factors };
}

// 한 지역의 지도 설정 + 매물을 한 번에 로드합니다.
// (SPA가 지역 단위로 데이터를 받아오고, 필터/정렬은 클라이언트에서 처리하는 방식)
export async function fetchRegion(regionId = DEFAULT_REGION_ID) {
  await delay(NETWORK_DELAY);
  const region = resolveRegion(regionId);
  const listings = LISTINGS.filter((item) => item.region === region.id).map(
    withComputedRisk,
  );
  return { region, listings };
}

// 단일 매물 조회 (상세/딥링크 용도).
export async function fetchListing(id) {
  await delay(NETWORK_DELAY);
  const listing = LISTINGS.find((item) => item.id === id);
  return listing ? withComputedRisk(listing) : null;
}

// 선택 가능한 지역 목록 (지역 전환 UI 대비).
export async function fetchRegions() {
  await delay(NETWORK_DELAY);
  return REGIONS.map(({ id, name }) => ({ id, name }));
}
