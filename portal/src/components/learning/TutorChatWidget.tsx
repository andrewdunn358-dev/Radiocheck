'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import { lmsApi } from '@/lib/api';
import { useLearnerAuth } from '@/hooks/useLearnerAuth';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MR_CLARK_AVATAR = 'https://static.prod-images.emergentagent.com/jobs/535ca64e-70e1-4fc8-813d-3b487fc07905/images/a9bacd4dc492874cedeb536e97e322012136c6e4d632ddf2b353b4dad5037acb.png';

export default function TutorChatWidget({ currentModule }: { currentModule?: string }) {
  const { learner } = useLearnerAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  const handleSend = async () => {
    if (!message.trim() || !learner || isLoading) return;

    const userMessage = message.trim();
    setMessage('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await lmsApi.chatWithTutor(learner.email, userMessage, currentModule);
      setChatHistory(prev => [...prev, { role: 'assistant', content: response.response }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm sorry, I'm having trouble responding right now. Please try again in a moment." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!learner) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50" data-testid="tutor-chat-widget">
      {/* Chat Window */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-96 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="bg-primary border-b border-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src={MR_CLARK_AVATAR} 
                alt="Mr Clark" 
                className="w-10 h-10 rounded-full border-2 border-secondary"
              />
              <div>
                <div className="font-semibold text-white">Mr Clark</div>
                <div className="text-xs text-gray-400">Course Tutor</div>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors"
              data-testid="close-tutor-chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="h-80 overflow-y-auto p-4 space-y-4 bg-primary-dark/50">
            {/* Welcome Message */}
            {chatHistory.length === 0 && (
              <div className="flex gap-3">
                <img 
                  src={MR_CLARK_AVATAR} 
                  alt="Mr Clark" 
                  className="w-8 h-8 rounded-full flex-shrink-0"
                />
                <div className="bg-card rounded-lg rounded-tl-none p-3 max-w-[80%]">
                  <p className="text-sm">Hello! I'm Mr Clark, your course tutor. I'm here to help you understand the material and develop your peer support skills.</p>
                  <p className="text-xs text-gray-400 mt-2 italic">Note: I can guide you through concepts, but I won't give you direct answers to quiz questions - that's for you to work out!</p>
                </div>
              </div>
            )}

            {/* Chat Messages */}
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <img 
                    src={MR_CLARK_AVATAR} 
                    alt="Mr Clark" 
                    className="w-8 h-8 rounded-full flex-shrink-0"
                  />
                )}
                <div className={`rounded-lg p-3 max-w-[80%] ${
                  msg.role === 'user' 
                    ? 'bg-secondary/20 text-white rounded-tr-none' 
                    : 'bg-card rounded-tl-none'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex gap-3">
                <img 
                  src={MR_CLARK_AVATAR} 
                  alt="Mr Clark" 
                  className="w-8 h-8 rounded-full flex-shrink-0"
                />
                <div className="bg-card rounded-lg rounded-tl-none p-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border bg-card" role="form" aria-label="Chat input">
            <div className="flex gap-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Mr Clark a question..."
                rows={1}
                className="flex-1 px-4 py-2 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none resize-none text-sm"
                data-testid="tutor-chat-input"
                aria-label="Type your question"
                aria-describedby="tutor-chat-hint"
              />
              <span id="tutor-chat-hint" className="sr-only">Press Enter to send, Shift+Enter for new line</span>
              <button
                onClick={handleSend}
                disabled={isLoading || !message.trim()}
                className="px-4 py-2 bg-secondary text-primary-dark rounded-lg disabled:opacity-50 hover:bg-secondary-light transition-colors"
                data-testid="tutor-chat-send"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 px-4 py-3 rounded-full shadow-lg transition-all duration-200 ${
          isOpen 
            ? 'bg-primary-dark border border-border' 
            : 'bg-secondary hover:bg-secondary-light'
        }`}
        data-testid="tutor-chat-toggle"
      >
        <img 
          src={MR_CLARK_AVATAR} 
          alt="Mr Clark" 
          className="w-10 h-10 rounded-full border-2 border-white/20"
        />
        <span className={`font-semibold ${isOpen ? 'text-secondary' : 'text-primary-dark'}`}>
          Ask Mr Clark
        </span>
        {!isOpen && (
          <MessageSquare className="w-5 h-5 text-primary-dark" />
        )}
      </button>
    </div>
  );
}
