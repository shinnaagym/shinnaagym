# 신나아짐 사전예약

전 직원이 물리치료사인 프리미엄 PT 스튜디오 "신나아짐"의 오픈 전 사전예약 웹앱입니다.
Next.js(App Router) + Postgres로 만들어졌고, Vercel에 배포하는 것을 기준으로 구성했습니다.

## 기능

- 소개 페이지: 브랜드 소개, 신뢰 포인트, 사전예약 안내
- 예약 폼: 성함 / 나이 / 연락처 / 운동 목적(재활·체형교정·다이어트·근력 증진·키성장 다중 선택) + 한 줄 설명
- 예약 달력: 오늘부터 90일 이내, 매일 09:00~22:00을 1시간 단위로 예약. 이미 예약된 시간은
  DB의 `UNIQUE(reservation_date, reservation_hour)` 제약으로 동시에 두 명이 같은 시간을
  예약할 수 없도록 막습니다.
- 관리자 페이지(`/admin`): 비밀번호로 로그인 후 전체 예약 목록 확인 및 취소(삭제) 가능.
  기본 비밀번호는 `951105`이며, `ADMIN_PASSWORD` 환경변수로 바꿀 수 있습니다.

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
4. Deploy를 누르면 끝입니다. 이후 `main`(또는 배포 브랜치)에 푸시할 때마다 자동 배포됩니다.

## 환경변수

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `POSTGRES_URL` | 예 | Postgres 연결 문자열. Vercel Storage에서 Postgres를 연결하면 자동으로 설정됩니다. 로컬 개발 시 직접 채워주세요. |
| `ADMIN_PASSWORD` | 아니오 | 관리자 로그인 비밀번호. 기본값은 `951105`입니다. |
| `ADMIN_SESSION_SECRET` | 배포 시 권장 | 관리자 세션 쿠키 서명용 비밀 키. 설정하지 않으면 개발용 기본값이 쓰이므로, 운영 배포 전에는 꼭 설정해주세요. |

## 소개 문구 속 정보 수정하기

`app/page.tsx`의 `<footer>` 영역에 연락처(`010-6856-6114`)가 들어가 있습니다.
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
  constants.ts                  # 영업시간, 운동 목적 옵션 등
  date.ts                      # KST 기준 날짜 유틸
```
