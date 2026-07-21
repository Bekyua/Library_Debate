import type { DebateSide, StageKey } from '../types';

interface TimerDisplayProps {
  stageLabel: string;
  side: DebateSide;
  remainingSeconds: number;
  stageKey: StageKey;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function TimerDisplay({ stageLabel, side, remainingSeconds, stageKey }: TimerDisplayProps) {
  return (
    <div className="section">
      <h2>현재 단계</h2>
      <p>{stageLabel}</p>
      <h3>{side === 'pro' ? '찬성 측' : '반대 측'} 발언 중</h3>
      <p>{formatTime(remainingSeconds)}</p>
      <p style={{ opacity: 0.8 }}>
        {stageKey === 'cardSelection'
          ? '카드 선택 및 방어를 준비하세요.'
          : stageKey === 'rebuttal'
          ? '반박과 재반론 타임입니다.'
          : stageKey === 'final'
          ? '최종 입장 정리 중입니다.'
          : '첫 입론 단계입니다.'}
      </p>
    </div>
  );
}
