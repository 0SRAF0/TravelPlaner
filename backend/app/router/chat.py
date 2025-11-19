from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
from datetime import datetime
from app.db.database import get_database

router = APIRouter(prefix="/chat", tags=["Chat"])

# Store active connections: chatId -> [websocket1, websocket2, ...]
active_connections: Dict[str, List[WebSocket]] = {}


async def broadcast_to_chat(chat_id: str, message_data: dict):
  """
  Broadcast a message to all connected clients in a specific chat.
  Can be called from other modules (e.g., orchestrator).
  """
  if chat_id in active_connections:
    msg_type = message_data.get('type', 'unknown')
    print(f"[broadcast] Broadcasting {msg_type} to {len(active_connections[chat_id])} clients in chat {chat_id}")
    for connection in active_connections[chat_id]:
      try:
        await connection.send_json(message_data)
      except Exception as e:
        print(f"[broadcast] Failed to send to connection: {e}")
  else:
    print(f"[broadcast] No active connections for chat {chat_id}, message not sent")


@router.websocket("/{chat_id}")
async def chat_websocket(websocket: WebSocket, chat_id: str):
  await websocket.accept()
  print(f"[chat_ws] New connection for chat_id={chat_id}")

  # Add to active connections
  if chat_id not in active_connections:
    active_connections[chat_id] = []
  active_connections[chat_id].append(websocket)
  print(f"[chat_ws] Active connections for {chat_id}: {len(active_connections[chat_id])}")

  try:
    while True:
      # Receive message from client
      data = await websocket.receive_json()

      # Get MongoDB collections
      db = get_database()
      messages_collection = db.messages

      # Save user message to MongoDB
      message_doc = {
        "chatId": chat_id,
        "senderId": data.get("senderId"),
        "senderName": data.get("senderName"),
        "content": data.get("content"),
        "type": "user",
        "createdAt": datetime.utcnow()
      }
      await messages_collection.insert_one(message_doc)
      print(f"[chat_ws] Message saved: {data.get('senderName')} in chat {chat_id}")

      # Broadcast user message to all clients in this chat
      for connection in active_connections[chat_id]:
        await connection.send_json(data)

  except WebSocketDisconnect:
    print(f"[chat_ws] Client disconnected from chat {chat_id}")
    # Remove from active connections
    active_connections[chat_id].remove(websocket)
    if not active_connections[chat_id]:
      del active_connections[chat_id]
      print(f"[chat_ws] No more connections for chat {chat_id}, cleaning up")
