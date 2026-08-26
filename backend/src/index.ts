import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { evaluateConversation, generateCharacterResponse, loadBooks } from './services/debateEngine';
import type { ChatRequest, EvaluationRequest } from './types';

const app = express();
const surveyPath = path.join(__dirname, '../data/survey.json');
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/books', (_req, res) => res.json(loadBooks().map(({ answers: _answers, character, excerpt: _excerpt, ...book }) => ({
  ...book,
  character: { name: character.name, age: character.age, gender: character.gender }
}))));

app.post('/api/chat', async (req, res) => {
  try {
    const request = req.body as ChatRequest;
    if (!request.bookId || !request.player || !Array.isArray(request.messages) || request.turn < 1) {
      res.status(400).json({ error: '상담 요청 형식이 올바르지 않습니다.' });
      return;
    }
    const response = await generateCharacterResponse(request);
    res.json({ response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '내담자 응답을 생성하지 못했습니다.' });
  }
});

app.post('/api/evaluate', async (req, res) => {
  try {
    const request = req.body as EvaluationRequest;
    if (!request.bookId || !Array.isArray(request.messages)) {
      res.status(400).json({ error: '판정 요청 형식이 올바르지 않습니다.' });
      return;
    }
    res.json(await evaluateConversation(request));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '상담 판정에 실패했습니다.' });
  }
});

app.post('/api/survey', (req, res) => {
  const answer = req.body?.answer;
  if (answer !== 'Y' && answer !== 'N') {
    res.status(400).json({ error: 'Y 또는 N으로 응답해 주세요.' });
    return;
  }
  fs.mkdirSync(path.dirname(surveyPath), { recursive: true });
  const counts: { Y: number; N: number } = fs.existsSync(surveyPath)
    ? JSON.parse(fs.readFileSync(surveyPath, 'utf8')) as { Y: number; N: number }
    : { Y: 0, N: 0 };
  if (answer === 'Y') counts.Y += 1;
  else counts.N += 1;
  fs.writeFileSync(surveyPath, JSON.stringify(counts, null, 2));
  res.json({ counts });
});

const port = Number(process.env.PORT ?? 4174);
app.listen(port, () => console.log(`Newbook Counseling backend listening on http://localhost:${port}`));
