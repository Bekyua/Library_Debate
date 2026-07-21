import express from 'express';
import cors from 'cors';
import { generateAiResponse, streamAiResponse, judgeDebate } from './services/debateEngine';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/ai/response', async (req, res) => {
  try {
    const response = await generateAiResponse(req.body);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'AI 응답 생성 중 오류가 발생했습니다.' });
  }
});

app.post('/api/ai/stream-response', async (req, res) => {
  try {
    await streamAiResponse(req.body, res);
  } catch (error) {
    res.status(500).json({ error: 'AI 스트리밍 응답 중 오류가 발생했습니다.' });
  }
});

app.post('/api/judge', async (req, res) => {
  try {
    const result = await judgeDebate(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '심판 평가 생성 중 오류가 발생했습니다.' });
  }
});

const port = 4174;
app.listen(port, () => {
  console.log(`Debate backend listening on http://localhost:${port}`);
});
