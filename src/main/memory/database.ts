import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'

export interface DBConversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

export interface DBMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export class DatabaseManager {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'jarvis_memory.db');
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
      );
    `);
  }

  createConversation(id: string, title: string = 'New Conversation'): DBConversation {
    const now = Date.now();
    const stmt = this.db.prepare(
      'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
    );
    stmt.run(id, title, now, now);
    return { id, title, created_at: now, updated_at: now };
  }

  getConversations(): DBConversation[] {
    const stmt = this.db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC');
    return stmt.all() as DBConversation[];
  }

  getMessages(conversationId: string): DBMessage[] {
    const stmt = this.db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC'
    );
    return stmt.all(conversationId) as DBMessage[];
  }

  addMessage(msg: DBMessage): DBMessage {
    const stmt = this.db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(msg.id, msg.conversation_id, msg.role, msg.content, msg.timestamp);

    // Update parent conversation timestamp
    const updateStmt = this.db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?');
    updateStmt.run(msg.timestamp, msg.conversation_id);

    return msg;
  }

  deleteConversation(id: string): void {
    const stmt = this.db.prepare('DELETE FROM conversations WHERE id = ?');
    stmt.run(id);
  }
}