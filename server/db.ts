import { eq, and, or, desc, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, monitoredPages, InsertMonitoredPage, MonitoredPage, userSettings, InsertUserSettings, UserSettings, alerts, InsertAlert, Alert, posts, InsertPost, Post } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
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

    await db.insert(users).values(values).onDuplicateKeyUpdate({
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
  
  await db.insert(userSettings).values(settings).onDuplicateKeyUpdate({
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

export async function getAlertByPostId(userId: string, postId: string, pageId: string): Promise<Alert | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(alerts)
    .where(and(
      eq(alerts.userId, userId),
      eq(alerts.postId, postId),
      eq(alerts.pageId, pageId)
    ))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// Posts
export async function upsertPost(post: InsertPost): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(posts).values(post).onDuplicateKeyUpdate({
    set: {
      message: post.message,
      image: post.image,
      link: post.link,
      reactions: post.reactions,
      comments: post.comments,
      shares: post.shares,
      rawData: post.rawData,
      lastUpdated: new Date(),
    }
  });
}

export async function getPosts(pageIds?: string[], limit: number = 100): Promise<Post[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(posts).orderBy(desc(posts.postDate)).limit(limit);
  
  if (pageIds && pageIds.length > 0) {
    // Filter by page IDs if provided
    const conditions = pageIds.map(pageId => eq(posts.pageId, pageId));
    query = query.where(or(...conditions)) as any;
  }
  
  return await query;
}

export async function getPostsByTimeRange(hoursAgo: number, pageIds?: string[]): Promise<Post[]> {
  const db = await getDb();
  if (!db) return [];
  
  const timeThreshold = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  
  let conditions = [gte(posts.postDate, timeThreshold)];
  
  if (pageIds && pageIds.length > 0) {
    const pageConditions = pageIds.map(pageId => eq(posts.pageId, pageId));
    conditions.push(or(...pageConditions) as any);
  }
  
  return await db.select().from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.postDate));
}

