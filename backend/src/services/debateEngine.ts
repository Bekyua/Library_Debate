import type { AiResponseRequest, AiResponse, JudgeRequest, JudgeResult } from '../types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-3.5-turbo';

function buildJudgePrompt(request: JudgeRequest) {
  const bookReference = request.book ? `도서: ${request.book}\n` : '';
  return `${bookReference}당신은 AI 토론 심판입니다. 아래 토론 발언 로그를 바탕으로 논리 구조, 논리 일관성, 근거 정확성 세 가지 항목을 0부터 10까지 점수화하세요. 가능한 한 명확하고 일관된 JSON 형식으로 결과를 출력하세요.\n토론 로그:\n${request.messages
    .map((message) => `${message.side}: ${message.content}`)
    .join('\n')}`;
}

function buildAiPrompt(request: AiResponseRequest) {
  const bookReference = request.book ? `도서 참조: ${request.book}\n` : '';
  return `${bookReference}당신은 ${request.position === 'pro' ? '찬성' : '반대'} 입장의 토론 AI입니다. 아래 최근 발언을 보면서 상대의 논지를 반박하거나 재반박하십시오. 응답은 논리 구조, 설득력, 도서 근거 연계를 고려해야 합니다.\n최근 대화:\n${request.history.join('\n')}`;
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
          { role: 'system', content: 'You are a debate assistant with a clear debating persona and quick, reasoned rebuttals.' },
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

  const fallback = `${request.position === 'pro' ? '찬성측' : '반대측'} AI가 선택된 도서 기준으로 현재 논점을 재구성하고 상대의 주장에 대해 반박합니다. 도서 참조: ${request.book ?? '없음'}`;
  for (const chunk of fallback.match(/.{1,25}/g) ?? []) {
    res.write(chunk);
    await new Promise((resolve) => setTimeout(resolve, 120));
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
  const recentLog = request.messages.map((item) => item.content).join(' ');
  const evidenceKeywords = ['예시', '사례', '통계', '연구', '자료', '근거', '증거'];
  const claimKeywords = ['주장', '이유', '근거', '따라서', '결론'];
  const contradictionKeywords = ['하지만', '그러나', '반면', '그러므로'];

  const evidenceCount = evidenceKeywords.reduce((count, keyword) => count + (recentLog.includes(keyword) ? 1 : 0), 0);
  const claimCount = claimKeywords.reduce((count, keyword) => count + (recentLog.includes(keyword) ? 1 : 0), 0);
  const contradictionCount = contradictionKeywords.reduce((count, keyword) => count + (recentLog.includes(keyword) ? 1 : 0), 0);

  const logicStructure = Math.min(10, 4 + Math.floor(claimCount / 2) + Math.floor(request.messages.length / 3));
  const consistency = Math.min(10, 6 + Math.max(0, 2 - contradictionCount));
  const evidenceAccuracy = Math.min(10, 3 + evidenceCount);

  return {
    logicStructure,
    consistency,
    evidenceAccuracy,
    summary: `AI 심판 기본 평가입니다. ${request.book ? `참조 도서: ${request.book}. ` : ''}총 ${request.messages.length}개의 발언을 분석했으며, 논리 구조는 ${logicStructure}점, 일관성은 ${consistency}점, 근거 정확성은 ${evidenceAccuracy}점으로 평가됩니다.`
  };
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
    return {
      logicStructure: scores.logicStructure,
      consistency: scores.consistency,
      evidenceAccuracy: scores.evidenceAccuracy,
      summary: assistant
    };
  } catch (error) {
    return fallbackJudge(request);
  }
}
