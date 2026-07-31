<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 배포 워크플로우

이 저장소는 Vercel이 `main` 브랜치를 프로덕션으로 자동 배포한다(shinnaagym.vercel.app).
작업 브랜치에만 커밋해두면 실제 사이트에 반영되지 않는다. 그러므로:

- 코드 변경(기능 추가/수정/버그 수정 등)을 커밋한 뒤에는, 사용자가 PR을 만들라고
  별도로 요청하지 않았더라도 **항상** 그 브랜치로 PR을 만들고 바로 `main`에
  병합한다. "PR 만들어줘" 같은 명시적 요청을 기다리지 않는다.
- 이미 다른 브랜치에 병합되지 않은 이전 작업이 남아있다면 함께 병합한다.
- 병합 후에는 Vercel 빌드에 1~2분 정도 걸린다는 점을 사용자에게 안내한다.
