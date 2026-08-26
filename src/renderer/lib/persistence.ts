import { ChatMessageData } from '../../shared/types'

/**
 * Returns the current conversation id, creating one on the fly via IPC
 * if none exists yet. Falls back to null (no persistence) when
 * window.jarvisAPI isn't available, e.g. running the renderer standalone
 * in a browser during development.
 */
export async function ensureConversationId(
  currentId: string | null,
  setCurrentConversationId: (id: string) => void
): Promise<string | null> {
  if (currentId) return currentId;
  if (!window.jarvisAPI?.createConversation) return null;

  const id = `conv-${Date.now()}`;
  try {
    await window.jarvisAPI.createConversation(id);
    setCurrentConversationId(id);
    return id;
  } catch (err) {
    console.error('[Persistence] Failed to create conversation:', err);
    return null;
  }
}

export async function persistMessage(
  conversationId: string | null,
  msg: Pick<ChatMessageData, 'id' | 'role' | 'content' | 'timestamp'>
): Promise<void> {
  if (!conversationId || !window.jarvisAPI?.saveMessage) return;
  try {
    await window.jarvisAPI.saveMessage({
      id: msg.id,
      conversation_id: conversationId,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    });
  } catch (err) {
    console.error('[Persistence] Failed to save message:', err);
  }
}
