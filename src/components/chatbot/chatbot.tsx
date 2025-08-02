'use client';
import { ChatMessage } from '@/lib/types/chatbot';
import { useDarkMode } from '@/providers/dark-mode-provider';
import React, { useEffect, useRef, useState } from 'react';
import { formatTimestamp } from '../utils/date-formatter';
import { fetchStreamingResponse } from '@/services/chatbot-service';

const Chatbot = () => {
  const { darkMode } = useDarkMode();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (inputMessage.trim()) {
      const newMessage: ChatMessage = {
        id: messages.length + 1,
        role: 'user',
        message: inputMessage,
        timestamp: new Date().toLocaleString(),
      };

      setMessages((prevMessages) => [...prevMessages, newMessage]);
      setInputMessage('');
      setLoading(true);

      const botMessage: ChatMessage = {
        id: messages.length + 2,
        role: 'bot',
        message: '',
        timestamp: new Date().toLocaleString(),
      };
      setMessages((prevMessages) => [...prevMessages, botMessage]);

      await fetchStreamingResponse(inputMessage, (chunk) => {
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === botMessage.id ? { ...msg, message: msg.message + chunk } : msg,
          ),
        );
      });

      setLoading(false);
    }
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const formatMessage = (message: string) => {
    message = message.replace(/\\n/g, '\n');

    const lines = message.split('\n').map((line) => {
      line = line.replace(
        /^# (.*?)(\n|:|$)/g,
        '<h5 style="margin: 0; padding: 0;" className="no-spacing">$1</h5>',
      );

      line = line.replace(
        /^## (.*?)(\n|:|$)/g,
        '<h6 style="margin: 0; padding: 0;" className="no-spacing">$1</h6>',
      );

      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      line = line.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');

      line = line.replace(/\[size=24\](.*?)\[\/size\]/g, '<span style="font-size:24px;">$1</span>');

      line = line.replace(/\[size=16\](.*?)\[\/size\]/g, '<span style="font-size:16px;">$1</span>');

      return line;
    });

    message = lines.join('<br>');

    return message;
  };

  return (
    <div
      className="h-full"
      style={{ maxHeight: '100vh', overflow: 'hidden' }}
    >
      <div
        className="offcanvas-body d-flex flex-column p-3 rounded"
        style={{ overflow: 'hidden', height: '85vh' }}
      >
        {/* Chat Messages */}
        <div
          className={`chat-messages d-flex flex-column flex-grow-1 overflow-auto mb-3 ${
            darkMode ? 'text-white' : 'text-dark'
          }`}
        >
          {messages.length === 0 ? (
            <p className="text-secondary align-items-center d-flex justify-content-center">
              No messages yet.
            </p>
          ) : (
            messages.map((message) => {
              const { date, time } = formatTimestamp(message.timestamp || new Date());
              return (
                <div
                  key={message.id}
                  className="d-flex flex-column"
                >
                  <div
                    key={message.id}
                    className={`message p-2 mb-2 rounded ${
                      message.role === 'bot'
                        ? darkMode
                          ? 'bg-secondary text-white align-self-start'
                          : 'bg-white text-dark align-self-start'
                        : 'bg-primary text-white align-self-end'
                    }`}
                    style={{
                      maxWidth: '80%',
                      fontSize: '0.875rem',
                    }}
                  >
                    {loading && message.role === 'bot' && message.message === '' ? (
                      <div className="d-flex align-items-center">
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        <span>Typing...</span>
                      </div>
                    ) : (
                      <div
                        dangerouslySetInnerHTML={{
                          __html: formatMessage(message.message),
                        }}
                      ></div>
                    )}
                  </div>
                  {message.timestamp && (
                    <div
                      className={`text-secondary text-xs ${
                        message.role === 'bot' ? 'text-start' : 'text-end'
                      } mb-1`}
                    >
                      {time}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef}></div>
        </div>

        {/* Input Field and Send Button */}
        <div className="input-group">
          <textarea
            ref={textareaRef}
            className="form-control"
            placeholder={loading ? 'Sending...' : 'Type a message...'}
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              adjustTextareaHeight();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={loading}
            rows={1}
            style={{
              resize: 'none',
              overflowY: 'hidden',
              maxHeight: '80px',
            }}
          ></textarea>
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleSendMessage}
            disabled={loading}
          >
            {loading ? (
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              ></span>
            ) : (
              <i className="fas fa-paper-plane"></i>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
