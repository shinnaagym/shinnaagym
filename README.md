# 신나아짐 사전예약

전 직원이 물리치료사인 프리미엄 PT 스튜디오 "신나아짐"의 오픈 전 사전예약 웹앱입니다.
Next.js(App Router) + Postgres로 만들어졌고, Vercel에 배포하는 것을 기준으로 구성했습니다.

## 기능

- 소개 페이지: 브랜드 소개, 신뢰 포인트, 사전예약 안내
- 예약 폼: 성함 / 나이 / 연락처 / 운동 목적(재활·체형교정·다이어트·근력 증진·키성장 다중 선택) + 한 줄 설명
- 예약 달력: 오늘부터 90일 이내, 매일 09:00~22:00을 1시간 단위로 예약. 이미 예약된 시간과
  오늘 날짜의 지난 시간은 자동으로 마감 처리되어 선택할 수 없습니다. 동시에 두 명이 같은
  시간을 예약하는 것은 DB의 `UNIQUE(reservation_date, reservation_hour)` 제약으로 막습니다.
- 관리자 페이지(`/admin`): 비밀번호로 로그인 후 전체 예약 목록 확인 및 취소(삭제) 가능.
  기본 비밀번호는 `951105`이며, `ADMIN_PASSWORD` 환경변수로 바꿀 수 있습니다.
- 예약 알림: `FORMSPREE_ENDPOINT`를 설정하면 새 예약이 접수될 때마다 Formspree를 통해
  연결된 Gmail로 알림 메일이 발송됩니다.

## 로컬 개발

```bash
npm install
cp .env.local.example .env.local   # 아래 "환경변수" 참고해 값 채우기
npm run dev
```

`http://localhost:3000` 에서 확인, 관리자 페이지는 `http://localhost:3000/admin`.

## Vercel 배포 방법

1. 이 저장소를 GitHub에서 Vercel로 Import 합니다. (New Project → 이 저장소 선택)
2. Vercel 프로젝트의 **Storage** 탭에서 **Postgres**(Neon 기반) 데이터베이스를 하나
   생성하고 프로젝트에 연결합니다. 연결하면 `POSTGRES_URL` 환경변수가 자동으로
   설정됩니다. (테이블은 앱이 처음 DB에 접근할 때 자동으로 생성되므로 별도 마이그레이션이
   필요 없습니다.)
3. 프로젝트 **Settings → Environment Variables**에서 아래 값을 추가합니다.
   - `ADMIN_PASSWORD` — 관리자 비밀번호 (기본값 `951105`. 다른 값으로 바꾸고 싶다면 설정)
   - `ADMIN_SESSION_SECRET` — 임의의 긴 무작위 문자열(32자 이상 추천). 관리자 로그인
     세션 쿠키에 서명할 때 사용합니다. 예: `openssl rand -hex 32` 로 생성 가능.
   - `FORMSPREE_ENDPOINT` — (선택) 예약 알림 메일을 받고 싶다면 설정. 아래 "예약 알림 메일
     설정하기" 참고.
4. Deploy를 누르면 끝입니다. 이후 `main`(또는 배포 브랜치)에 푸시할 때마다 자동 배포됩니다.

## 환경변수

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `POSTGRES_URL` | 예 | Postgres 연결 문자열. Vercel Storage에서 Postgres를 연결하면 자동으로 설정됩니다. 로컬 개발 시 직접 채워주세요. |
| `ADMIN_PASSWORD` | 아니오 | 관리자 로그인 비밀번호. 기본값은 `951105`입니다. |
| `ADMIN_SESSION_SECRET` | 배포 시 권장 | 관리자 세션 쿠키 서명용 비밀 키. 설정하지 않으면 개발용 기본값이 쓰이므로, 운영 배포 전에는 꼭 설정해주세요. |
| `FORMSPREE_ENDPOINT` | 아니오 | Formspree 폼 엔드포인트(`https://formspree.io/f/xxxxxxxx`). 설정하면 새 예약마다 이메일 알림을 보냅니다. |
| `NEXT_PUBLIC_GA_ID` | 아니오 | Google Analytics(GA4) 측정 ID(`G-XXXXXXXXXX`). 설정하면 사전예약 랜딩 페이지에서 방문·예약 퍼널 이벤트를 전송합니다. |

## 예약 알림 메일 설정하기

새 예약이 들어올 때마다 Gmail로 알림을 받고 싶다면:

1. [formspree.io](https://formspree.io) 에서 Gmail 계정으로 가입/로그인합니다.
2. **New Form**으로 새 폼을 만들고, 알림 받을 이메일이 본인 Gmail인지 확인합니다.
3. 폼 설정 화면에 나오는 **Endpoint** 주소(`https://formspree.io/f/xxxxxxxx` 형태)를 복사합니다.
4. Vercel 프로젝트 **Settings → Environment Variables**에 `FORMSPREE_ENDPOINT` 이름으로
   위 주소를 추가하고 Production에 적용한 뒤 Redeploy 합니다.
5. 이후 예약이 접수될 때마다 해당 Gmail로 알림 메일이 도착합니다.

(예약 목록 자체는 이미 `/admin` 관리자 페이지에서 언제든 확인할 수 있습니다. Formspree는
"새 예약이 들어왔다"는 실시간 이메일 알림용입니다.)

## GA4(구글 애널리틱스) 연결하고 전환 퍼널 보기

1. GA4 속성에서 측정 ID(`G-XXXXXXXXXX`)를 확인합니다.
2. Vercel 프로젝트 **Settings → Environment Variables**에 `NEXT_PUBLIC_GA_ID` 이름으로
   위 ID를 추가합니다. **Production 환경에만** 적용하는 걸 권장합니다 — 프리뷰/로컬까지
   같이 켜면 테스트 트래픽이 실제 GA 속성에 섞입니다.
3. Redeploy 하면 사전예약 랜딩 페이지(`app/page.tsx`)에만 GA가 로드됩니다. 관리자
   페이지(`/admin` 하위)는 대상이 아니라서 직원 사용은 잡히지 않습니다.

`app/components/ReservationForm.tsx`가 예약 과정을 아래 단계별 이벤트로 GA4에 보냅니다
(`lib/analytics.ts`의 `trackEvent`를 통해서):

| 단계 | 이벤트 이름 | 시점 |
| --- | --- | --- |
| 1. 방문 | `page_view` | GA가 자동으로 수집(코드 수정 불필요) |
| 2. 날짜 선택 | `select_date` | 달력에서 날짜를 클릭했을 때 |
| 3. 시간 선택 | `select_reservation_slot` | 시간대를 클릭했을 때 |
| 4. 제출 시도 | `submit_reservation_attempt` | 필수 항목이 채워진 채로 "사전예약 신청하기"를 눌렀을 때 |
| 4-실패 | `reservation_validation_error` / `reservation_error` | 미입력 항목이 있거나(전자), 서버가 거절하거나 네트워크 오류가 났을 때(후자) — `reason` 파라미터로 원인 확인 가능 |
| 5. **전환** | `generate_lead` | 예약이 실제로 접수 완료됐을 때 |

`generate_lead`가 "사전예약 신청하기" 제출 완료를 나타내는 전환 이벤트입니다. GA4
관리자 화면(**관리 → 이벤트**)에서 `generate_lead` 옆의 **주요 이벤트로 표시(Mark as
key event)** 토글을 켜면, GA4가 이 이벤트를 전환으로 집계하고 각 유입 채널(광고,
인스타그램, 블로그 등)별 전환율을 바로 비교할 수 있습니다. 1~4번 이벤트를 보면
방문자가 어느 단계에서 이탈하는지(날짜는 골랐는데 제출은 안 했다 등)도 확인할 수
있습니다.

## 소개 문구 속 정보 수정하기

`app/page.tsx`의 `<footer>` 영역에 연락처(`010-6859-6114`)가 들어가 있습니다.
정확한 주소와 오픈일이 정해지면 같은 파일의 footer 문구를 원하는 내용으로 바꿔주세요.

## 폴더 구조

```
app/
  page.tsx                     # 랜딩 페이지 (소개 + 예약 폼)
  components/
    ReservationForm.tsx        # 달력 + 예약 폼 (클라이언트 컴포넌트)
    PulseLine.tsx               # 시그니처 그래픽
  admin/
    page.tsx                   # 관리자 로그인
    login-form.tsx
    dashboard/page.tsx          # 예약 목록 (인증 필요)
    dashboard/reservation-table.tsx
  api/
    reservations/route.ts      # 공개: 예약 가능 여부 조회(GET) / 예약 생성(POST)
    admin/login/route.ts        # 관리자 로그인
    admin/logout/route.ts
    admin/reservations/route.ts # 관리자 전용: 목록 조회(GET) / 취소(DELETE)
lib/
  db.ts                        # Postgres 연결 + 스키마 자동 생성
  auth.ts                      # 관리자 세션 쿠키 서명/검증
  reservations.ts               # 예약 가능 여부 조회 헬퍼
  notify.ts                     # Formspree 예약 알림 메일 전송
  constants.ts                  # 영업시간, 운동 목적 옵션 등
  date.ts                      # KST 기준 날짜 유틸 (오늘 날짜/현재 시각)
```
