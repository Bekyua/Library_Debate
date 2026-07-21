# Debate Game Platform

This project is a starting scaffold for an AI-based 1:1 debate game platform.
The architecture includes a React frontend and a Node/Express backend.

## System architecture

- Frontend: React + Vite + TypeScript
  - Debate flow state machine
  - Countdown timer display
  - Chat log UI
  - Card selection panel
  - Score report UI

- Backend: Node + Express + TypeScript
  - AI response stub endpoint
  - Judge evaluation endpoint
  - Debate engine service for turn handling and card effect state

## Key components

- `DebateBoard`: controls debate phases, current side, and timer behavior
- `TimerDisplay`: renders turn/phase time remaining
- `ChatLog`: collects and shows debate utterances
- `CardPanel`: manages cards, usage and effect application
- `ScoreReport`: renders AI judge metrics and results

## Implementation notes

- The current scaffold is focused on phase handling and component structure.
- LLM integration and streaming are implemented in the backend, with a fallback simulated stream when an OpenAI key is not configured.
- Card effects are modeled using per-side decks and active defense shields, with support for time reduction and extension.
- 토론 단계는 실제 스펙에 가깝게 구성되어 있습니다: 2분 입론, 카드 선택 타임, 6분 반박/재반론, 1분30초 최종 정리.
- AI 심판 엔진은 기본 휴리스틱 평가 논리를 포함하며, OpenAI 키가 설정되면 실제 LLM 기반 평가로 확장됩니다.

## Running locally

1. Backend
   - `cd debate-platform/backend`
   - `npm install`
   - `npm run dev`

2. Frontend
   - `cd debate-platform/frontend`
   - `npm install`
   - `npm run dev -- --host 0.0.0.0`

3. Optional OpenAI setup
   - Set `OPENAI_API_KEY` in your environment to enable real AI streaming and judge evaluation.
   - Optionally set `OPENAI_MODEL` (defaults to `gpt-3.5-turbo`).
