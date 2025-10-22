import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { 
  InsertUser, 
  users, 
  monitoredPages, 
  InsertMonitoredPage,
  MonitoredPage,
  managedPages,
  InsertManagedPage,
  ManagedPage,
  userSettings,
  InsertUserSettings,
  UserSettings,
  alerts,
  InsertAlert,
  Alert
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _client = postgres(process.env.DATABASE_URL, {
        ssl: { rejectUnauthorized: true },
        idle_timeout: 20,
        connect_timeout: 10,
      });
      _db = drizzle(_client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.id) {
    throw new Error("User ID is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      id: user.id,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role === undefined) {
      if (user.id === ENV.ownerId) {
        user.role = 'admin';
        values.role = 'admin';
        updateSet.role = 'admin';
      }
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.id,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUser(id: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Monitored Pages
export async function getMonitoredPages(userId: string): Promise<MonitoredPage[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(monitoredPages).where(eq(monitoredPages.userId, userId));
}

export async function createMonitoredPage(page: InsertMonitoredPage): Promise<MonitoredPage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(monitoredPages).values(page);
  const result = await db.select().from(monitoredPages).where(eq(monitoredPages.id, page.id!)).limit(1);
  return result[0];
}

export async function updateMonitoredPage(id: string, updates: Partial<InsertMonitoredPage>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(monitoredPages).set({ ...updates, updatedAt: new Date() }).where(eq(monitoredPages.id, id));
}

export async function deleteMonitoredPage(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(monitoredPages).where(eq(monitoredPages.id, id));
}

// Managed Pages (for Pages tab)
export async function getManagedPages(userId: string): Promise<ManagedPage[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(managedPages).where(eq(managedPages.userId, userId));
}

export async function createManagedPage(page: InsertManagedPage): Promise<ManagedPage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(managedPages).values(page);
  const result = await db.select().from(managedPages).where(eq(managedPages.id, page.id!)).limit(1);
  return result[0];
}

export async function updateManagedPage(id: string, updates: Partial<InsertManagedPage>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(managedPages).set({ ...updates, updatedAt: new Date() }).where(eq(managedPages.id, id));
}

export async function deleteManagedPage(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(managedPages).where(eq(managedPages.id, id));
}

// User Settings
export async function getUserSettings(userId: string): Promise<UserSettings | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertUserSettings(settings: InsertUserSettings): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(userSettings).values(settings).onConflictDoUpdate({
    target: userSettings.userId,
    set: { ...settings, updatedAt: new Date() }
  });
}

// Alerts
export async function getAlerts(userId: string, limit: number = 50): Promise<Alert[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(alerts)
    .where(eq(alerts.userId, userId))
    .orderBy(desc(alerts.triggeredAt))
    .limit(limit);
}

export async function createAlert(alert: InsertAlert): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(alerts).values(alert);
}

export async function markAlertAsRead(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(alerts).set({ isRead: true }).where(eq(alerts.id, id));
}

export async function getUnreadAlertCount(userId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select().from(alerts)
    .where(and(eq(alerts.userId, userId), eq(alerts.isRead, false)));
  
  return result.length;
}

export async function deleteAlert(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(alerts).where(eq(alerts.id, id));
}


// Cached Posts
export async function clearAllCachedPosts(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { cachedPosts } = await import("../drizzle/schema");
  await db.delete(cachedPosts);
}

