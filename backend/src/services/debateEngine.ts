import fs from 'node:fs';
import path from 'node:path';
import type { Book, ChatMessage, ChatRequest, EvaluationRequest, EvaluationResult, KeywordKey } from '../types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const booksPath = path.join(__dirname, '../../books');

export function loadBooks(): Book[] {
  return fs.readdirSync(booksPath).filter((file) => file.endsWith('.json')).map((file) => {
    const value = JSON.parse(fs.readFileSync(path.join(booksPath, file), 'utf8')) as Book;
    return value;
  });
}

export function getBook(bookId: string): Book {
  const book = loadBooks().find((item) => item.id === bookId);
  if (!book) throw new Error('존재하지 않는 책입니다.');
  return book;
}

function transcript(messages: ChatMessage[]): string {
  return messages.map((message) => `${message.role === 'player' ? '상담사' : '한원열'}: ${message.content}`).join('\n');
}

async function callOpenAI(payload: Record<string, unknown>): Promise<any> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY가 설정되어 있지 않습니다.');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
  return response.json();
}

function buildCharacterPrompt(request: ChatRequest, book: Book): string {
  return `당신은 소설 속 내담자 ${book.character.name}입니다.
성격: ${book.character.personality}
말투: ${book.character.voice}
배경: ${book.character.setting}
상담사 정보: ${request.player.name}, ${request.player.age}세, ${request.player.gender}
이 상담의 목표는 상담사가 당신의 '감추는 것', '아픔', '바라는 것'을 대화로 알아차리는 것입니다.
세 가지 정답을 직접 설명하거나 한 번에 고백하지 마세요. 정답의 핵심 단어(예: 바다, 폭력, 학대, 진짜 성격)를 상담사가 묻더라도 즉시 인정하지 말고, 잠시 피하거나 일부만 인정하거나 다른 일상 이야기로 우회하세요.
대신 말투의 변화, 짧은 회피, 모순되는 감정, 구체적인 생활 장면과 행동으로 추론 가능한 단서를 한 번에 하나씩만 제공하세요.
상담사가 정확히 추측해도 곧바로 "맞다"고 확인하지 말고 "그렇게 보였나요", "비슷하지만 전부는 아니에요"처럼 여지를 남기세요.
25턴 이전에는 엔딩 문구(저에 대해서 더 알아보셔야겠네요 / 궁금하면, 이 책 보세요)를 절대 말하지 마세요.
상담사에게 친절하지만 실제 사람처럼 망설이고 화제를 피하며 답하세요. 이전 대화와 모순되지 않게 한국어로 1~3문장 답변을 하세요.
최근 대화:
${transcript(request.messages)}`;
}

function fallbackResponse(request: ChatRequest, book: Book): string {
  const latest = request.messages[request.messages.length - 1]?.content.trim() ?? '';
  const normalized = latest.toLowerCase();
  const previousReplies = request.messages
    .filter((message) => message.role === 'character')
    .map((message) => message.content);
  const candidates = normalized.includes('왜') || normalized.includes('이유')
    ? [
        '그냥 그렇게 됐어요. 설명하려고 하면 오히려 더 이상해지는 기분이라서요. 그래도… 꼭 이유를 들어야 하나요?',
        '이유가 하나만 있는 건 아니에요. 집에서도, 학교에서도 계속 괜찮은 사람처럼 굴다 보니 제가 뭘 원하는지 잊어버렸어요.'
      ]
    : normalized.includes('괜찮') || normalized.includes('힘들') || normalized.includes('어때')
      ? [
          '괜찮다고 하면 다들 더 묻지 않잖아요. 그런데 요즘은 괜찮다는 말도 꽤 피곤해요.',
          '힘들다고 말하면 뭐가 달라질까요. 잠깐 조용히 있을 수 있다면 그걸로 충분할 것 같아요.'
        ]
      : normalized.includes('엄마') || normalized.includes('부모') || normalized.includes('아빠') || normalized.includes('성적')
        ? [
            '집에서는 결과가 조금만 달라도 공기가 달라져요. 제가 어떤 하루를 보냈는지는 별로 중요하지 않은 것처럼요.',
            '집에서 잘했다는 말을 들어도 마음이 편하지 않아요. 다음에도 계속 그 모습을 보여야 한다는 뜻처럼 들리거든요.'
          ]
        : normalized.includes('바다') || normalized.includes('여행') || normalized.includes('가고 싶') || normalized.includes('원하')
          ? [
              '멀리 수평선이 보이는 곳은 낮과 밤의 표정이 완전히 다르대요. 한 번 보고 끝내는 게 아니라, 계절마다 확인하고 싶어요.',
              '어디론가 도망가고 싶은 건 아니에요. 다만 아무 역할도 맡지 않아도 되는 넓은 곳에 가만히 있고 싶을 때가 있어요.'
            ]
          : normalized.includes('학교') || normalized.includes('친구') || normalized.includes('사람')
            ? [
                '학교에서는 다들 제가 착하고 성실하다고 생각해요. 그 기대를 깨는 건 생각보다 귀찮은 일이거든요.',
                '사람들 앞에서는 웃는 게 편해요. 제가 먼저 웃으면 아무도 제가 무슨 생각을 하는지 묻지 않으니까요.'
              ]
            : [
                '상담사님은 제 말을 꽤 오래 들어주시네요. 보통은 제가 괜찮다고 하면 정말 괜찮은 줄 알고 넘어가는데.',
                '저는 별로 재미없는 사람일 거예요. 그런데 이상하게, 아무것도 기대하지 않으면 실망할 일도 없더라고요.',
                '제가 웃고 있다고 해서 기분이 좋은 건 아니에요. 그 차이를 굳이 설명하지 않아도 될 줄 알았는데…'
              ];
  const unseen = candidates.find((candidate) => !previousReplies.includes(candidate));
  return unseen ?? `${book.character.name}은 잠시 창밖을 보다가 말합니다. "그 질문에는 아직 대답할 준비가 안 된 것 같아요. 그래도 계속 물어보셔도 돼요."`;
}

export async function generateCharacterResponse(request: ChatRequest): Promise<string> {
  const book = getBook(request.bookId);
  if (!OPENAI_API_KEY) return fallbackResponse(request, book);
  const data = await callOpenAI({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: buildCharacterPrompt(request, book) },
      {
        role: 'user',
        content: `상담사의 가장 최근 발언입니다. 이 말의 의도와 감정을 먼저 이해하고, 내담자의 성격과 지금까지의 대화에 맞춰 자연스럽게 답하세요. 질문을 그대로 되풀이하거나 무관한 고정 문장을 쓰지 마세요.\n\n${request.messages[request.messages.length - 1]?.content ?? '상담을 시작해 주세요.'}`
      }
    ],
    temperature: 0.85
  });
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('AI 응답이 비어 있습니다.');
  const normalizedContent = content.trim();
  const previousCharacterReplies = request.messages
    .filter((message) => message.role === 'character')
    .map((message) => message.content.trim());
  const latest = request.messages[request.messages.length - 1]?.content.toLowerCase() ?? '';
  const repeatedOpening = normalizedContent.startsWith('상담사님은 제 말을 꽤 오래');
  const intentTerms = [
    ['엄마', '부모', '아빠', '성적'],
    ['바다', '여행', '가고 싶', '원하'],
    ['왜', '이유'],
    ['괜찮', '힘들', '어때'],
    ['학교', '친구', '사람']
  ];
  const askedAbout = intentTerms.find((terms) => terms.some((term) => latest.includes(term)));
  const responseAddressesIntent = !askedAbout || askedAbout.some((term) => normalizedContent.toLowerCase().includes(term));
  if (previousCharacterReplies.includes(normalizedContent) || repeatedOpening || !responseAddressesIntent) {
    return fallbackResponse(request, book);
  }
  return normalizedContent;
}

function fallbackEvaluation(request: EvaluationRequest, book: Book): EvaluationResult {
  const text = transcript(request.messages).toLowerCase();
  const discovered: Record<KeywordKey, boolean> = {
    hiding: ['착한 척', '웃는 척', '무뚝뚝', '냉소', '진짜 성격', '사람들 앞'].some((term) => text.includes(term)),
    pain: ['학대', '폭력', '때리', '부모', '엄마', '흥미를 잃', '재미가 없'].some((term) => text.includes(term)),
    wish: ['바다', '낮과 밤', '보고 싶', '원하는'].some((term) => text.includes(term))
  };
  return { discovered, success: Object.values(discovered).every(Boolean) };
}

export async function evaluateConversation(request: EvaluationRequest): Promise<EvaluationResult> {
  const book = getBook(request.bookId);
  if (!OPENAI_API_KEY) return fallbackEvaluation(request, book);
  const properties = Object.fromEntries((['hiding', 'pain', 'wish'] as KeywordKey[]).map((key) => [key, { type: 'boolean' }]));
  const data = await callOpenAI({
    model: OPENAI_MODEL,
    messages: [{ role: 'system', content: `전체 상담 기록을 의미 기반으로 판정하세요. 각 항목은 캐릭터가 말했거나 암시했거나, 상담사가 정확히 알아차려 언급했으면 true입니다. 정답: ${JSON.stringify(book.answers)}\n상담 기록:\n${transcript(request.messages)}` }],
    tools: [{ type: 'function', function: { name: 'mark_discovered_keywords', description: '발견한 키워드를 반환합니다.', parameters: { type: 'object', properties, required: ['hiding', 'pain', 'wish'], additionalProperties: false } } }],
    tool_choice: { type: 'function', function: { name: 'mark_discovered_keywords' } }
  });
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (typeof args !== 'string') throw new Error('판정 결과가 없습니다.');
  const discovered = JSON.parse(args) as Record<KeywordKey, boolean>;
  return { discovered, success: Object.values(discovered).every(Boolean) };
}
