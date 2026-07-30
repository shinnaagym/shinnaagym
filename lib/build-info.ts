import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import path from "path";

// 배포 하나에 속한 모든 서버리스 함수/워커 프로세스가 동일한 값을 가져야
// 하므로(모듈이 프로세스마다 따로 평가되면 값이 달라져 오탐이 난다), 런타임에
// 계산하는 대신 `next build`가 만들어 배포 산출물에 그대로 포함되는
// `.next/BUILD_ID` 파일을 읽어 쓴다. 이 파일은 Vercel이든 자체 호스팅이든
// 같은 배포의 모든 인스턴스가 동일하게 갖는다.
function readNextBuildId(): string | null {
  try {
    return readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    return null;
  }
}

// `next dev`에서는 BUILD_ID 파일이 없어 프로세스 시작 시 한 번만 계산되는
// 랜덤 값으로 대체한다(개발 중에는 버전 배지가 정확하지 않아도 무방하다).
export const BUILD_ID = readNextBuildId() || randomUUID();
