import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInterface } from '@/components/ChatInterface';
import { DocumentType, getDefaultFormData } from '@/types/documents';
import { ChatResponse } from '@/types/chat';
import * as chatApi from '@/services/chatApi';

jest.mock('@/services/chatApi');

describe('ChatInterface Component', () => {
  const mockGetGreeting = chatApi.getGreeting as jest.MockedFunction<typeof chatApi.getGreeting>;
  const mockSendMessage = chatApi.sendMessage as jest.MockedFunction<typeof chatApi.sendMessage>;

  const defaultProps = {
    formData: getDefaultFormData(DocumentType.MUTUAL_NDA),
    onDocumentTypeDetected: jest.fn(),
    onFieldsExtracted: jest.fn(),
    onComplete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default greeting mock
    mockGetGreeting.mockResolvedValue({
      response: "Hello! I'll help you create a legal agreement.",
      isComplete: false,
    });
  });

  it('fetches and renders initial greeting message on mount', async () => {
    render(<ChatInterface {...defaultProps} />);

    expect(mockGetGreeting).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByText("Hello! I'll help you create a legal agreement.")).toBeInTheDocument();
    });
  });

  it('handles greeting error gracefully', async () => {
    mockGetGreeting.mockRejectedValue(new Error('Network error'));
    render(<ChatInterface {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('allows user to send a message and updates conversation', async () => {
    const user = userEvent.setup();
    mockSendMessage.mockResolvedValue({
      response: 'Great! Who is the first party?',
      documentType: 'mutual_nda',
      purpose: 'Partnership discussion',
      isComplete: false,
    });

    render(<ChatInterface {...defaultProps} />);

    // Wait for greeting
    await waitFor(() => {
      expect(screen.getByText("Hello! I'll help you create a legal agreement.")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'I need an NDA for partnership discussion');
    await user.click(sendButton);

    // Check user message is displayed
    expect(screen.getByText('I need an NDA for partnership discussion')).toBeInTheDocument();

    // Check sendMessage was called with conversation history
    expect(mockSendMessage).toHaveBeenCalledWith([
      { role: 'assistant', content: "Hello! I'll help you create a legal agreement." },
      { role: 'user', content: 'I need an NDA for partnership discussion' },
    ]);

    // Check AI response rendered
    await waitFor(() => {
      expect(screen.getByText('Great! Who is the first party?')).toBeInTheDocument();
    });

    // Check callbacks were triggered
    expect(defaultProps.onDocumentTypeDetected).toHaveBeenCalledWith(DocumentType.MUTUAL_NDA);
    expect(defaultProps.onFieldsExtracted).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'Partnership discussion' })
    );
    expect(defaultProps.onComplete).not.toHaveBeenCalled();
  });

  it('triggers onComplete when response.isComplete is true', async () => {
    const user = userEvent.setup();
    mockSendMessage.mockResolvedValue({
      response: 'All required fields have been gathered! Your Mutual NDA is ready.',
      documentType: 'mutual_nda',
      isComplete: true,
    });

    render(<ChatInterface {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Hello! I'll help you create a legal agreement.")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Everything looks good');
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('All required fields have been gathered! Your Mutual NDA is ready.')).toBeInTheDocument();
    });

    expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
  });

  it('displays error message when sending message fails', async () => {
    const user = userEvent.setup();
    mockSendMessage.mockRejectedValue(new Error('Failed to reach AI service'));

    render(<ChatInterface {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Hello! I'll help you create a legal agreement.")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Hello');
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to reach AI service')).toBeInTheDocument();
    });
  });

  it('disables input and send button while loading', async () => {
    let resolvePromise: (val: ChatResponse) => void;
    const pendingPromise = new Promise<ChatResponse>((resolve) => {
      resolvePromise = resolve;
    });
    mockSendMessage.mockReturnValue(pendingPromise);

    const user = userEvent.setup();
    render(<ChatInterface {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Hello! I'll help you create a legal agreement.")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Testing loading');
    await user.click(sendButton);

    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();

    // Resolve promise
    resolvePromise!({
      response: 'Finished loading',
      isComplete: false,
    });

    await waitFor(() => {
      expect(input).not.toBeDisabled();
    });
  });
});

