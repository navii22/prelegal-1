import { getGreeting, sendMessage } from '@/services/chatApi';
import { ChatMessage, ChatResponse } from '@/types/chat';

describe('chatApi', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getGreeting', () => {
    it('fetches greeting successfully', async () => {
      const mockGreetingResponse: ChatResponse = {
        response: "Hello! I'll help you create a legal agreement.",
        isComplete: false,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockGreetingResponse),
      } as unknown as Response);

      const result = await getGreeting();

      expect(global.fetch).toHaveBeenCalledWith('/api/chat/greeting');
      expect(result).toEqual(mockGreetingResponse);
    });

    it('throws error when greeting request fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
      } as unknown as Response);

      await expect(getGreeting()).rejects.toThrow('Failed to get greeting: Internal Server Error');
    });
  });

  describe('sendMessage', () => {
    it('sends messages and receives response', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'I need a Mutual NDA' },
      ];
      const mockResponse: ChatResponse = {
        response: 'Sure, what are the names of the two parties?',
        documentType: 'mutual_nda',
        isComplete: false,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      } as unknown as Response);

      const result = await sendMessage(messages);

      expect(global.fetch).toHaveBeenCalledWith('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });
      expect(result).toEqual(mockResponse);
    });

    it('throws error when message request fails with detail', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({ detail: 'Messages cannot be empty' }),
      } as unknown as Response);

      await expect(sendMessage([])).rejects.toThrow('Messages cannot be empty');
    });
  });
});
