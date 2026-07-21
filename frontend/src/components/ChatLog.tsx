import type { ChatMessage } from '../types';

interface ChatLogProps {
  messages: ChatMessage[];
}

export function ChatLog({ messages }: ChatLogProps) {
  return (
    <div className="section">
      <h2>토론 로그</h2>
      <div className="chat-log">
        {messages.map((message) => (
          <div key={message.id} className={`chat-bubble ${message.side}`}>
            <strong>{message.side === 'pro' ? '찬성' : message.side === 'con' ? '반대' : '사용자'}</strong>
            <p>{message.content}</p>
            <small>{new Date(message.timestamp).toLocaleTimeString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
