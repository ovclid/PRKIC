// Supabase 클라이언트 초기화.
// index.html에서 supabase-js UMD 번들을 이 스크립트보다 먼저 로드해야
// window.supabase(라이브러리 네임스페이스)가 존재한다.

// HTTP 헤더(apikey, Authorization)에는 ISO-8859-1(Latin-1) 범위 밖의 문자를 넣을 수 없다.
// config.js에 URL/키를 붙여넣을 때 안내문의 한글이 같이 딸려오거나, 스마트 따옴표(" " 등)가
// 섞여 들어가면 "Failed to execute 'set' on 'Headers'" 라는 알아보기 힘든 에러로만 나타난다.
// 여기서 미리 걸러서 어느 문자가 문제인지 콘솔에 바로 찍어준다.
function findNonLatin1Chars(str) {
  const bad = [];
  for (const ch of str) {
    if (ch.codePointAt(0) > 255) bad.push(ch);
  }
  return [...new Set(bad)];
}

function isSupabaseConfigured() {
  const url = (typeof SUPABASE_URL === "string" ? SUPABASE_URL : "").trim();
  const key = (typeof SUPABASE_ANON_KEY === "string" ? SUPABASE_ANON_KEY : "").trim();

  if (!url || url.includes("https://avgwolhybzanicocqxgy.supabase.co") || !key || key.includes("sb_publishable_8BxXBIZ5amqQIMBdBcc5rA_TQ7QBYff")) return false;

  const badUrlChars = findNonLatin1Chars(url);
  const badKeyChars = findNonLatin1Chars(key);
  if (badUrlChars.length || badKeyChars.length) {
    console.error(
      "[supabaseClient] SUPABASE_URL 또는 SUPABASE_ANON_KEY에 헤더로 보낼 수 없는 문자가 섞여 있습니다.",
      { badUrlChars, badKeyChars }
    );
    console.error(
      "config.js에서 따옴표 안에 안내 문구(한글)나 스마트 따옴표가 같이 복사되지 않았는지, " +
      "값 앞뒤에 불필요한 텍스트가 없는지 확인하세요. 순수 URL/키 문자열만 있어야 합니다."
    );
    return false;
  }
  return true;
}

const supabaseClient = isSupabaseConfigured()
  ? window.supabase.createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim())
  : null;

if (!supabaseClient) {
  console.warn("[supabaseClient] SUPABASE_URL/ANON_KEY가 설정되지 않아 정적 폴백 데이터를 사용합니다.");
}
