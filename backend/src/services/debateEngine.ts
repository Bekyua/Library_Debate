import type { AiResponseRequest, AiResponse, JudgeRequest, JudgeResult } from '../types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-3.5-turbo';

function buildJudgePrompt(request: JudgeRequest) {
  const bookReference = request.book ? `도서: ${request.book}\n` : '';
  return `${bookReference}당신은 엄격하고 공정한 AI 토론 심판입니다. 아래 발언을 실제 내용 기준으로 평가하세요.
주의: 반드시 'user'로 표시된 발언만 평가 대상으로 삼아 점수를 산출하세요. 다른 발언은 참고용으로만 사용합니다.
논리 구조는 주장-이유-근거-결론이 연결되는지 평가합니다.
논리 일관성은 자기모순, 앞선 발언과의 충돌, 논점 이탈, 상대 주장에 대한 무응답을 감점합니다.
근거 정확성은 선택 도서의 내용을 정확하게 사용했는지 평가하며, 도서 내용이 로그에 없으면 확인되지 않은 인용을 사실로 간주하지 않습니다.
발언 수나 특정 키워드가 있다는 이유만으로 점수를 높이지 마세요. 반복 문장, 근거 없는 단정, 도서와 무관한 내용은 감점하세요.
반드시 다음 JSON 객체만 출력하세요: {"logicStructure": number, "consistency": number, "evidenceAccuracy": number, "summary": "한국어 평가 요약"}.
각 점수는 0부터 10 사이의 정수입니다.
(평가 대상 발언은 'user:'로 시작하는 항목만 고려됩니다.)
토론 로그:
${request.messages
    .map((message) => `${message.side}: ${message.content}`)
    .join('\n')}`;
}

function buildAiPrompt(request: AiResponseRequest) {
  const bookContext = request.book ? getBookContext(request.book) : '선택 도서 정보 없음';
  const stageInstruction = getStageInstruction(request.stage);
  const history = request.history.length > 0 ? request.history.join('\n') : '아직 발언 없음';
  return `당신은 ${request.position === 'pro' ? '찬성' : '반대'} 입장의 토론 AI입니다.
선택 도서: ${request.book ?? '없음'}
도서 핵심 맥락: ${bookContext}
현재 단계: ${stageInstruction}
반드시 현재 단계의 목적에 맞춰 새 발언을 작성하세요. 이전 발언을 그대로 반복하거나 "현재 논점을 재구성합니다" 같은 메타 문장으로 끝내지 마세요.
상대의 구체적인 주장 하나 이상을 인용 또는 요약하고, 선택 도서의 주제와 연결되는 새로운 이유나 반례를 제시하세요. 도서에 없는 세부 사실을 날조하지 말고, 확인할 수 없는 내용은 일반적인 주제 수준으로 표현하세요.
최근 대화:
${history}`;
}

function getStageInstruction(stage: AiResponseRequest['stage']): string {
  switch (stage) {
    case 'opening':
      return '입론. 자신의 입장을 분명히 밝히고, 도서의 핵심 주제와 연결된 주장-이유-근거를 제시하세요.';
    case 'cardSelection':
      return '카드 선택 타임. 카드 효과에 대한 짧은 대응과 다음 반박을 예고하세요. 새로운 주장을 길게 만들지 마세요.';
    case 'rebuttal':
      return '반박 및 재반론. 직전 상대 발언의 약점을 정확히 지적하고, 그 약점을 보완하는 반례 또는 도서 주제 기반의 재반론을 제시하세요.';
    case 'final':
      return '최종 발언. 지금까지 나온 핵심 쟁점을 정리하고 자신의 입장이 더 설득력 있는 이유를 새로운 반복 없이 결론으로 제시하세요.';
    default:
      return '현재 발언의 목적을 판단해 입론, 반박, 재반론 중 알맞은 형식으로 답하세요.';
  }
}

function getBookContext(book: string): string {
  const contexts: Record<string, string> = {
    '논리의 기술': '논증의 구조, 합리적 사고, 주장과 근거의 연결',
    '생각의 정리': '주장, 증거, 반론을 체계적으로 구성하는 방법',
    '말의 미래': '언어와 설득의 힘, 소통 방식의 변화와 토론 전략'
  };
  return contexts[book] ?? '도서 제목에서 확인되는 주제만 사용';
}

async function callOpenAI(payload: Record<string, unknown>) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY가 설정되어 있지 않습니다.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${text}`);
  }

  return response;
}

export async function streamAiResponse(request: AiResponseRequest, res: any): Promise<void> {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const prompt = buildAiPrompt(request);

  if (OPENAI_API_KEY) {
    try {
      const openAiResponse = await callOpenAI({
        model: OPENAI_MODEL,
        stream: true,
        messages: [
          { role: 'system', content: 'You are a debate assistant. Produce a distinct, stage-appropriate Korean debate speech grounded in the selected book context. Never repeat the previous response.' },
          { role: 'user', content: prompt }
        ]
      });

      if (!openAiResponse.body) {
        throw new Error('OpenAI response body is empty');
      }

      const reader = openAiResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) {
            continue;
          }

          const payload = trimmed.replace(/^data:\s*/, '');
          if (payload === '[DONE]') {
            break;
          }

          try {
            const json = JSON.parse(payload);
            const chunk = json.choices?.[0]?.delta?.content;
            if (chunk) {
              res.write(chunk);
            }
          } catch {
            // ignore lines that are not valid JSON yet
          }
        }
      }

      res.end();
      return;
    } catch (error) {
      res.write('OpenAI 스트리밍 응답을 생성하는 중 오류가 발생했습니다. 기본 답변을 제공합니다.');
    }
  }

  const fallback = buildFallbackAiResponse(request);
  for (const chunk of fallback.match(/.{1,25}/g) ?? []) {
    res.write(chunk);
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  function buildFallbackAiResponse(request: AiResponseRequest): string {
    const side = request.position === 'pro' ? '찬성' : '반대';
    const book = request.book ?? '선택 도서';
    const lastStatement = request.history[request.history.length - 1] ?? '상대의 첫 주장';
    const context = getBookContext(book);

    switch (request.stage) {
      case 'opening':
        return `${side} 측 입론입니다. ${book}의 핵심 주제인 ${context}를 기준으로 보면, 이 논제는 단순한 찬반보다 주장과 근거의 연결을 먼저 살펴봐야 합니다. 저는 이 관점이 현실의 판단에도 더 일관된 기준을 제공한다고 봅니다.`;
      case 'cardSelection':
        return `${side} 측은 방금 카드 선택을 확인했습니다. 카드 효과만으로 주장의 타당성이 바뀌지는 않으므로, 다음 발언에서는 ${context}와 연결해 핵심 근거를 다시 검토하겠습니다.`;
      case 'rebuttal':
        return `${side} 측 반박입니다. 상대의 최근 발언 "${lastStatement.slice(0, 80)}"은 결론을 제시했지만 그 결론을 뒷받침하는 조건이 충분히 설명되지 않았습니다. ${context}의 관점에서 보면 반례와 적용 범위를 함께 따져야 하므로, 그 주장만으로 전체 논제를 판단하기는 어렵습니다.`;
      case 'final':
        return `${side} 측 최종 발언입니다. 지금까지의 쟁점은 주장 자체보다 근거가 결론까지 일관되게 이어지는지에 있습니다. ${book}의 ${context}를 기준으로 검토하면, 제 입장은 핵심 쟁점에 답하면서도 과도한 일반화를 피한다는 점에서 더 설득력 있습니다.`;
      default:
        return `${side} 측은 ${book}의 ${context}를 바탕으로 상대의 주장을 검토하고, 근거와 결론이 연결되는지에 초점을 맞춰 답변합니다.`;
    }
  }
  res.end();
}

export async function generateAiResponse(request: AiResponseRequest): Promise<AiResponse> {
  if (OPENAI_API_KEY) {
    try {
      const prompt = buildAiPrompt(request);
      const response = await callOpenAI({
        model: OPENAI_MODEL,
        stream: false,
        messages: [
          { role: 'system', content: 'You are a debate assistant that answers from a specific point of view and references the selected book when possible.' },
          { role: 'user', content: prompt }
        ]
      });

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      return { response: text ?? `${request.position === 'pro' ? '찬성' : '반대'} AI가 질문에 응답했습니다.` };
    } catch (error) {
      return {
        response: `${request.position === 'pro' ? '찬성측' : '반대측'} AI 응답 생성에 실패했습니다. 기본 메시지를 출력합니다.`
      };
    }
  }

  return {
    response: `${request.position === 'pro' ? '찬성측' : '반대측'} AI가 현재 논점을 반박하며 답변을 구성합니다. 도서: ${request.book ?? '미선택'}`
  };
}

function parseJudgeScore(text: string): { logicStructure: number; consistency: number; evidenceAccuracy: number } {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        logicStructure: Math.max(0, Math.min(10, Number(parsed.logicStructure ?? parsed.logic_structure ?? 0))),
        consistency: Math.max(0, Math.min(10, Number(parsed.consistency ?? 0))),
        evidenceAccuracy: Math.max(0, Math.min(10, Number(parsed.evidenceAccuracy ?? parsed.evidence_accuracy ?? 0)))
      };
    } catch {
      // fall through to regex parsing
    }
  }

  const logicMatch = text.match(/logic(?:Structure|_structure)?\s*[:=]\s*(\d+)/i);
  const consistencyMatch = text.match(/consistency\s*[:=]\s*(\d+)/i);
  const evidenceMatch = text.match(/evidence(?:Accuracy|_accuracy)?\s*[:=]\s*(\d+)/i);

  return {
    logicStructure: logicMatch ? Math.max(0, Math.min(10, Number(logicMatch[1]))) : 6,
    consistency: consistencyMatch ? Math.max(0, Math.min(10, Number(consistencyMatch[1]))) : 6,
    evidenceAccuracy: evidenceMatch ? Math.max(0, Math.min(10, Number(evidenceMatch[1]))) : 5
  };
}

function fallbackJudge(request: JudgeRequest): JudgeResult {
  // User-centric judge: only consider messages labeled 'user' as the primary evaluation target.
  const userMessages = request.messages.filter((m) => m.side === 'user').map((m) => m.content.trim()).filter(Boolean);
  const analyzedMessages = userMessages.length > 0 ? userMessages : request.messages.map((item) => item.content.trim()).filter(Boolean);
  const recentLog = analyzedMessages.join(' ');

  const evidenceKeywords = ['예시', '사례', '통계', '연구', '자료', '근거', '증거', '인용'];
  const claimKeywords = ['주장', '이유', '근거', '따라서', '결론', '왜냐하면', '때문에'];
  const reasoningKeywords = ['하지만', '그러나', '반면', '따라서', '그러므로', '반례', '반박'];
  const bookTerms = request.book ? [request.book, ...getBookContext(request.book).split(', ')] : [];
  const countMatches = (keywords: string[], text: string) =>
    keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0);

  const structureHits = countMatches(claimKeywords, recentLog);
  const evidenceHits = countMatches(evidenceKeywords, recentLog);
  const reasoningHits = countMatches(reasoningKeywords, recentLog);
  const bookHits = countMatches(bookTerms, recentLog);
  const averageLength = analyzedMessages.length === 0 ? 0 : analyzedMessages.reduce((sum, item) => sum + item.length, 0) / analyzedMessages.length;
  const repeatedPairs = analyzedMessages.slice(1).filter((content, index) => {
    const previous = analyzedMessages[index];
    return content === previous || (content.length > 30 && previous.includes(content.slice(0, 30)));
  }).length;
  const contradictionHits = (recentLog.match(/모순|앞서.*반대|동시에.*아니|항상.*절대/g) ?? []).length;

  const logicStructure = clampScore(3 + structureHits + Math.min(2, reasoningHits) + (averageLength >= 80 ? 1 : 0));
  const consistency = clampScore(8 - repeatedPairs * 2 - contradictionHits * 2 + (reasoningHits > 0 ? 1 : 0));
  const evidenceAccuracy = clampScore(3 + evidenceHits + Math.min(2, bookHits) + (averageLength >= 100 ? 1 : 0));

  // Aggregate with weights: logic 40%, consistency 30%, evidence 30%
  const aggregateScore = Math.round((logicStructure * 0.4 + consistency * 0.3 + evidenceAccuracy * 0.3) * 10) / 10;
  const USER_WIN_THRESHOLD = 6.0;
  const winner = aggregateScore >= USER_WIN_THRESHOLD ? 'user' : 'ai';

  return {
    logicStructure,
    consistency,
    evidenceAccuracy,
    aggregateScore,
    winner,
    summary: `AI 심판 평가입니다. ${request.book ? `참조 도서: ${request.book}. ` : ''}${analyzedMessages.length}개의 평가 대상 발언(우선 'user' 발언)을 분석했습니다. 주장·이유 연결 ${structureHits}개, 근거 표현 ${evidenceHits}개, 반박 연결 ${reasoningHits}개, 반복 발언 ${repeatedPairs}개를 반영해 논리 구조 ${logicStructure}점, 일관성 ${consistency}점, 근거 정확성 ${evidenceAccuracy}점, 가중 평균 ${aggregateScore}점으로 평가했습니다. 임계값 ${USER_WIN_THRESHOLD} 이상이면 사용자 승리로 처리합니다. 현재 승자: ${winner}.`
  };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(10, Math.round(score)));
}

export async function judgeDebate(request: JudgeRequest): Promise<JudgeResult> {
  if (!OPENAI_API_KEY) {
    return fallbackJudge(request);
  }

  try {
    const prompt = buildJudgePrompt(request);
    const response = await callOpenAI({
      model: OPENAI_MODEL,
      stream: false,
      messages: [
        { role: 'system', content: 'You are an AI judge that evaluates debate transcripts for logic structure, consistency, and evidence accuracy.' },
        { role: 'user', content: prompt }
      ]
    });

    const data = await response.json();
    const assistant = data.choices?.[0]?.message?.content;
    if (!assistant) {
      return fallbackJudge(request);
    }

    const scores = parseJudgeScore(assistant);
    // Compute aggregate and winner deterministically using user-centric rule and fixed weights
    const aggregateScore = Math.round((scores.logicStructure * 0.4 + scores.consistency * 0.3 + scores.evidenceAccuracy * 0.3) * 10) / 10;
    const USER_WIN_THRESHOLD = 6.0;
    const winner = aggregateScore >= USER_WIN_THRESHOLD ? 'user' : 'ai';

    return {
      logicStructure: scores.logicStructure,
      consistency: scores.consistency,
      evidenceAccuracy: scores.evidenceAccuracy,
      aggregateScore,
      winner,
      summary: assistant
    };
  } catch (error) {
    return fallbackJudge(request);
  }
}
