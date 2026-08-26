# 뉴북 상담소

신입 작가의 일상 소설 속 인물과 25턴 동안 대화하며 마음을 알아가는 웹앱입니다.

## 구조

- `frontend`: React + Vite + TypeScript 채팅 UI
- `backend`: Node.js + Express API
- `backend/books/*.json`: 책, 내담자, 정답 키워드, 발췌문 데이터
- `backend/data/survey.json`: 국립중앙도서관 입고 희망 설문 누적 결과

## 실행

```text
cd debate-platform/backend
npm install
npm run dev

cd debate-platform/frontend
npm install
npm run dev
```

`OPENAI_API_KEY`를 설정하면 캐릭터 롤플레이와 25턴 후 의미 기반 키워드 판정에 OpenAI function calling을 사용합니다. 키가 없으면 동일한 흐름을 확인할 수 있는 로컬 fallback이 사용됩니다.

상담 종료 전에는 엔딩 문구를 노출하지 않으며, 25번째 턴이 끝난 뒤 전체 대화 로그를 한 번에 판정합니다.
