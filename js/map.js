function loadKakaoSdkAndInit() {
  if (!KAKAO_JS_KEY || KAKAO_JS_KEY.indexOf("여기에") === 0) {
    document.querySelector(".map-wrap").insertAdjacentHTML("beforeend", `
      <div class="key-missing">
        <div class="box">
          <h2>Kakao Maps JavaScript 키가 필요합니다</h2>
          <p>이 파일 상단의 <code>KAKAO_JS_KEY</code> 값을 Kakao 개발자센터에서 발급받은
          JavaScript 키로 바꿔주세요. (REST API 키와는 다른 키입니다.)</p>
          <p>Kakao 개발자센터 &gt; 내 애플리케이션 &gt; 앱 키 &gt; JavaScript 키</p>
          <p>발급 후 플랫폼 설정에서 이 파일을 여는 도메인(또는 localhost)을
          등록해야 지도가 정상적으로 뜹니다.</p>
          <code>const KAKAO_JS_KEY = "실제_키_값";</code>
        </div>
      </div>
    `);
    return;
  }
  const script = document.createElement("script");
  script.src = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${KAKAO_JS_KEY}`;
  script.onload = function () { kakao.maps.load(initMap); };
  document.head.appendChild(script);
}

let map, mapContainer, markerEntries = [], statusFilter = "";
let labelsEnabled = true;
let selectedCode = null;
let infoPanelEl = null, infoPanelToken = 0;
let infoPanelCustomPosition = null;
let suppressNextMapClick = false;

const MARKER_W = 28, MARKER_H = 38;
const LABEL_H = 22;
const GAP_ABOVE_PIN_PX = MARKER_H;
const LABEL_Y_ANCHOR = 1 + GAP_ABOVE_PIN_PX / LABEL_H;

const markerImageCache = {};
function pinImage(status) {
  const color = status === "건설중" ? "#E53935" : "#1E88E5";
  if (markerImageCache[color]) return markerImageCache[color];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${MARKER_W}" height="${MARKER_H}" viewBox="0 0 28 38">` +
    `<path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 24 14 24s14-13.5 14-24C28 6.3 21.7 0 14 0z" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>` +
    `<circle cx="14" cy="14" r="5" fill="#ffffff"/>` +
    `</svg>`;
  const src = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  const img = new kakao.maps.MarkerImage(src, new kakao.maps.Size(MARKER_W, MARKER_H), {
    offset: new kakao.maps.Point(MARKER_W / 2, MARKER_H),
  });
  markerImageCache[color] = img;
  return img;
}

function shortLabelName(name) {
  return name
    .replace(/\(건설중, 명칭 미정\)/, "")
    .replaceAll("공공임대형", "")
    .replaceAll("지식산업센터", "")
    .replace(/\s+/g, " ")
    .trim();
}

function colorForStatus(status) { return status === "건설중" ? "#E53935" : "#1E88E5"; }
function hexToLightBg(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

function initMap() {
  mapContainer = document.getElementById("map");
  map = new kakao.maps.Map(mapContainer, {
    center: new kakao.maps.LatLng(36.4, 127.9),
    level: 13,
  });
  map.setMaxLevel(14);

  populateFilters();
  renderList(CENTERS);
  plotMarkers(CENTERS);
  updateLabelVisibility();

  document.getElementById("searchInput").addEventListener("input", applyFilters);
  document.getElementById("regionFilter").addEventListener("change", applyFilters);
  document.getElementById("phaseFilter").addEventListener("change", applyFilters);
  document.getElementById("labelToggle").addEventListener("change", (e) => {
    labelsEnabled = e.target.checked;
    updateLabelVisibility();
  });
  document.querySelectorAll(".status-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".status-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      statusFilter = tab.dataset.status;
      applyFilters();
    });
  });
  kakao.maps.event.addListener(map, "zoom_changed", updateLabelVisibility);

  kakao.maps.event.addListener(map, "click", () => {
    if (suppressNextMapClick) { suppressNextMapClick = false; return; }
    clearSelection();
  });
}

function populateFilters() {
  const regions = [...new Set(CENTERS.map(c => c.region))].sort();
  const phases = [...new Set(CENTERS.map(c => c.phase))].sort((a,b) => a-b);
  const regionSel = document.getElementById("regionFilter");
  const phaseSel = document.getElementById("phaseFilter");
  regions.forEach(r => {
    const opt = document.createElement("option"); opt.value = r; opt.textContent = r;
    regionSel.appendChild(opt);
  });
  phases.forEach(p => {
    const opt = document.createElement("option"); opt.value = p; opt.textContent = p + "차";
    phaseSel.appendChild(opt);
  });
}

function applyFilters() {
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  const region = document.getElementById("regionFilter").value;
  const phase = document.getElementById("phaseFilter").value;
  const filtered = CENTERS.filter(c => {
    const matchesQ = !q || c.name.toLowerCase().includes(q) || c.region.toLowerCase().includes(q);
    const matchesRegion = !region || c.region === region;
    const matchesPhase = !phase || String(c.phase) === phase;
    const matchesStatus = !statusFilter || c.status === statusFilter;
    return matchesQ && matchesRegion && matchesPhase && matchesStatus;
  });
  renderList(filtered);
  plotMarkers(filtered);
  document.getElementById("visibleCount").textContent = filtered.length;
}

function renderList(items) {
  const list = document.getElementById("list");
  list.innerHTML = "";
  document.getElementById("resultCount").textContent = `${items.length}개 센터`;
  items.forEach(c => {
    const card = document.createElement("div");
    card.className = "card" + (c.code === selectedCode ? " active" : "");
    card.dataset.code = c.code;
    const badgeClass = c.status === "건설중" ? "building" : "done";
    card.innerHTML = `
      <div class="card-top">
        <span class="card-name">${c.name}</span>
        <span class="badge ${badgeClass}">${c.status}</span>
      </div>
      <div class="card-meta">${c.phase}차 · ${c.region}${c.opened ? " · 개소 " + formatDate(c.opened) : ""}</div>
    `;
    card.addEventListener("click", () => selectCenter(c, { pan: true }));
    list.appendChild(card);
  });
}

function plotMarkers(items) {
  markerEntries.forEach(e => { e.marker.setMap(null); e.labelOverlay.setMap(null); });
  markerEntries = [];

  items.forEach(c => {
    const pos = new kakao.maps.LatLng(c.lat, c.lng);

    const marker = new kakao.maps.Marker({ position: pos, map: map, image: pinImage(c.status) });
    kakao.maps.event.addListener(marker, "click", () => selectCenter(c));

    const labelEl = document.createElement("div");
    labelEl.className = "label-overlay";
    labelEl.textContent = shortLabelName(c.name);
    labelEl.addEventListener("click", () => {
      suppressNextMapClick = true;
      selectCenter(c);
    });

    const labelOverlay = new kakao.maps.CustomOverlay({
      position: pos, content: labelEl, yAnchor: LABEL_Y_ANCHOR, zIndex: 4,
    });
    labelOverlay.setMap(labelsEnabled ? map : null);

    markerEntries.push({ code: c.code, center: c, marker, labelOverlay, labelEl });
  });
}

function updateLabelVisibility() {
  const zoomOk = map.getLevel() <= LABEL_VISIBLE_MAX_LEVEL;
  markerEntries.forEach(e => { e.labelOverlay.setMap(labelsEnabled && zoomOk ? map : null); });
}

function selectCenter(c, { pan = false } = {}) {
  if (selectedCode === c.code) return;
  selectedCode = c.code;
  markerEntries.forEach(e => e.labelEl.classList.toggle("selected", e.code === c.code));
  document.querySelectorAll(".card").forEach(el => el.classList.toggle("active", el.dataset.code === c.code));
  if (pan) map.panTo(new kakao.maps.LatLng(c.lat, c.lng));
  openInfoPanel(c);
}

function clearSelection() {
  if (selectedCode == null) return;
  selectedCode = null;
  markerEntries.forEach(e => e.labelEl.classList.remove("selected"));
  document.querySelectorAll(".card").forEach(el => el.classList.remove("active"));
  closeInfoPanel();
}

function buildInfoPanelBody(c) {
  return `
    <div class="ip-row"><b>${c.phase}차</b> · ${c.region}</div>
    ${c.opened ? `<div class="ip-row">개소일 &nbsp;${formatDate(c.opened)}</div>` : ""}
    ${c.address ? `<div class="ip-row">${c.address}</div>` : ""}
    <div class="ip-row">센터코드 &nbsp;${c.code}</div>
    ${c.precision && c.precision !== "실주소 지오코딩" ? `<div class="ip-note">⚠ 좌표: ${c.precision} — 정확한 대지 확정 후 재지오코딩 필요</div>` : ""}
    <div class="ip-detail-link" style="margin-top:10px;">
      <button type="button" class="ip-detail-btn">상세보기 →</button>
    </div>
  `;
}

function openInfoPanel(c) {
  closeInfoPanel();

  const wrapper = document.createElement("div");
  wrapper.className = "info-panel info-panel-fixed";
  const color = colorForStatus(c.status);
  wrapper.style.setProperty("--cat-color", color);
  wrapper.style.setProperty("--cat-bg", hexToLightBg(color));

  const header = document.createElement("div");
  header.className = "info-panel-header";

  const dragIcon = document.createElement("span");
  dragIcon.className = "info-panel-drag-icon";
  dragIcon.textContent = "⠿";
  dragIcon.setAttribute("aria-hidden", "true");
  header.appendChild(dragIcon);

  const title = document.createElement("span");
  title.className = "info-panel-title";
  title.textContent = c.name.replace(/\(건설중, 명칭 미정\)/, "");
  header.appendChild(title);

  const badge = document.createElement("span");
  badge.className = "info-panel-badge";
  badge.textContent = c.status;
  header.appendChild(badge);

  const closeBtn = document.createElement("span");
  closeBtn.className = "info-panel-close";
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => clearSelection());
  header.appendChild(closeBtn);

  wrapper.appendChild(header);

  const body = document.createElement("div");
  body.className = "info-panel-body";
  body.innerHTML = buildInfoPanelBody(c);
  const detailBtn = body.querySelector(".ip-detail-btn");
  if (detailBtn) detailBtn.addEventListener("click", () => openDetailModal(c));
  wrapper.appendChild(body);

  const onHeaderDragStart = (e) => {
    if (e.target === closeBtn) return;
    startDragPanel(wrapper, e, (left, top) => { infoPanelCustomPosition = { left, top }; });
  };
  header.addEventListener("mousedown", onHeaderDragStart);
  header.addEventListener("touchstart", onHeaderDragStart, { passive: false });

  mapContainer.appendChild(wrapper);
  if (infoPanelCustomPosition) {
    wrapper.style.left = `${infoPanelCustomPosition.left}px`;
    wrapper.style.top = `${Math.max(infoPanelCustomPosition.top, 0)}px`;
  } else {
    wrapper.style.left = `${mapContainer.clientWidth - wrapper.offsetWidth - 270}px`;
    wrapper.style.top = "10px";
  }

  infoPanelEl = wrapper;
  infoPanelToken += 1;
}

function closeInfoPanel() {
  if (infoPanelEl && infoPanelEl.parentNode) infoPanelEl.parentNode.removeChild(infoPanelEl);
  infoPanelEl = null;
  infoPanelToken += 1;
}

function startDragPanel(panelEl, startEvent, onPositionChange) {
  const point = startEvent.touches ? startEvent.touches[0] : startEvent;
  const startX = point.clientX, startY = point.clientY;
  const startLeft = panelEl.offsetLeft, startTop = panelEl.offsetTop;

  function onMove(e) {
    const p = e.touches ? e.touches[0] : e;
    let left = startLeft + (p.clientX - startX);
    let top = Math.max(startTop + (p.clientY - startY), 0);
    panelEl.style.left = `${left}px`;
    panelEl.style.top = `${top}px`;
    onPositionChange(left, top);
    if (e.cancelable) e.preventDefault();
  }
  function onEnd() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onEnd);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onEnd);
  }
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onEnd);
  document.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("touchend", onEnd);
  startEvent.preventDefault();
}

function formatDate(s) { return s ? s.replaceAll("-", ".") : "-"; }

const DETAIL_TABS = ["개요", "건립비·추진경과", "담당자", "월별 집행현황", "운영현황", "자료요청 이력"];
let detailBackdropEl = null;

function emptyState(msg) {
  return `<div class="empty-state"><div class="es-icon">🛈</div>${msg}</div>`;
}

function buildOverviewTab(c) {
  return `
    <div class="detail-row"><span class="dr-label">정식 명칭</span><span class="dr-value">${c.name.replace(/\(건설중, 명칭 미정\)/, "")}</span></div>
    <div class="detail-row"><span class="dr-label">센터코드</span><span class="dr-value">${c.code}</span></div>
    <div class="detail-row"><span class="dr-label">차수 / 상태</span><span class="dr-value">${c.phase}차 · ${c.status}</span></div>
    <div class="detail-row"><span class="dr-label">지역</span><span class="dr-value">${c.region}</span></div>
    ${c.opened ? `<div class="detail-row"><span class="dr-label">개소일</span><span class="dr-value">${formatDate(c.opened)}</span></div>` : ""}
    ${c.address ? `<div class="detail-row"><span class="dr-label">위치</span><span class="dr-value">${c.address}${c.precision && c.precision !== "실주소 지오코딩" ? ` <span style="color:var(--red);font-size:11.5px;">(⚠ ${c.precision})</span>` : ""}</span></div>` : ""}
  `;
}

function buildBudgetTab(c) {
  return emptyState(
    "연도별 국비/지방비 건립비와 추진경과는 아직 이 프로토타입에 연동되지 않았습니다.<br>" +
    "ERD의 construction_budget_yearly / construction_milestones 테이블에 데이터가 채워지면 이 탭에 연도별 그래프와 타임라인이 표시될 예정입니다."
  );
}

function buildContactTab(c) {
  const ops = OPS_DATA[c.code];
  if (ops && ops.operator) {
    return `
      <div class="detail-row"><span class="dr-label">위탁운영기관</span><span class="dr-value">${ops.operator}</span></div>
      ${emptyState("광역/기초지자체 실무 담당자 연락처는 아직 연동 전입니다. contacts 테이블 데이터 확정 후 채워집니다.")}
    `;
  }
  return emptyState("아직 운영기관이 지정되지 않았거나(건설중) 담당자 정보가 연동되지 않았습니다.");
}

function buildExecutionTab(c) {
  return emptyState(
    "월별 국비 집행 현황(집행률, 집행부진 사유 등)은 아직 이 프로토타입에 연동되지 않았습니다.<br>" +
    "monthly_execution 테이블 데이터가 채워지면 이 탭에 월별 집행률 추이가 표시될 예정입니다."
  );
}

function buildOperationTab(c) {
  if (c.status === "건설중") {
    return emptyState("건설중 센터입니다. 준공 후 운영 데이터(입주율·임대료)가 연동됩니다.");
  }
  const ops = OPS_DATA[c.code];
  if (!ops) return emptyState("운영 데이터가 아직 없습니다.");
  const occ = ops.occ2026;
  const occRateDisplay = occ.occ_rate != null ? `${occ.occ_rate}%` : "-";
  return `
    <div class="stat-grid">
      <div class="stat-card"><div class="sc-label">입주율 (2026.6)</div><div class="sc-value">${occRateDisplay}</div></div>
      <div class="stat-card"><div class="sc-label">입주기업수</div><div class="sc-value">${occ.companies ?? "-"}</div></div>
      <div class="stat-card"><div class="sc-label">공실수 / 전체실수</div><div class="sc-value">${occ.vacant_units ?? "-"} / ${occ.total_units ?? "-"}</div></div>
    </div>
    <div class="detail-row"><span class="dr-label">임대료(3.3㎡당)</span><span class="dr-value">${ops.rent_2026 || "-"} <span style="color:var(--ink-soft);font-size:11.5px;">${ops.rent_note_2026 || ""}</span></span></div>
    <div class="detail-row"><span class="dr-label">주요업종</span><span class="dr-value">${ops.industry || "-"}</span></div>
    <div class="detail-row"><span class="dr-label">위탁운영기관</span><span class="dr-value">${ops.operator || "-"}</span></div>
    <p style="margin:12px 0 0;font-size:11.5px;color:var(--ink-soft);">출처: 260707_지식산업센터_입주율_및_임대료_조사.xlsx (2021~2026년 연도별 추이는 추후 그래프로 추가 예정)</p>
  `;
}

function buildRequestHistoryTab(c) {
  return emptyState(
    "이 센터로 발송된 본부 자료요청(data_requests) 이력이 없습니다.<br>" +
    "본부에서 새 자료요청을 배포하면 이 탭에 시간순으로 쌓이도록 설계되어 있습니다 (ERD 문서 6장 참고)."
  );
}

const TAB_BUILDERS = [buildOverviewTab, buildBudgetTab, buildContactTab, buildExecutionTab, buildOperationTab, buildRequestHistoryTab];

function openDetailModal(c) {
  closeDetailModal();

  const backdrop = document.createElement("div");
  backdrop.className = "detail-backdrop";
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeDetailModal(); });

  const modal = document.createElement("div");
  modal.className = "detail-modal";
  modal.addEventListener("click", (e) => e.stopPropagation());

  const color = colorForStatus(c.status);
  modal.style.setProperty("--cat-color", color);
  modal.style.setProperty("--cat-bg", hexToLightBg(color));

  const header = document.createElement("div");
  header.className = "detail-header";
  header.innerHTML = `
    <div class="detail-header-main">
      <span class="dh-badge">${c.status}</span>
      <h2>${c.name.replace(/\(건설중, 명칭 미정\)/, "")}</h2>
      <p class="dh-sub">${c.phase}차 · ${c.region} · ${c.code}</p>
    </div>
  `;
  const closeBtn = document.createElement("span");
  closeBtn.className = "detail-close";
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", closeDetailModal);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const tabsEl = document.createElement("div");
  tabsEl.className = "detail-tabs";
  const bodyEl = document.createElement("div");
  bodyEl.className = "detail-body";

  let activeTab = 0;
  function renderTab() {
    tabsEl.innerHTML = "";
    DETAIL_TABS.forEach((label, i) => {
      const tab = document.createElement("div");
      tab.className = "detail-tab" + (i === activeTab ? " active" : "");
      tab.textContent = label;
      tab.addEventListener("click", () => { activeTab = i; renderTab(); });
      tabsEl.appendChild(tab);
    });
    bodyEl.innerHTML = TAB_BUILDERS[activeTab](c);
  }
  renderTab();

  modal.appendChild(tabsEl);
  modal.appendChild(bodyEl);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  detailBackdropEl = backdrop;

  document.addEventListener("keydown", onDetailEscKey);
}

function onDetailEscKey(e) { if (e.key === "Escape") closeDetailModal(); }

function closeDetailModal() {
  if (detailBackdropEl && detailBackdropEl.parentNode) detailBackdropEl.parentNode.removeChild(detailBackdropEl);
  detailBackdropEl = null;
  document.removeEventListener("keydown", onDetailEscKey);
}

loadKakaoSdkAndInit();
