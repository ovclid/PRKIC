// 로그인 상태 관리. index.html에서 supabaseClient.js 다음, dataLoader.js/map.js보다
// 먼저 로드해야 한다. profiles 조회는 007_profiles_rls_fix.sql이 적용돼 있어야 동작한다.

let currentUser = null; // Supabase auth user 객체 | null
let currentProfile = null; // { org_id, role, organizations: { name, org_type } } | null

async function initAuth() {
  if (!supabaseClient) {
    renderAuthUI();
    return;
  }
  const { data: { session } } = await supabaseClient.auth.getSession();
  await applySession(session);
  renderAuthUI();
  if (typeof onAuthChangedHook === "function") onAuthChangedHook();

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    await applySession(session);
    renderAuthUI();
    if (typeof onAuthChangedHook === "function") onAuthChangedHook();
  });
}

async function applySession(session) {
  if (!session) {
    currentUser = null;
    currentProfile = null;
    return;
  }
  currentUser = session.user;
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("org_id, role, organizations(name, org_type, region_sido)")
    .eq("id", session.user.id)
    .single();
  if (error) {
    console.warn("[auth] 프로필 조회 실패 (계정은 있지만 profiles 행이 없을 수 있음):", error.message);
    currentProfile = null;
  } else {
    currentProfile = data;
  }
}

async function signOut() {
  if (supabaseClient) await supabaseClient.auth.signOut();
  currentUser = null;
  currentProfile = null;
  renderAuthUI();
  if (typeof onAuthChangedHook === "function") onAuthChangedHook();
}

function renderAuthUI() {
  const el = document.getElementById("authStatus");
  if (!el) return;

  if (currentUser && currentProfile) {
    const org = currentProfile.organizations;
    el.innerHTML = `
      <span class="auth-org">${org ? org.name : "소속 미상"} · ${currentProfile.role}</span>
      <button type="button" id="logoutBtn" class="auth-logout-btn">로그아웃</button>
    `;
    document.getElementById("logoutBtn").addEventListener("click", signOut);
  } else if (currentUser) {
    el.innerHTML = `
      <span class="auth-org">로그인됨 (프로필 없음 - profiles 테이블 확인 필요)</span>
      <button type="button" id="logoutBtn" class="auth-logout-btn">로그아웃</button>
    `;
    document.getElementById("logoutBtn").addEventListener("click", signOut);
  } else {
    el.innerHTML = `<a href="./login.html" class="auth-login-link">담당자 로그인 →</a>`;
  }
}
