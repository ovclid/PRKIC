// centers / center_profile / operation_occupancy / operation_rent / organizations를
// Supabase에서 읽어와 map.js가 기대하는 CENTERS / OPS_DATA 모양으로 변환한다.
// 연동이 안 되어 있거나 쿼리가 하나라도 실패하면 fallbackData.js의 정적 스냅샷으로 전환한다.
//
// 반환 형태: { centers: [...], ops: {...}, source: "supabase" | "fallback" }
// CENTERS 각 원소 shape: { code, name, phase, status, lat, lng, region, opened, address, precision }
// OPS_DATA[code] shape: { operator, rent_2026, rent_note_2026, occ2026:{...}, industry }

async function loadAppData() {
  if (!supabaseClient) {
    console.warn("[dataLoader] Supabase 미설정 - 정적 폴백 데이터 사용");
    return { centers: CENTERS_FALLBACK, ops: OPS_DATA_FALLBACK, source: "fallback" };
  }

  try {
    const [centersRes, profilesRes, occRes, rentRes, orgsRes] = await Promise.all([
      supabaseClient
        .from("centers")
        .select("center_code, name, phase_no, status, lat, lng, region_sido, opened_date, operator_org_id"),
      supabaseClient.from("center_profile").select("center_code, address, primary_industry"),
      supabaseClient
        .from("operation_occupancy")
        .select("center_code, total_units, occupied_companies, occupied_units, vacant_units")
        .eq("year", 2026)
        .eq("period", "6월말"),
      supabaseClient
        .from("operation_rent")
        .select("center_code, rent_per_pyeong, market_ratio")
        .eq("year", 2026),
      supabaseClient.from("organizations").select("id, name").eq("org_type", "위탁운영기관"),
    ]);

    for (const [label, res] of [
      ["centers", centersRes],
      ["center_profile", profilesRes],
      ["operation_occupancy", occRes],
      ["operation_rent", rentRes],
      ["organizations", orgsRes],
    ]) {
      if (res.error) throw new Error(`${label} 조회 실패: ${res.error.message}`);
    }

    const profileByCode = Object.fromEntries(profilesRes.data.map((p) => [p.center_code, p]));
    const orgNameById = Object.fromEntries(orgsRes.data.map((o) => [o.id, o.name]));
    const occByCode = Object.fromEntries(occRes.data.map((o) => [o.center_code, o]));
    const rentByCode = Object.fromEntries(rentRes.data.map((r) => [r.center_code, r]));
    const operatorIdByCode = Object.fromEntries(centersRes.data.map((c) => [c.center_code, c.operator_org_id]));

    const centers = centersRes.data.map((row) => {
      const profile = profileByCode[row.center_code] || {};
      return {
        code: row.center_code,
        name: row.name,
        phase: row.phase_no,
        status: row.status,
        lat: row.lat,
        lng: row.lng,
        region: row.region_sido,
        opened: row.opened_date || "",
        address: profile.address || null,
        // DB에 좌표 정밀도 컬럼이 아직 없어서 우선 고정값으로 표시.
        // 건설중 센터의 추정 좌표 여부를 구분하려면 centers에 precision 컬럼을 추가할 것.
        precision: "실주소 지오코딩",
      };
    });

    const ops = {};
    for (const code of Object.keys(occByCode)) {
      const occ = occByCode[code];
      const rent = rentByCode[code] || {};
      const profile = profileByCode[code] || {};
      const operatorId = operatorIdByCode[code];
      const occRate = occ.total_units
        ? Math.round((occ.occupied_units / occ.total_units) * 1000) / 10
        : null;
      ops[code] = {
        operator: operatorId ? orgNameById[operatorId] : null,
        rent_2026: rent.rent_per_pyeong ? `${rent.rent_per_pyeong.toLocaleString()}원/3.3㎡` : null,
        rent_note_2026: rent.market_ratio ? `(주변시세 ${Math.round(rent.market_ratio * 100)}%)` : "",
        occ2026: {
          total_units: occ.total_units,
          companies: occ.occupied_companies,
          occupied_units: occ.occupied_units,
          vacant_units: occ.vacant_units,
          occ_rate: occRate,
        },
        industry: profile.primary_industry || null,
      };
    }

    return { centers, ops, source: "supabase" };
  } catch (err) {
    console.error("[dataLoader] Supabase 조회 실패, 정적 폴백 데이터로 전환:", err);
    return { centers: CENTERS_FALLBACK, ops: OPS_DATA_FALLBACK, source: "fallback" };
  }
}
