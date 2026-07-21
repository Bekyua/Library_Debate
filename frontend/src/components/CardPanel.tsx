import type { DebateCard, DebateSide } from '../types';

interface CardPanelProps {
  cardsBySide: Record<DebateSide, DebateCard[]>;
  currentSide: DebateSide;
  stageKey: 'opening' | 'cardSelection' | 'rebuttal' | 'final';
  onUseCard: (side: DebateSide, cardId: string) => void;
  activeDefenseSide: DebateSide | null;
}

export function CardPanel({ cardsBySide, currentSide, stageKey, onUseCard, activeDefenseSide }: CardPanelProps) {
  return (
    <div className="section">
      <h2>카드 패널</h2>
      <p>현재 발언 측: {currentSide === 'pro' ? '찬성' : '반대'}</p>
      <p>활성 방어 카드: {activeDefenseSide ? (activeDefenseSide === 'pro' ? '찬성 측' : '반대 측') : '없음'}</p>
      <div className="card-list">
        {(['pro', 'con'] as DebateSide[]).map((side) => (
          <div key={side} style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
            <h3 style={{ marginBottom: 8 }}>{side === 'pro' ? '찬성 카드' : '반대 카드'}</h3>
            {cardsBySide[side].map((card) => (
              <div key={card.id} className={`card ${card.used ? 'used' : ''}`}>
                <div>
                  <div><strong>{card.label}</strong></div>
                  <div>{card.description}</div>
                </div>
                <button
                  className="button-secondary"
                  disabled={card.used || side !== currentSide || stageKey !== 'cardSelection'}
                  onClick={() => onUseCard(side, card.id)}
                >
                  {card.used
                    ? '사용됨'
                    : stageKey !== 'cardSelection'
                    ? '카드 선택 타임에서만 사용'
                    : side !== currentSide
                    ? '현재 차례가 아님'
                    : '사용'}
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
