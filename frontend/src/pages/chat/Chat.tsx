import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '../../components/button/Button';
import ActivityList from '../../components/activity/ActivityList';
import { API } from '../../services/api';

interface Message {
  senderId: string;
  senderName: string;
  content: string;
  type: 'user' | 'ai' | 'agent_status';
  timestamp: string;
  agent_name?: string;
  status?: string;
  step?: string;
}

interface AgentStatus {
  agent_name: string;
  status: 'starting' | 'running' | 'completed' | 'error';
  step: string;
  timestamp: string;
}

export function Chat() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentUser = JSON.parse(localStorage.getItem('user_info') || '{}');

  // Simple, safe markdown renderer for basic bold/italic using asterisks
  // - Escapes HTML to avoid XSS
  // - Supports **bold** and *italic* (non-greedy)
  const escapeHtml = (unsafe: string) =>
    unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const renderMessageContent = (text: string) => {
    if (!text) return '';
    // Escape first
    let out = escapeHtml(text);

    // Replace bold (**text**)
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Replace italic (*text*) but avoid interfering with bold already replaced
    out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Preserve line breaks
    out = out.replace(/\r?\n/g, '<br/>');

    return out;
  };

  useEffect(() => {
    if (!tripId) return;

    // Connect to WebSocket
    const wsUrl = `${API.chat.chat}/${tripId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[Chat] WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      // Handle agent status updates separately
      if (message.type === 'agent_status') {
        setAgentStatuses((prev) => {
          const existing = prev.findIndex((s) => s.agent_name === message.agent_name);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = message;
            return updated;
          }
          return [...prev, message];
        });
      } else {
        setMessages((prev) => [...prev, message]);
      }
    };

    ws.onerror = (error) => {
      console.error('[Chat] WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('[Chat] WebSocket disconnected');
      setIsConnected(false);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [tripId]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !wsRef.current || !isConnected) return;

    const messageData = {
      senderId: currentUser.id || 'unknown',
      senderName: currentUser.name || 'Anonymous',
      content: inputMessage,
      type: 'user',
      timestamp: new Date().toISOString(),
    };

    wsRef.current.send(JSON.stringify(messageData));
    setInputMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'starting':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'running':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'completed':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'error':
        return 'bg-red-100 border-red-300 text-red-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'starting':
        return '⏳';
      case 'running':
        return '🤖';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '📝';
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 bg-gray-50">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Group Trip Chat</h1>
            <p className="text-sm text-gray-600">
              {isConnected ? (
                <span className="text-green-600">● Connected</span>
              ) : (
                <span className="text-red-600">● Disconnected</span>
              )}
            </p>
          </div>
          <Button text="Back to Trip" onClick={() => navigate(`/trip/${tripId}`)} />
        </div>

        {/* Main Content - Split 50/50 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-180px)]">
          {/* Left Half - Chat */}
          <div className="flex flex-col bg-white rounded-xl shadow-sm">
            <div className="p-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Chat</h2>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-20">
                  <p className="text-lg">No messages yet</p>
                  <p className="text-sm mt-2">
                    Start the conversation! Type "leggo" to get AI suggestions.
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        msg.type === 'ai'
                          ? 'bg-blue-100 border border-blue-300 text-left'
                          : msg.senderId === currentUser.id
                            ? 'bg-indigo-600 text-white text-left'
                            : 'bg-gray-200 text-gray-900 text-left'
                      }`}
                    >
                      <p className="text-xs font-semibold mb-1 opacity-75">{msg.senderName}</p>
                      <div
                        className="text-sm whitespace-pre-wrap text-left"
                        dangerouslySetInnerHTML={{ __html: renderMessageContent(msg.content) }}
                      />
                      <p className="text-xs mt-1 opacity-60">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={2}
                  disabled={!isConnected}
                />
                <Button text="Send" onClick={handleSendMessage} />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Tip: Type "leggo" in your message to trigger AI travel suggestions
              </p>
            </div>
          </div>

          {/* Right Half - Activities (80%) + Agent Status (20%) */}
          <div className="flex flex-col gap-4">
            {/* Interactive Activities Area - 80% */}
            <div className="flex-[4] bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b">
                <h2 className="text-lg font-bold text-gray-900">Suggested Activities</h2>
                <p className="text-xs text-gray-600 mt-1">
                  Vote on activities to build your itinerary
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {tripId ? (
                  <ActivityList
                    tripId={tripId}
                    limit={20}
                    cardWidthPx={320}
                    cardHeightPx={240}
                    modalMaxWidth="600px"
                  />
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <p className="text-sm">No activities yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Agent Status Area - 20% */}
            <div className="flex-[1] bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b">
                <h2 className="text-sm font-bold text-gray-900">AI Agent Status</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {agentStatuses.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">
                    <p className="text-xs">No active agents</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {agentStatuses.map((agent, idx) => (
                      <div
                        key={idx}
                        className={`border-2 rounded-lg p-2 ${getStatusColor(agent.status)}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base">{getStatusIcon(agent.status)}</span>
                          <span className="font-semibold text-xs">{agent.agent_name}</span>
                        </div>
                        <p className="text-xs">{agent.step}</p>
                        {agent.status === 'running' && (
                          <div className="mt-1">
                            <div className="w-full bg-gray-200 rounded-full h-1">
                              <div className="bg-blue-600 h-1 rounded-full animate-pulse w-3/4"></div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
