import { useEffect, useMemo, useRef, useState } from 'react';
import { CardPanel } from './components/CardPanel';
import { ChatLog } from './components/ChatLog';
import { ProfilePanel } from './components/ProfilePanel';
import { ScoreReport } from './components/ScoreReport';
import { TimerDisplay } from './components/TimerDisplay';
import type { ChatMessage, DebateBook, DebateCard, DebateSide, JudgeScore } from './types';

interface DebateStage {
  key: 'opening' | 'cardSelection' | 'rebuttal' | 'final';
  label: string;
  sideOrder: DebateSide[];
  durations: number[];
}

const stageDefinitions: DebateStage[] = [
  { key: 'opening', label: '입론 단계', sideOrder: ['pro', 'con'], durations: [120, 120] },
  { key: 'cardSelection', label: '카드 선택 타임', sideOrder: ['pro', 'con'], durations: [45, 45] },
  { key: 'rebuttal', label: '반박 및 재반론', sideOrder: ['con', 'pro', 'pro', 'con'], durations: [90, 90, 90, 90] },
  { key: 'final', label: '최종 정리 및 판결', sideOrder: ['pro', 'con'], durations: [90, 90] }
];

const initialCards: DebateCard[] = [
  { id: 'defense', type: 'defense', label: '방어 카드', description: '상대 카드 효과를 무효화합니다.', used: false },
  { id: 'reduce', type: 'reduce', label: '시간 단축 카드', description: '상대 발표 시간을 30초 줄입니다.', used: false },
  { id: 'extend', type: 'extend', label: '시간 연장 카드', description: '자신의 발표 시간을 30초 연장합니다.', used: false }
];

const bookLibrary: DebateBook[] = [
  {
    id: 'book1',
    title: '논리의 기술',
    author: '조던 엘런버그',
    summary: '토론과 논증의 구조를 이해하고, 합리적 사고의 기본 원칙을 다룹니다.'
  },
  {
    id: 'book2',
    title: '생각의 정리',
    author: '애니스 나이',
    summary: '주장, 증거, 반론의 흐름을 효과적으로 구성하는 방법을 소개합니다.'
  },
  {
    id: 'book3',
    title: '말의 미래',
    author: '티무어 베키',
    summary: '언어와 설득의 힘을 살펴보며 토론에서 근거를 강화하는 전략을 제시합니다.'
  }
];

function formatSideLabel(side: DebateSide | 'user') {
  if (side === 'pro') return '찬성';
  if (side === 'con') return '반대';
  return '사용자';
}

export default function App() {
  const [playerSide, setPlayerSide] = useState<DebateSide>('pro');
  const [stageIndex, setStageIndex] = useState(0);
  const [turnIndex, setTurnIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(stageDefinitions[0].durations[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cardsBySide, setCardsBySide] = useState<Record<DebateSide, DebateCard[]>>({
    pro: initialCards.map((card) => ({ ...card })),
    con: initialCards.map((card) => ({ ...card }))
  });
  const [defenseShieldSide, setDefenseShieldSide] = useState<DebateSide | null>(null);
  const [inputContent, setInputContent] = useState('');
  const [judgeScore, setJudgeScore] = useState<JudgeScore | null>(null);
  const [judgeStatus, setJudgeStatus] = useState<'idle' | 'pending' | 'done'>('idle');
  const [isFinished, setIsFinished] = useState(false);
  const [username, setUsername] = useState('플레이어');
  const [selectedBookId, setSelectedBookId] = useState(bookLibrary[0].id);
  const [pendingTimeAdjustments, setPendingTimeAdjustments] = useState<Record<DebateSide, number>>({ pro: 0, con: 0 });
  const [isStreamingResponse, setIsStreamingResponse] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const aiResponseRequested = useRef(false);

  const currentStage = stageDefinitions[stageIndex];
  const currentSide = currentStage.sideOrder[turnIndex];
  const currentDuration = currentStage.durations[turnIndex];
  const isPlayerTurn = currentSide === playerSide;
  const currentDeck = cardsBySide[currentSide];
  const selectedBook = bookLibrary.find((book) => book.id === selectedBookId) ?? bookLibrary[0];
  const activeDefense = defenseShieldSide !== null && defenseShieldSide !== currentSide;
  const isCardSelectionPhase = currentStage.key === 'cardSelection';
  const isCompleteEnabled = hasStarted && isPlayerTurn && !isFinished && !isStreamingResponse && (isCardSelectionPhase || inputContent.trim().length > 0);
  const completeButtonLabel = isPlayerTurn ? '완료' : 'AI 발언 진행 중';
  const inputPlaceholder = !hasStarted
    ? '토론을 시작하려면 우선 준비를 완료하세요.'
    : isPlayerTurn
    ? isCardSelectionPhase
      ? '카드를 선택하거나 발언 후 완료 버튼을 누르세요.'
      : '발언을 작성한 뒤 완료 버튼을 누르세요.'
    : 'AI가 자동으로 발언을 준비 중입니다.';

  useEffect(() => {
    if (!hasStarted || isFinished) {
      setIsRunning(false);
      return;
    }

    const timerId = setInterval(() => {
      setRemainingSeconds((seconds) => {
        if (!isRunning) {
          return seconds;
        }
        if (seconds <= 1) {
          clearInterval(timerId);
          advanceTurn();
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [hasStarted, isRunning, isFinished]);

  useEffect(() => {
    if (!hasStarted) {
      return;
    }

    const bonus = pendingTimeAdjustments[currentSide] ?? 0;
    setRemainingSeconds(Math.max(0, currentDuration + bonus));
    setIsRunning(true);

    if (bonus !== 0) {
      setPendingTimeAdjustments((current) => ({ ...current, [currentSide]: 0 }));
    }
  }, [hasStarted, stageIndex, turnIndex, currentDuration, currentSide, pendingTimeAdjustments]);

  function pushMessage(side: DebateSide | 'user', content: string, id?: string) {
    const messageId = id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const nextMessage: ChatMessage = {
      id: messageId,
      side,
      content,
      timestamp: new Date().toISOString()
    };
    setMessages((current) => [...current, nextMessage]);
    return messageId;
  }

  function appendMessageChunk(id: string, chunk: string) {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, content: message.content + chunk } : message))
    );
  }

  const handleStartDebate = () => {
    if (!username.trim() || !selectedBookId) {
      alert('사용자 이름과 도서를 선택해야 합니다.');
      return;
    }

    setHasStarted(true);
    setStageIndex(0);
    setTurnIndex(0);
    setMessages([
      {
        id: `system-${Date.now()}`,
        side: 'user',
        content: `${username}님과 AI의 ${selectedBook.title} 토론을 시작합니다.`,
        timestamp: new Date().toISOString()
      }
    ]);
    setCardsBySide({
      pro: initialCards.map((card) => ({ ...card })),
      con: initialCards.map((card) => ({ ...card }))
    });
    setDefenseShieldSide(null);
    setPendingTimeAdjustments({ pro: 0, con: 0 });
    setJudgeScore(null);
    setJudgeStatus('idle');
    setIsFinished(false);
    setInputContent('');
    setIsStreamingResponse(false);
    setStreamingMessageId(null);
    setIsRunning(true);
  };

  function advanceTurn() {
    if (isFinished) {
      return;
    }

    if (stageIndex >= stageDefinitions.length - 1 && turnIndex >= currentStage.sideOrder.length - 1) {
      finishDebate();
      return;
    }

    if (turnIndex < currentStage.sideOrder.length - 1) {
      setTurnIndex((current) => current + 1);
      return;
    }

    setStageIndex((current) => Math.min(current + 1, stageDefinitions.length - 1));
    setTurnIndex(0);
  }

  async function requestJudgeResult() {
    const payload = {
      messages: messages.map((message) => ({ side: message.side, content: message.content })),
      book: selectedBook.title
    };

    try {
      const response = await fetch('/api/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error('심판 평가 요청 실패');
      }
      const data = await response.json();
      return data as JudgeScore;
    } catch (error) {
      return {
        logicStructure: 6,
        consistency: 6,
        evidenceAccuracy: 5,
        summary: 'AI 심판 평가를 생성할 수 없어 기본 점수를 제공합니다. 네트워크 연결이나 모델 키를 확인하세요.'
      };
    }
  }

  async function finishDebate() {
    if (isFinished) {
      return;
    }

    setIsFinished(true);
    setIsRunning(false);
    setJudgeStatus('pending');
    const score = await requestJudgeResult();
    setJudgeScore(score);
    setJudgeStatus('done');
  }

  function handleUseCard(side: DebateSide, cardId: string) {
    if (!isCardSelectionPhase) {
      pushMessage('user', '카드는 카드 선택 타임에서만 사용할 수 있습니다.');
      return;
    }

    setCardsBySide((current) => {
      const nextCards = current[side].map((card) => {
        if (card.id !== cardId || card.used) {
          return card;
        }
        return { ...card, used: true };
      });
      return { ...current, [side]: nextCards };
    });

    const opponentSide: DebateSide = currentSide === 'pro' ? 'con' : 'pro';
    const currentCard = currentDeck.find((card) => card.id === cardId);
    if (!currentCard) {
      return;
    }

    let updatedContent = '';
    if (defenseShieldSide === opponentSide) {
      setDefenseShieldSide(null);
      updatedContent = `${formatSideLabel(currentSide)}의 카드가 상대의 방어 카드에 의해 무효화되었습니다.`;
    } else if (currentCard.type === 'defense') {
      setDefenseShieldSide(currentSide);
      updatedContent = `${formatSideLabel(currentSide)}가 방어 카드를 사용하여 다음 상대 카드 효과를 무효화할 준비를 합니다.`;
    } else if (currentCard.type === 'reduce') {
      setPendingTimeAdjustments((current) => ({
        ...current,
        [opponentSide]: (current[opponentSide] ?? 0) - 30
      }));
      updatedContent = `${formatSideLabel(currentSide)}가 시간 단축 카드를 사용하여 다음 상대 발언 시간을 30초 줄이기로 했습니다.`;
    } else {
      setPendingTimeAdjustments((current) => ({
        ...current,
        [currentSide]: (current[currentSide] ?? 0) + 30
      }));
      updatedContent = `${formatSideLabel(currentSide)}가 시간 연장 카드를 사용하여 다음 자신의 발언 시간을 30초 늘렸습니다.`;
    }

    pushMessage('user', updatedContent);
  }

  function handleCompleteTurn() {
    if (!hasStarted || isFinished || isStreamingResponse || !isPlayerTurn) {
      return;
    }

    if (!isCardSelectionPhase && !inputContent.trim()) {
      return;
    }

    if (inputContent.trim()) {
      pushMessage(playerSide, inputContent.trim());
      setInputContent('');
    }

    advanceTurn();
  }

  async function generateAIResponse() {
    if (isPlayerTurn || isFinished || isStreamingResponse) {
      return;
    }

    const messageId = pushMessage(currentSide, '', `stream-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    setStreamingMessageId(messageId);
    setIsStreamingResponse(true);

    try {
      const response = await fetch('/api/ai/stream-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: currentSide,
          stage: currentStage.key,
          history: messages.slice(-6).map((item) => item.content),
          book: selectedBook.title
        })
      });

      if (!response.ok || !response.body) {
        throw new Error('스트리밍 응답을 받을 수 없습니다.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = Boolean(doneReading);
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          appendMessageChunk(messageId, chunk);
        }
      }
    } catch (error) {
      appendMessageChunk(messageId, 'AI 응답 생성에 실패했습니다. 기본 메시지를 표시합니다.');
    } finally {
      setIsStreamingResponse(false);
      setStreamingMessageId(null);
      if (!isFinished) {
        advanceTurn();
      }
    }
  }

  useEffect(() => {
    aiResponseRequested.current = false;
  }, [stageIndex, turnIndex]);

  useEffect(() => {
    if (!hasStarted || isPlayerTurn || isFinished || isStreamingResponse || aiResponseRequested.current) {
      return;
    }

    aiResponseRequested.current = true;
    generateAIResponse();
  }, [hasStarted, stageIndex, turnIndex, currentSide, isPlayerTurn, isFinished, isStreamingResponse]);

  function handleReset() {
    setHasStarted(false);
    setStageIndex(0);
    setTurnIndex(0);
    setRemainingSeconds(stageDefinitions[0].durations[0]);
    setIsRunning(false);
    setMessages([]);
    setCardsBySide({
      pro: initialCards.map((card) => ({ ...card })),
      con: initialCards.map((card) => ({ ...card }))
    });
    setDefenseShieldSide(null);
    setJudgeScore(null);
    setJudgeStatus('idle');
    setIsFinished(false);
    setInputContent('');
    setIsStreamingResponse(false);
    setStreamingMessageId(null);
  }

  const stageProgress = useMemo(() => `${stageIndex + 1}/${stageDefinitions.length}`, [stageIndex]);
  const turnProgress = useMemo(() => `${turnIndex + 1}/${currentStage.sideOrder.length}`, [turnIndex, currentStage.sideOrder.length]);

  return (
    <div className="app-shell">
      <div className="header">
        <ProfilePanel
          username={username}
          selectedBookId={selectedBookId}
          books={bookLibrary}
          onUsernameChange={setUsername}
          onBookChange={setSelectedBookId}
          onSideChange={setPlayerSide}
          playerSide={playerSide}
          disabled={hasStarted}
        />
      </div>

      {!hasStarted ? (
        <div className="section" style={{ marginTop: 20 }}>
          <h2>토론 준비하기</h2>
          <p>
            닉네임, 도서, 그리고 찬성/반대 입장을 선택한 뒤 <strong>토론 시작</strong> 버튼을 눌러 토론을 시작하세요.
          </p>
          <button
            className="button-primary"
            onClick={handleStartDebate}
            disabled={!username.trim() || !selectedBookId}
          >
            토론 시작
          </button>
        </div>
      ) : (
        <div className="grid-columns">
          <div>
            <TimerDisplay
              stageLabel={`${currentStage.label} (${turnProgress})`}
              side={currentSide}
              remainingSeconds={remainingSeconds}
              stageKey={currentStage.key}
            />

           <div className="section">
             <h2>발언 입력</h2>
             <textarea
               value={inputContent}
               onChange={(event) => setInputContent(event.target.value)}
               placeholder={inputPlaceholder}
               disabled={!hasStarted || !isPlayerTurn || isFinished}
             />
             <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
               <button className="button-primary" onClick={handleCompleteTurn} disabled={!isCompleteEnabled}>
                 {isStreamingResponse ? 'AI 발언 진행 중...' : completeButtonLabel}
               </button>
             </div>
           </div>

           <CardPanel
             cardsBySide={cardsBySide}
             currentSide={currentSide}
             stageKey={currentStage.key}
             isPlayerTurn={isPlayerTurn}
             onUseCard={handleUseCard}
             activeDefenseSide={defenseShieldSide}
           />
         </div>

         <div>
           <ChatLog messages={messages} />
           <ScoreReport score={judgeScore} />
           {judgeStatus === 'pending' && (
             <div className="section">
               <h2>AI 심판 진행 중</h2>
               <p>토론이 종료되어 AI 심판 평가를 수집하고 있습니다.</p>
             </div>
           )}
         </div>
       </div>
     )}

      <footer>
        {!hasStarted
          ? '토론 준비 중입니다. 시작하기 버튼을 눌러 준비를 완료하세요.'
          : `단계 ${stageProgress} · 현재 차례: ${formatSideLabel(currentSide)} · ${isFinished ? '토론이 종료되었습니다.' : '자동 타이머가 작동 중입니다.'}`}
      </footer>
      <div style={{ marginTop: 12 }}>
        <button className="button-secondary" onClick={handleReset}>
          토론 초기화
        </button>
      </div>
    </div>
  );
}
