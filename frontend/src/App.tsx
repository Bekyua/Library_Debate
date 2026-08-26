import { useState } from 'react';
import type { Gender } from './types';
import './styles.css';

type Screen = 'start' | 'chat' | 'result' | 'survey';
type Message = { role: 'player' | 'character'; content: string };
type Book = { id: string; title: string; author: string; coverImage: string; synopsis: string; character: { name: string; age: number; gender: Gender } };
type Discovery = { hiding: boolean; pain: boolean; wish: boolean };
const MAX_TURNS = 25;

const defaultBook: Book = {
  id: 'hanwonyeol', title: '봄도 여름도 아닌', author: 'Yua', coverImage: '/covers/hanwonyeol.svg',
  synopsis: '삶에 흥미를 잃은 두 고등학생이 서로의 마음을 알아가는 일상 로맨스.',
  character: { name: '한원열', age: 18, gender: '남성' }
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('기타');
  const [book] = useState(defaultBook);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [turn, setTurn] = useState(0);
  const [discovery, setDiscovery] = useState<Discovery>({ hiding: false, pain: false, wish: false });
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [surveyAnswer, setSurveyAnswer] = useState<string | null>(null);

  function start() {
    if (!name.trim() || !Number(age) || Number(age) < 1) return;
    setMessages([]);
    setTurn(0);
    setScreen('chat');
  }

  async function send() {
    const content = input.trim();
    if (!content || loading || turn >= MAX_TURNS) return;
    const nextMessages = [...messages, { role: 'player' as const, content }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: book.id, player: { name, age: Number(age), gender }, messages: nextMessages, turn: turn + 1 }) });
      if (!response.ok) throw new Error('chat failed');
      const data = await response.json() as { response: string };
      const completedTurn = turn + 1;
      const allMessages = [...nextMessages, { role: 'character' as const, content: data.response }];
      setMessages(allMessages);
      setTurn(completedTurn);
      if (completedTurn === MAX_TURNS) await finish(allMessages);
    } catch {
      setMessages(nextMessages);
      setInput(content);
      alert('응답을 불러오지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }

  async function finish(log: Message[]) {
    const response = await fetch('/api/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: book.id, messages: log }) });
    if (!response.ok) throw new Error('evaluation failed');
    const result = await response.json() as { discovered: Discovery; success: boolean };
    setDiscovery(result.discovered);
    setSuccess(result.success);
    setScreen('result');
  }

  async function answerSurvey(answer: 'Y' | 'N') {
    setSurveyAnswer(answer);
    await fetch('/api/survey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer }) });
  }

  return <main className="app-shell">
    <header><span className="brand">뉴북 상담소</span><span className="tagline">새로운 이야기를 만나는 상담</span></header>
    {screen === 'start' && <section className="panel start-screen"><p className="eyebrow">NOVEL COUNSELING</p><h1>당신은 이 아이의<br /><em>마음을 알아챌 수 있을까요?</em></h1><p>사전 정보 없이 내담자와 대화하며, 감추는 것과 아픔 그리고 바라는 것을 찾아보세요.</p><div className="form-grid"><label>상담사 이름<input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름을 입력하세요" /></label><label>나이<input type="number" min="1" max="120" value={age} onChange={(e) => setAge(e.target.value)} placeholder="나이" /></label><label>성별<select value={gender} onChange={(e) => setGender(e.target.value as Gender)}><option>남성</option><option>여성</option><option>기타</option></select></label></div><button onClick={start} disabled={!name.trim() || !age}>상담 시작하기 →</button></section>}
    {screen === 'chat' && <section className="chat-screen"><div className="chat-heading"><div><p className="eyebrow">COUNSELING ROOM</p><h1>{book.character.name}의 상담실</h1><p>오늘의 상담 {turn} / {MAX_TURNS}</p></div><div className="progress"><span style={{ width: `${turn / MAX_TURNS * 100}%` }} /></div></div><div className="messages">{messages.length === 0 && <div className="welcome">한원열 학생이 조용히 앉아 있습니다.<br />무슨 말부터 건네볼까요?</div>}{messages.map((message, index) => <div key={index} className={`message ${message.role}`}><span className="message-label">{message.role === 'player' ? '상담사' : book.character.name}</span><p>{message.content}</p></div>)}</div><div className="composer"><textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} disabled={loading} placeholder={loading ? '내담자가 답변을 생각하고 있습니다…' : '내담자에게 말을 건네보세요'} /><button onClick={() => void send()} disabled={loading || !input.trim()}>보내기</button></div></section>}
    {screen === 'result' && <section className="panel result-screen"><p className="eyebrow">COUNSELING COMPLETE</p><h1>{success ? '마음에 닿았습니다.' : '아직 모든 이야기를 듣지는 못했어요.'}</h1><div className="result-content"><div className="cover"><div className="cover-title">봄도<br />여름도<br />아닌</div><small>Yua</small></div><div><p>{success ? '한원열의 마음을 깊이 들여다보았네요.' : '한원열이 등장하는 이 책에서 나머지 이야기를 만나보세요.'}</p><ul><li className={discovery.hiding ? 'found' : ''}>감추는 것 {discovery.hiding ? '✓' : '—'}</li><li className={discovery.pain ? 'found' : ''}>아픔 {discovery.pain ? '✓' : '—'}</li><li className={discovery.wish ? 'found' : ''}>바라는 것 {discovery.wish ? '✓' : '—'}</li></ul><p className="ending">{success ? '“바다? 바다 뭐. ... 그럼 그걸 보기 위해 공부한다고 생각해”' : '“저에 대해서 더 알아보셔야겠네요.”'}</p></div></div><button onClick={() => setScreen('survey')}>다음으로 →</button></section>}
    {screen === 'survey' && <section className="panel survey"><p className="library-mark">국립중앙도서관</p><h1>이 책이 국립중앙도서관에<br />들어오기를 바라시나요?</h1><p>당신의 응답은 새로운 작가와 이야기를 만나는 데 큰 힘이 됩니다.</p>{surveyAnswer ? <><h2>응답해 주셔서 감사합니다.</h2><button onClick={() => setScreen('start')}>처음으로</button></> : <div className="survey-buttons"><button onClick={() => void answerSurvey('Y')}>Y · 네</button><button onClick={() => void answerSurvey('N')}>N · 아니요</button></div>}</section>}
    <footer>새로운 작가의 이야기를 응원합니다</footer>
  </main>;
}
