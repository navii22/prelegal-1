"""Tests for the AI chat endpoint and AI service for Mutual NDA and document creation."""

import json
from unittest.mock import MagicMock, patch
import pytest

from models.chat import ChatRequest, ChatResponse, Message, PartyInfoExtraction
from services.ai_service import get_greeting, process_message, MODEL, EXTRA_BODY


class TestChatEndpoints:
    def test_greeting_endpoint(self, client):
        """Test GET /api/chat/greeting returns the initial AI greeting."""
        res = client.get("/api/chat/greeting")
        assert res.status_code == 200
        data = res.json()
        assert "response" in data
        assert "NDA" in data["response"] or "legal agreement" in data["response"]
        assert data["isComplete"] is False

    def test_message_endpoint_empty_messages(self, client):
        """Test POST /api/chat/message with empty messages returns 400."""
        res = client.post("/api/chat/message", json={"messages": []})
        assert res.status_code == 400
        assert "Messages cannot be empty" in res.json()["detail"]

    @patch("routes.chat.process_message")
    def test_message_endpoint_success(self, mock_process, client):
        """Test POST /api/chat/message returns structured AI response."""
        mock_response = ChatResponse(
            response="I understand you need a Mutual NDA. Who are the parties involved?",
            documentType="mutual_nda",
            purpose="Evaluating a potential business partnership",
            isComplete=False,
        )
        mock_process.return_value = mock_response

        payload = {
            "messages": [
                {"role": "user", "content": "I need a mutual NDA for evaluating a business partnership."}
            ]
        }
        res = client.post("/api/chat/message", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["response"] == mock_response.response
        assert data["documentType"] == "mutual_nda"
        assert data["purpose"] == "Evaluating a potential business partnership"
        assert data["isComplete"] is False
        mock_process.assert_called_once()

    @patch("routes.chat.process_message")
    def test_message_endpoint_error_handling(self, mock_process, client):
        """Test POST /api/chat/message returns 500 when AI service raises exception."""
        mock_process.side_effect = RuntimeError("OpenRouter service unavailable")

        payload = {
            "messages": [
                {"role": "user", "content": "Hello"}
            ]
        }
        res = client.post("/api/chat/message", json=payload)
        assert res.status_code == 500
        assert "AI service error: OpenRouter service unavailable" in res.json()["detail"]


class TestAIService:
    def test_get_greeting(self):
        """Test get_greeting returns expected ChatResponse structure."""
        greeting = get_greeting()
        assert isinstance(greeting, ChatResponse)
        assert len(greeting.response) > 0
        assert greeting.isComplete is False

    @patch("services.ai_service.completion")
    def test_process_message_calls_litellm_with_correct_cerebras_parameters(self, mock_completion):
        """Test process_message invokes LiteLLM with Cerebras provider, gpt-oss-120b model, and structured format."""
        ai_response_obj = ChatResponse(
            response="I've recorded that you need a Mutual NDA with Acme Corp and Beta Inc.",
            documentType="mutual_nda",
            purpose="Exploring strategic investment",
            effectiveDate="2026-09-01",
            mndaTermType="expires",
            mndaTermYears=2,
            confidentialityTermType="years",
            confidentialityTermYears=3,
            governingLaw="Delaware",
            jurisdiction="New Castle County, Delaware",
            party1=PartyInfoExtraction(
                name="Alice Smith",
                title="CEO",
                company="Acme Corp",
                noticeAddress="alice@acme.com",
                date="2026-09-01",
            ),
            party2=PartyInfoExtraction(
                name="Bob Jones",
                title="CTO",
                company="Beta Inc",
                noticeAddress="bob@beta.com",
                date="2026-09-01",
            ),
            isComplete=True,
        )

        mock_choice = MagicMock()
        mock_choice.message.content = ai_response_obj.model_dump_json()
        mock_completion.return_value = MagicMock(choices=[mock_choice])

        messages = [
            Message(role="user", content="Create an NDA between Acme Corp (Alice Smith, CEO, alice@acme.com) and Beta Inc (Bob Jones, CTO, bob@beta.com) for exploring strategic investment, effective 2026-09-01 in Delaware.")
        ]

        result = process_message(messages)

        # Verify litellm completion arguments
        mock_completion.assert_called_once()
        _, kwargs = mock_completion.call_args

        assert kwargs["model"] == MODEL
        assert kwargs["model"] == "openrouter/openai/gpt-oss-120b"
        assert kwargs["extra_body"] == EXTRA_BODY
        assert kwargs["extra_body"] == {"provider": {"order": ["cerebras"]}}
        assert kwargs["response_format"] == ChatResponse
        assert kwargs["reasoning_effort"] == "low"

        # Verify messages structure: system prompt + user message
        passed_messages = kwargs["messages"]
        assert len(passed_messages) == 2
        assert passed_messages[0]["role"] == "system"
        assert "Mutual NDA" in passed_messages[0]["content"]
        assert passed_messages[1]["role"] == "user"
        assert passed_messages[1]["content"] == messages[0].content

        # Verify parsed ChatResponse
        assert result.response == ai_response_obj.response
        assert result.documentType == "mutual_nda"
        assert result.purpose == "Exploring strategic investment"
        assert result.effectiveDate == "2026-09-01"
        assert result.mndaTermType == "expires"
        assert result.mndaTermYears == 2
        assert result.confidentialityTermType == "years"
        assert result.confidentialityTermYears == 3
        assert result.governingLaw == "Delaware"
        assert result.jurisdiction == "New Castle County, Delaware"
        assert result.party1.company == "Acme Corp"
        assert result.party1.name == "Alice Smith"
        assert result.party2.company == "Beta Inc"
        assert result.isComplete is True

    @patch("services.ai_service.completion")
    def test_process_message_empty_response_raises(self, mock_completion):
        """Test process_message raises ValueError when LLM response is empty."""
        mock_completion.return_value = MagicMock(choices=[])
        with pytest.raises(ValueError, match="Invalid response from AI service"):
            process_message([Message(role="user", content="Hello")])
