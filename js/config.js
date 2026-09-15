// 앱 전역 설정값. 실제 배포 전 아래 두 그룹을 각자 환경에 맞게 채울 것.

// Kakao Maps JavaScript 키 (REST API 키 아님) - Kakao 개발자센터 > 내 애플리케이션 > 앱 키
const KAKAO_JS_KEY = "1eb72b4620f145eb61de789d7ca4f3bd";

// Supabase 프로젝트 정보 - Supabase 대시보드 > Project Settings > API에서 확인
// anon key는 RLS(행 단위 권한)가 켜져 있는 한 브라우저에 노출돼도 안전하도록 설계된 키.
// service_role 키는 절대 프런트엔드 코드에 넣지 말 것 (RLS를 완전히 우회함).
const SUPABASE_URL = "https://avgwolhybzanicocqxgy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8BxXBIZ5amqQIMBdBcc5rA_TQ7QBYff";

const LABEL_VISIBLE_MAX_LEVEL = 11; // 이 레벨보다 축소돼 있으면 라벨 자동 숨김 (전국 뷰 기준으로 조정)
