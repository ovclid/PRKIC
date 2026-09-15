// Supabase 클라이언트 초기화.
// index.html에서 supabase-js UMD 번들을 이 스크립트보다 먼저 로드해야
// window.supabase(라이브러리 네임스페이스)가 존재한다.

function isSupabaseConfigured() {
  return (
    SUPABASE_URL && !SUPABASE_URL.includes("https://avgwolhybzanicocqxgy.supabase.co") &&
    SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes("sb_publishable_8BxXBIZ5amqQIMBdBcc5rA_TQ7QBYff")
  );
}

const supabaseClient = isSupabaseConfigured()
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (!supabaseClient) {
  console.warn("[supabaseClient] SUPABASE_URL/ANON_KEY가 설정되지 않아 정적 폴백 데이터를 사용합니다.");
}
