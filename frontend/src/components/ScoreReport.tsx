import type { JudgeScore } from '../types';

interface ScoreReportProps {
  score: JudgeScore | null;
}

export function ScoreReport({ score }: ScoreReportProps) {
  if (!score) {
    return (
      <div className="section">
        <h2>AI 심판 결과</h2>
        <p>토론이 끝나면 평가 결과가 여기에 표시됩니다.</p>
      </div>
    );
  }

  const average = ((score.logicStructure + score.consistency + score.evidenceAccuracy) / 3).toFixed(1);

  return (
    <div className="section">
      <h2>AI 심판 결과</h2>
      <div>
        <p>논리 구조: {score.logicStructure}/10</p>
        <p>논리 일관성: {score.consistency}/10</p>
        <p>근거 정확성: {score.evidenceAccuracy}/10</p>
        <p>최종 점수: {average}/10</p>
      </div>
      <div style={{ marginTop: 14, opacity: 0.9 }}>{score.summary}</div>
    </div>
  );
}
