import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { HEX, PROPS, RAIN_DESCRIPTIONS, gradeOf } from './data.js';

const DEAL_OPTIONS = ['전체', '전세', '월세'];
const ROOM_OPTIONS = ['원룸', '투룸+', '오피스텔'];
const PRICE_BOUNDS = {
  월세: { min: 30, max: 100, step: 5, unit: '만원', label: '월세' },
  전세: { min: 10000, max: 35000, step: 1000, unit: '만원', label: '전세' },
};

function priceParts(deal) {
  const match = deal.match(/^(전세|월세|보증)\s*(.*)$/);
  return match ? [match[1], match[2]] : ['', deal];
}

function formatPriceLimit(dealType, value) {
  if (dealType === '전세') {
    return value >= 10000
      ? `${(value / 10000).toFixed(value % 10000 === 0 ? 0 : 1)}억 이하`
      : `${value.toLocaleString()}만원 이하`;
  }

  return `${value}만원 이하`;
}

function PriceValueChips({ dealType, priceLimits }) {
  return (
    <span
      className="priceFilter__values"
      key={`${dealType}-${priceLimits.월세}-${priceLimits.전세}`}
    >
      {(dealType === '전체' || dealType === '월세') && (
        <span className="priceChip">월세 {priceLimits.월세}만</span>
      )}
      {(dealType === '전체' || dealType === '전세') && (
        <span className="priceChip">
          전세 {formatPriceLimit('전세', priceLimits.전세).replace(' 이하', '')}
        </span>
      )}
    </span>
  );
}

function matchesFilters(property, filters) {
  const { dealType, hideRisk, minThreshold, priceLimits, roomType } = filters;
  const dealMatches = dealType === '전체' || property.dealType === dealType;

  return (
    property.roomType === roomType &&
    dealMatches &&
    property.thr >= minThreshold &&
    !(hideRisk && property.thr < 40) &&
    property.priceValue <= priceLimits[property.dealType]
  );
}

function statusColor(property, rain) {
  if (rain >= property.thr) return '#e04b4b';
  if (rain >= property.thr - 15) return '#eaa032';
  return '#1f9d6b';
}

function markerIcon(property, rain, selectedId) {
  const grade = gradeOf(property.thr).g;
  const selected = property.id === selectedId ? ' sel' : '';
  const flooded = rain >= property.thr ? ' flood' : '';

  return L.divIcon({
    className: '',
    iconSize: [34, 42],
    iconAnchor: [17, 38],
    html: `
      <div class="marker${selected}${flooded}">
        <div class="marker__badge" style="background:${statusColor(property, rain)}"></div>
        <div class="marker__txt">${grade}</div>
      </div>
    `,
  });
}

function reportText(property) {
  const grade = gradeOf(property.thr);
  const wetHistory = property.hist.find((history) => history.st === 'bad');
  let text = `이 매물의 침수 내성은 <span class="em">${grade.g}등급(임계점 ${property.thr}mm/h)</span>입니다. `;

  text += property.banjiha
    ? `<span class="em">반지하</span> 구조라 물이 지면 아래로 고여, 같은 비에도 지상보다 훨씬 취약합니다. `
    : `유등천 기준 상대 고도 약 ${property.elev.toFixed(1)}m 지점입니다. `;

  text += wetHistory
    ? `실제로 <span class="em">${wetHistory.date}(${wetHistory.mm}mm/h)</span>에 "${wetHistory.txt}" 기록이 침수흔적도에 남아 있습니다. `
    : '현재까지 확인된 침수 이력은 없습니다. ';

  if (property.thr < 60) {
    return `${text}기상청이 시간당 ${property.thr}mm 이상을 예보하는 날이면 사전 대비가 필요합니다. 계약 전 물막이판과 역류방지밸브 설치 여부를 반드시 확인하세요.`;
  }

  if (property.thr < 90) {
    return `${text}평범한 장마엔 견디지만, 2020년 정림동급 집중호우에선 안심하기 어렵습니다. 지하주차장·1층 상태를 확인하세요.`;
  }

  return `${text}대전의 어떤 폭우 시나리오에서도 안전한 편입니다. 다른 조건에 집중하셔도 됩니다.`;
}

function coachItems(property) {
  const items = [
    [
      'Q1',
      '2020년 7월, 이 집에 물이 들어왔었나요? (거짓말하기 어려운 직접 질문)',
    ],
    ['Q2', '벽·창문 아래 물때 자국이나 곰팡이 흔적이 있는지 확인하세요.'],
  ];

  if (property.banjiha) {
    items.push([
      'Q3',
      '역류방지밸브·물막이판이 설치돼 있나요? 없다면 집주인 부담 설치가 가능한가요?',
    ]);
  }

  items.push(
    property.thr < 60
      ? ['Q4', '침수 이력 지역인데 전세보증보험·침수 특약 가입이 가능한가요?']
      : ['Q4', '지하주차장·계단 등 공용부 배수 상태는 어떤가요?'],
  );

  return items;
}

function buildCrossSection(property, rain) {
  const safest = PROPS.reduce((current, item) =>
    item.thr > current.thr ? item : current,
  );
  const alternative =
    property.id === safest.id ? PROPS.find((item) => item.id === 'p5') : safest;
  const ground = 150;
  const elevationMax = 12;
  const y = (elevation) => ground - (elevation / elevationMax) * 95;
  const selectedY = y(property.elev);
  const alternativeY = y(alternative.elev);
  const waterY = Math.min(
    ground,
    Math.max(30, ground - (rain / elevationMax / 9.6) * 95),
  );
  const selectedFlooded = rain >= property.thr;
  const alternativeFlooded = rain >= alternative.thr;

  return {
    leftCaption: `${property.name} · ${property.thr}mm`,
    rightCaption: `${alternative.name} · ${alternative.thr}mm`,
    svg: `
      <rect width="400" height="190" fill="#0e1a20"/>
      <path d="M0,${ground} L120,${ground} L150,${selectedY} L250,${selectedY} L280,${ground} L340,${ground} L360,${alternativeY} L400,${alternativeY} L400,190 L0,190 Z" fill="#24404d"/>
      <rect x="0" y="${waterY}" width="400" height="${190 - waterY}" fill="${rain >= 45 ? '#1667a8' : '#3d8fd4'}" opacity="0.74"/>
      <line x1="0" y1="${waterY}" x2="400" y2="${waterY}" stroke="#8fc6ea" stroke-width="1.5" opacity="0.85"/>
      ${
        property.banjiha
          ? `<rect x="150" y="${ground}" width="80" height="34" fill="${selectedFlooded ? '#e04b4b' : '#3a5a68'}" stroke="#8fc6ea" stroke-width="1" opacity="0.9"/><text x="190" y="${ground + 21}" fill="#fff" font-size="9" text-anchor="middle" font-family="monospace">반지하</text><rect x="150" y="${ground - 40}" width="80" height="40" fill="#2b4652"/>`
          : `<rect x="150" y="${selectedY - 48}" width="80" height="48" fill="${selectedFlooded ? '#e04b4b' : '#3a5a68'}" stroke="#8fc6ea" stroke-width="1"/>`
      }
      <rect x="322" y="${alternativeY - 52}" width="66" height="52" fill="#1f9d6b"/>
      <text x="190" y="24" fill="${selectedFlooded ? '#ff8a8a' : '#8fc6ea'}" font-size="11" text-anchor="middle" font-family="monospace" font-weight="600">${selectedFlooded ? '침수' : '안전'}</text>
      <text x="355" y="${alternativeY - 58}" fill="#5fd6a5" font-size="11" text-anchor="middle" font-family="monospace" font-weight="600">${alternativeFlooded ? '침수' : '안전'}</text>
      <text x="8" y="${waterY - 5}" fill="#8fc6ea" font-size="9" font-family="monospace">수위 · ${rain}mm/h</text>
    `,
  };
}

function BrandBar() {
  return (
    <header className="brandbar">
      <div className="brandbar__l">
        <span className="logo">
          장마등급<b>°</b>
        </span>
        <span className="brandbar__tag">침수 안전등급이 보이는 부동산</span>
      </div>
      <div className="brandbar__thesis">
        채광·주차·곰팡이 후기는 있는데, <b>이 집이 몇 mm부터 잠기는지</b>는
        없었다.
      </div>
    </header>
  );
}

function PriceSlider({ dealType, value, onChange }) {
  const bounds = PRICE_BOUNDS[dealType];
  const handleChange = (event) => onChange(Number(event.target.value));

  return (
    <div className="priceSlider">
      <div className="priceSlider__top">
        <span>{bounds.label}</span>
        <b>{formatPriceLimit(dealType, value)}</b>
      </div>
      <input
        type="range"
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={value}
        aria-label={`${bounds.label} 가격대`}
        onChange={handleChange}
        onInput={handleChange}
      />
      <div className="priceSlider__marks">
        <span>{formatPriceLimit(dealType, bounds.min)}</span>
        <span>{formatPriceLimit(dealType, bounds.max)}</span>
      </div>
    </div>
  );
}

function Filters({
  dealType,
  hideRisk,
  minThreshold,
  priceLimits,
  roomType,
  onDealType,
  onHideRisk,
  onMinThreshold,
  onPriceLimitsApply,
  onReset,
  onRoomType,
}) {
  const [priceOpen, setPriceOpen] = useState(false);
  const [draftPriceLimits, setDraftPriceLimits] = useState(priceLimits);
  const displayPriceLimits = priceOpen ? draftPriceLimits : priceLimits;
  const visiblePriceTypes = dealType === '전체' ? ['월세', '전세'] : [dealType];

  useEffect(() => {
    setDraftPriceLimits(priceLimits);
  }, [priceLimits]);

  const applyPriceLimits = () => {
    onPriceLimitsApply({ ...draftPriceLimits });
    setPriceOpen(false);
  };

  return (
    <div className="filters">
      <div className="seg">
        {ROOM_OPTIONS.map((item) => (
          <button
            key={item}
            className={roomType === item ? 'on' : ''}
            onClick={() => onRoomType(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <label className="chk">
        <input
          type="checkbox"
          checked={hideRisk}
          onChange={(event) => onHideRisk(event.target.checked)}
        />
        침수 위험 매물 숨기기
      </label>
      <div className="fdrop">
        <select
          aria-label="거래방식"
          value={dealType}
          onChange={(event) => onDealType(event.target.value)}
        >
          {DEAL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === '전체' ? '거래방식 전체' : option}
            </option>
          ))}
        </select>
      </div>
      <div className={`priceFilter ${priceOpen ? 'open' : ''}`}>
        <button
          className="priceFilter__btn"
          type="button"
          onClick={() => setPriceOpen((value) => !value)}
        >
          <span>가격대</span>
          <PriceValueChips
            dealType={dealType}
            priceLimits={displayPriceLimits}
          />
        </button>
        {priceOpen && (
          <div className="priceFilter__panel">
            {visiblePriceTypes.map((type) => (
              <PriceSlider
                key={type}
                dealType={type}
                value={draftPriceLimits[type]}
                onChange={(value) =>
                  setDraftPriceLimits((current) => ({
                    ...current,
                    [type]: value,
                  }))
                }
              />
            ))}
            <div className="priceFilter__actions">
              <PriceValueChips
                dealType={dealType}
                priceLimits={draftPriceLimits}
              />
              <button
                className="priceFilter__apply"
                type="button"
                onClick={applyPriceLimits}
              >
                적용
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="fdrop hot">
        <span className="newdot">NEW</span>
        <select
          aria-label="침수등급"
          value={minThreshold}
          onChange={(event) => onMinThreshold(Number(event.target.value))}
        >
          <option value="0">침수등급 전체</option>
          <option value="100">A등급 (매우 안전)</option>
          <option value="80">B등급 이상</option>
          <option value="60">C등급 이상</option>
          <option value="40">D·E 제외 (침수 취약 숨김)</option>
        </select>
      </div>
      <div className="filters__sp" />
      <button
        className="refresh"
        title="필터 초기화"
        type="button"
        onClick={onReset}
      >
        ⟲
      </button>
    </div>
  );
}

function PropertyCard({ property, selected, onSelect }) {
  const grade = gradeOf(property.thr);
  const [dealKind, dealValue] = priceParts(property.deal);

  return (
    <button
      className={`card ${selected ? 'sel' : ''}`}
      type="button"
      onClick={() => onSelect(property.id)}
    >
      <div className="card__thumb">
        <span className="card__gtag" style={{ background: HEX[grade.g] }}>
          {grade.g}
        </span>
        <svg
          className="home"
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8a97a0"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M3 11l9-7 9 7" />
          <path d="M5 10v10h14V10" />
        </svg>
      </div>
      <div className="card__b">
        <span className="owner">{property.owner}</span>
        <div className="card__name">{property.name}</div>
        <div className="card__price">
          <span>{dealKind}</span> {dealValue}
        </div>
        <div className="card__spec">{property.spec}</div>
        <span className="gradechip" style={{ background: HEX[grade.g] }}>
          침수 {grade.g}등급{' '}
          <span className="mm">· 임계점 {property.thr}mm</span>
        </span>
        <div className="card__meta">
          {property.agency} ·{' '}
          <span className="chk2">확인매물 {property.checked}</span>
        </div>
      </div>
    </button>
  );
}

function PropertyList({ properties, selectedId, sortMode, onSelect, onSort }) {
  return (
    <aside className="list">
      <div className="list__head">
        <div className="sort">
          {[
            ['rank', '랭킹순'],
            ['price', '가격순'],
            ['safe', '침수안전순'],
            ['recent', '최신순'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={sortMode === value ? 'on' : ''}
              onClick={() => onSort(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="list__cnt">
          매물 <b>{properties.length}</b>
        </div>
      </div>
      <div className="cards">
        {properties.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            selected={property.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </aside>
  );
}

function floodRadius(property, rain) {
  if (!property) return 0;
  const base = property.banjiha ? 95 : 70;
  const pressure = Math.max(0.45, rain / Math.max(property.thr, 1));
  return Math.min(460, Math.round(base + pressure * 185));
}

function MapPane({
  rain,
  selectedId,
  selectedProperty,
  visiblePropertyIds,
  floodOn,
  onSelect,
  onToggleFlood,
}) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const selectedFloodRef = useRef(null);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return;

    const map = L.map(mapElementRef.current, { zoomControl: true }).setView(
      [36.3018, 127.3742],
      16,
    );
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution: '© OpenStreetMap · © CARTO',
        subdomains: 'abcd',
        maxZoom: 20,
      },
    ).addTo(map);

    PROPS.forEach((property) => {
      const marker = L.marker([property.lat, property.lng], {
        icon: markerIcon(property, 0, null),
      }).addTo(map);
      marker.on('click', () => onSelect(property.id));
      markersRef.current[property.id] = marker;
    });

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onSelect]);

  useEffect(() => {
    PROPS.forEach((property) => {
      const marker = markersRef.current[property.id];
      if (!marker) return;

      const visible = visiblePropertyIds.has(property.id);
      marker.setIcon(markerIcon(property, rain, selectedId));
      const element = marker.getElement();
      if (element) element.style.display = visible ? '' : 'none';
    });
  }, [rain, selectedId, visiblePropertyIds]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!selectedFloodRef.current) {
      selectedFloodRef.current = L.circle([0, 0], {
        radius: 0,
        color: '#2f83c9',
        weight: 2,
        opacity: 0,
        fillColor: '#2f83c9',
        fillOpacity: 0,
      }).addTo(mapRef.current);
    }

    const active = Boolean(floodOn && selectedProperty);
    const center = selectedProperty
      ? [selectedProperty.lat, selectedProperty.lng]
      : [0, 0];
    const radius = active ? floodRadius(selectedProperty, rain) : 0;
    const flooded = selectedProperty && rain >= selectedProperty.thr;

    selectedFloodRef.current.setLatLng(center);
    selectedFloodRef.current.setRadius(radius);
    selectedFloodRef.current.setStyle({
      opacity: active ? 0.8 : 0,
      fillOpacity: active ? (flooded ? 0.3 : 0.22) : 0,
      color: flooded ? '#e04b4b' : '#2f83c9',
      fillColor: flooded ? '#e04b4b' : '#2f83c9',
    });
  }, [floodOn, rain, selectedProperty]);

  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const property = PROPS.find((item) => item.id === selectedId);
    if (property)
      mapRef.current.panTo([property.lat, property.lng], { animate: true });
  }, [selectedId]);

  return (
    <>
      <div ref={mapElementRef} id="map" />
      <div className="bread">
        <span className="pin">◉</span> 대전광역시 <i>›</i> 서구 <i>›</i> 정림동
         
      </div>
    </>
  );
}

function RainPanel({ rain, property, onRain }) {
  const description = RAIN_DESCRIPTIONS.find((item) => rain >= item.min).t;
  const flooded = rain >= property.thr;

  return (
    <div className="rainpanel">
      <div className="rp__row">
        <div>
          <div className="rp__read">
            <span className="rp__num">{rain}</span>
            <span className="rp__unit">mm / 시간</span>
          </div>
          <div className="rp__desc">{description}</div>
        </div>
        <div className="rp__status">
          선택 매물 임계점
          <br />
          <span className={`rp__cnt ${flooded ? 'hot' : ''}`}>
            {property.thr}
          </span>{' '}
          <span className="rp__total">mm/h</span>
        </div>
      </div>
      <div className="rp__track">
        <div className="rp__2020">2020.7.30 정림동 78mm</div>
        <input
          type="range"
          min="0"
          max="115"
          value={rain}
          step="1"
          aria-label="시간당 강수량"
          onChange={(event) => onRain(Number(event.target.value))}
        />
        <div className="rp__marks">
          <span>0</span>
          <span>30</span>
          <span>60</span>
          <span>90</span>
          <span>115mm</span>
        </div>
      </div>
    </div>
  );
}

function DetailDrawer({ property, rain, onClose }) {
  const [report, setReport] = useState(
    '아래 버튼을 눌러 이 매물의 솔직한 브리핑을 받아보세요.',
  );
  const [reporting, setReporting] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);

  useEffect(() => {
    setReport('아래 버튼을 눌러 이 매물의 솔직한 브리핑을 받아보세요.');
    setReporting(false);
    setCoachOpen(false);
  }, [property?.id]);

  if (!property) {
    return <aside className="drawer" aria-hidden="true" />;
  }

  const grade = gradeOf(property.thr);
  const crossSection = buildCrossSection(property, rain);
  const alertOn = rain >= property.thr;

  const streamReport = () => {
    const html = reportText(property);
    const tokens = html.match(/<[^>]+>|[^<]/g) || [];
    let index = 0;

    setReporting(true);
    setReport('<span class="cursor"></span>');

    setTimeout(() => {
      const timer = setInterval(() => {
        index += 1;
        setReport(
          `${tokens.slice(0, index).join('')}<span class="cursor"></span>`,
        );
        if (index >= tokens.length) {
          clearInterval(timer);
          setReport(html);
          setReporting(false);
        }
      }, 14);
    }, 650);
  };

  return (
    <aside className="drawer open">
      <div className="dw__top">
        <div>
          <div className="p-name">{property.name}</div>
          <div className="p-addr">
            {property.addr} · {property.deal}
          </div>
          <span className={`p-type ${property.banjiha ? 'banjiha' : ''}`}>
            {property.banjiha ? '반지하' : '지상'}
          </span>
        </div>
        <button className="dw__x" title="닫기" type="button" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="dw__body">
        <div className="hero">
          <div className="hero__thr">
            <div className="lbl">침수 임계점</div>
            <div className="val">
              {property.thr}
              <small>mm/h</small>
            </div>
            <div className="sub">이 강수량부터 침수 이력이 있습니다</div>
          </div>
          <div className="grade" style={{ background: HEX[grade.g] }}>
            <div className="g-lbl">등급</div>
            <div className="g-val">{grade.g}</div>
            <div className="g-desc">{grade.d}</div>
          </div>
        </div>
        <div className={`alert ${alertOn ? 'show' : ''}`}>
          <span className="alert__dot" />
          <span>
            장마철 실시간 모드 · 현재 {rain}mm &gt; 임계점 {property.thr}mm —
            지금 이 비라면 침수 위험
          </span>
        </div>

        <section className="sec">
          <div className="sec__t">단면 비교 · 같은 예산 대안</div>
          <div className="xsec">
            <svg
              viewBox="0 0 400 190"
              preserveAspectRatio="xMidYMid meet"
              dangerouslySetInnerHTML={{ __html: crossSection.svg }}
            />
            <div className="xcap">
              <span>{crossSection.leftCaption}</span>
              <span>{crossSection.rightCaption}</span>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="sec__t">침수 이력 · 행안부 침수흔적도 교차</div>
          <ul className="hist">
            {property.hist.map((history) => (
              <li key={`${history.date}-${history.txt}`}>
                <div className="hist__date">
                  {history.date}
                  <div className="hist__mm">
                    {history.mm ? `${history.mm}mm/h` : '—'}
                  </div>
                </div>
                <div>
                  <div className={`hist__st ${history.st}`}>{history.txt}</div>
                  <div className="hist__note">{history.note}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="sec">
          <div className="sec__t">AI 침수 리포트</div>
          <div className="ai">
            <div className="ai__head">
              <span className="ai__badge">AI</span>
              <span>공공데이터를 사람 말로 번역합니다</span>
            </div>
            <div
              className="ai__body"
              dangerouslySetInnerHTML={{ __html: report }}
            />
            <button
              className="btn"
              type="button"
              disabled={reporting}
              onClick={streamReport}
            >
              {reporting
                ? '공공데이터 분석 중…'
                : '이 집, 계약해도 될까요? — 리포트 생성'}
            </button>
          </div>
        </section>

        <section className="sec">
          <div className="sec__t">계약 전 질문 코치</div>
          <button
            className="btn"
            type="button"
            onClick={() => setCoachOpen(true)}
          >
            집 보러 갈 때 물어볼 질문 만들기
          </button>
          <ul className={`coach ${coachOpen ? 'show' : ''}`}>
            {coachItems(property).map(([label, text]) => (
              <li key={label}>
                <b>{label}</b>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="foot">
          DEMO · 출처(활용 예정): <b>행안부 침수흔적도</b> ·{' '}
          <b>국토지리정보원 DEM</b> · <b>기상청 강수량</b>. 지도 © OpenStreetMap
          · © CARTO. 수치는 시연용 예시.
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  const [rain, setRain] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [sortMode, setSortMode] = useState('rank');
  const [minThreshold, setMinThreshold] = useState(0);
  const [hideRisk, setHideRisk] = useState(false);
  const [floodOn, setFloodOn] = useState(true);
  const [roomType, setRoomType] = useState('원룸');
  const [dealType, setDealType] = useState('전체');
  const [priceLimits, setPriceLimits] = useState({ 월세: 100, 전세: 35000 });

  const visibleProperties = useMemo(() => {
    const filters = { dealType, hideRisk, minThreshold, priceLimits, roomType };
    const filtered = PROPS.filter((property) =>
      matchesFilters(property, filters),
    );
    if (sortMode === 'price')
      return [...filtered].sort((a, b) => a.pval - b.pval);
    if (sortMode === 'safe') return [...filtered].sort((a, b) => b.thr - a.thr);
    if (sortMode === 'recent')
      return [...filtered].sort((a, b) => b.recent - a.recent);
    return filtered;
  }, [dealType, hideRisk, minThreshold, priceLimits, roomType, sortMode]);

  const visiblePropertyIds = useMemo(
    () => new Set(visibleProperties.map((property) => property.id)),
    [visibleProperties],
  );

  useEffect(() => {
    if (selectedId && !visiblePropertyIds.has(selectedId)) setSelectedId(null);
  }, [selectedId, visiblePropertyIds]);

  const selectedProperty = PROPS.find((property) => property.id === selectedId);
  const resetFilters = () => {
    setRoomType('원룸');
    setDealType('전체');
    setPriceLimits({ 월세: 100, 전세: 35000 });
    setMinThreshold(0);
    setHideRisk(false);
  };

  return (
    <>
      <BrandBar />
      <Filters
        dealType={dealType}
        hideRisk={hideRisk}
        minThreshold={minThreshold}
        priceLimits={priceLimits}
        roomType={roomType}
        onDealType={setDealType}
        onHideRisk={setHideRisk}
        onMinThreshold={setMinThreshold}
        onPriceLimitsApply={setPriceLimits}
        onReset={resetFilters}
        onRoomType={setRoomType}
      />
      <main className="work">
        <PropertyList
          properties={visibleProperties}
          selectedId={selectedId}
          sortMode={sortMode}
          onSelect={setSelectedId}
          onSort={setSortMode}
        />
        <section className="mapwrap">
          <MapPane
            rain={rain}
            selectedId={selectedId}
            selectedProperty={selectedProperty}
            visiblePropertyIds={visiblePropertyIds}
            floodOn={floodOn}
            onSelect={setSelectedId}
            onToggleFlood={() => setFloodOn((value) => !value)}
          />
          {selectedProperty && (
            <RainPanel
              rain={rain}
              property={selectedProperty}
              onRain={setRain}
            />
          )}
          <DetailDrawer
            property={selectedProperty}
            rain={rain}
            onClose={() => setSelectedId(null)}
          />
        </section>
      </main>
    </>
  );
}
