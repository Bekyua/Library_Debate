import type { DebateBook, DebateSide } from '../types';

interface ProfilePanelProps {
  username: string;
  selectedBookId: string;
  books: DebateBook[];
  playerSide: DebateSide;
  onUsernameChange: (username: string) => void;
  onBookChange: (bookId: string) => void;
  onSideChange: (side: DebateSide) => void;
  disabled?: boolean;
}

export function ProfilePanel({ username, selectedBookId, books, onUsernameChange, onBookChange, onSideChange, playerSide, disabled = false }: ProfilePanelProps) {
  const selectedBook = books.find((book) => book.id === selectedBookId) ?? books[0];

  return (
    <div className="section">
      <h2>플레이어 프로필</h2>
      <label style={{ display: 'block', marginBottom: 12 }}>
        닉네임
        <input
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
          disabled={disabled}
          style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff' }}
        />
      </label>
      <label style={{ display: 'block', marginBottom: 12 }}>
        도서 선택
        <select
          value={selectedBookId}
          onChange={(event) => onBookChange(event.target.value)}
          disabled={disabled}
          style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff' }}
        >
          {books.map((book) => (
            <option key={book.id} value={book.id}>
              {book.title} - {book.author}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'block', marginBottom: 12 }}>
        토론 입장 선택
        <select
          value={playerSide}
          onChange={(event) => onSideChange(event.target.value as DebateSide)}
          disabled={disabled}
          style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff' }}
        >
          <option value="pro">찬성</option>
          <option value="con">반대</option>
        </select>
      </label>
      <div style={{ opacity: 0.9 }}>
        <strong>선택 도서:</strong> {selectedBook.title} ({selectedBook.author})
        <p style={{ marginTop: 8 }}>{selectedBook.summary}</p>
      </div>
      <div style={{ marginTop: 12, opacity: 0.8 }}>
        현재 역할: {playerSide === 'pro' ? '찬성' : '반대'}
      </div>
    </div>
  );
}
