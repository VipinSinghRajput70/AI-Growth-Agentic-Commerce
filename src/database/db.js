/**
 * OmniAgent Commerce — SQLite Database Initialization (sql.js)
 * Uses sql.js (pure JavaScript SQLite via WebAssembly) with a
 * better-sqlite3-compatible wrapper API so all services work unchanged.
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'omniagent.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Ensure the data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;
let SQL = null;

/**
 * Wrapper that mimics the better-sqlite3 API around sql.js
 */
class SqlJsWrapper {
  constructor(rawDb) {
    this._db = rawDb;
  }

  /**
   * Execute raw SQL (multiple statements)
   */
  exec(sql) {
    this._db.run(sql);
  }

  /**
   * Set a pragma
   */
  pragma(pragmaStr) {
    try {
      this._db.run(`PRAGMA ${pragmaStr}`);
    } catch (e) {
      // Some pragmas may not be supported in sql.js — ignore
    }
  }

  /**
   * Prepare a statement and return an object with .get(), .all(), .run()
   * matching better-sqlite3's synchronous API.
   */
  prepare(sql) {
    const self = this;
    return {
      /**
       * Get a single row as an object
       */
      get(...params) {
        try {
          const stmt = self._db.prepare(sql);
          const flatParams = flattenParams(params);
          if (flatParams.length > 0) {
            stmt.bind(flatParams);
          }
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        } catch (e) {
          console.error('[DB] get() error:', e.message, '| SQL:', sql.slice(0, 80));
          return undefined;
        }
      },

      /**
       * Get all matching rows as an array of objects
       */
      all(...params) {
        try {
          const results = [];
          const stmt = self._db.prepare(sql);
          const flatParams = flattenParams(params);
          if (flatParams.length > 0) {
            stmt.bind(flatParams);
          }
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        } catch (e) {
          console.error('[DB] all() error:', e.message, '| SQL:', sql.slice(0, 80));
          return [];
        }
      },

      /**
       * Run a statement (INSERT, UPDATE, DELETE) — returns { changes }
       */
      run(...params) {
        try {
          const flatParams = flattenParams(params);
          self._db.run(sql, flatParams);
          const changes = self._db.getRowsModified();
          if (changes > 0) {
            self.save();
          }
          return { changes };
        } catch (e) {
          console.error('[DB] run() error:', e.message, '| SQL:', sql.slice(0, 80));
          return { changes: 0 };
        }
      }
    };
  }

  /**
   * Save database to disk
   */
  save() {
    const data = this._db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }

  /**
   * Close the database
   */
  close() {
    this.save();
    this._db.close();
  }
}

/**
 * Flatten parameters — handles both positional args and single-array args
 */
function flattenParams(params) {
  if (params.length === 0) return [];
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

/**
 * Split SQL file into individual statements, respecting parentheses and quotes.
 */
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let parenDepth = 0;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (inString) {
      current += ch;
      if (ch === stringChar && sql[i + 1] !== stringChar) {
        inString = false;
      }
      continue;
    }

    if (ch === '\'' || ch === '"') {
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }

    if (ch === '(') { parenDepth++; current += ch; continue; }
    if (ch === ')') { parenDepth--; current += ch; continue; }

    if (ch === ';' && parenDepth === 0) {
      const trimmed = current.trim();
      if (trimmed.length > 0 && !trimmed.startsWith('--')) {
        statements.push(trimmed + ';');
      }
      current = '';
      continue;
    }

    // Skip line comments
    if (ch === '-' && sql[i + 1] === '-') {
      const newline = sql.indexOf('\n', i);
      i = newline === -1 ? sql.length : newline;
      continue;
    }

    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed.length > 0 && !trimmed.startsWith('--')) {
    statements.push(trimmed);
  }

  return statements;
}


/**
 * Initialize sql.js and load/create the database
 */
async function initDb() {
  if (db) return db;

  SQL = await initSqlJs();

  // Load existing database or create new
  let rawDb;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    rawDb = new SQL.Database(fileBuffer);
    console.log('[DB] Loaded existing database from:', DB_PATH);
  } else {
    rawDb = new SQL.Database();
    console.log('[DB] Created new database');
  }

  db = new SqlJsWrapper(rawDb);

  // Run schema migration using sql.js native exec (handles multiple statements)
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  try {
    rawDb.exec(schema);
    console.log('[DB] Schema migration completed successfully.');
  } catch (e) {
    // If full exec fails (e.g., tables already exist), run statement by statement
    console.warn('[DB] Full schema exec failed, running statements individually:', e.message);
    const statements = splitSqlStatements(schema);
    for (const stmt of statements) {
      try {
        rawDb.run(stmt);
      } catch (stmtErr) {
        if (!stmtErr.message.includes('already exists') && !stmtErr.message.includes('UNIQUE constraint')) {
          console.warn('[DB] Statement warning:', stmtErr.message.slice(0, 100));
        }
      }
    }
  }

  // Auto-save periodically
  const autoSaveTimer = setInterval(() => {
    if (db) db.save();
  }, 10000);
  if (autoSaveTimer && autoSaveTimer.unref) {
    autoSaveTimer.unref();
  }

  console.log('[DB] SQLite database initialized at:', DB_PATH);
  return db;
}

/**
 * Get the database instance (synchronous after init)
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

/**
 * Close the database connection
 */
function closeDb() {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Database connection closed.');
  }
}

// If run directly, initialize and verify
if (require.main === module) {
  initDb().then((database) => {
    const productCount = database.prepare('SELECT COUNT(*) as count FROM products').get();
    const policyCount = database.prepare('SELECT COUNT(*) as count FROM policies').get();
    console.log(`[DB Setup] Products: ${productCount.count}, Policies: ${policyCount.count}`);
    console.log('[DB Setup] Database setup complete!');
    closeDb();
  });
}

module.exports = { initDb, getDb, closeDb };
