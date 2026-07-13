// 매물 조회 API (Mock).
//
// 지금은 mockDb의 로컬 데이터를 지연과 함께 돌려주지만, 시그니처는 실제
// 서버 호출과 동일하게 async/Promise 로 맞춰 두었습니다. 백엔드가 준비되면
// 이 파일 내부만 fetch() 또는 서버 액션('use server')으로 바꾸면 되고,
// 이 API를 쓰는 컴포넌트는 손댈 필요가 없습니다.

import {
  DEFAULT_REGION_ID,
  FLOOD_ZONES,
  LISTINGS,
  REGIONS,
} from './mockDb.js';

const NETWORK_DELAY = 260; // ms — 로딩 상태를 실제처럼 보이게 하는 지연

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveRegion(regionId) {
  return REGIONS.find((region) => region.id === regionId) ?? REGIONS[0];
}

// 한 지역의 지도 설정 + 매물 + 침수구역을 한 번에 로드합니다.
// (SPA가 지역 단위로 데이터를 받아오고, 필터/정렬은 클라이언트에서 처리하는 방식)
export async function fetchRegion(regionId = DEFAULT_REGION_ID) {
  await delay(NETWORK_DELAY);
  const region = resolveRegion(regionId);
  const listings = LISTINGS.filter((item) => item.region === region.id);
  const floodZones = FLOOD_ZONES.filter((zone) => zone.region === region.id);
  return { region, listings, floodZones };
}

// 단일 매물 조회 (상세/딥링크 용도).
export async function fetchListing(id) {
  await delay(NETWORK_DELAY);
  return LISTINGS.find((item) => item.id === id) ?? null;
}

// 선택 가능한 지역 목록 (지역 전환 UI 대비).
export async function fetchRegions() {
  await delay(NETWORK_DELAY);
  return REGIONS.map(({ id, name }) => ({ id, name }));
}
