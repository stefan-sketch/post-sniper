/**
 * Mock data generator for testing Post Sniper without real API
 */

export interface MockPost {
  id: string;
  date: string;
  message: string;
  link: string;
  image?: string;
  type: string;
  kpi: {
    page_posts_reactions: { value: number; title: string; formatted_value: string };
    page_posts_comments_count: { value: number; title: string; formatted_value: string };
    page_posts_shares_count: { value: number; title: string; formatted_value: string };
    page_total_engagement_count: { value: number; title: string; formatted_value: string };
  };
}

const sampleImages = [
  "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1682687221038-404cb8830901?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1682687220063-4742bd7fd538?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1682687220199-d0124f48f95b?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1682687220923-c58b9a4592ae?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1682687221080-5cb261c645cb?w=800&h=600&fit=crop",
];

const sampleMessages = [
  "🎉 Exciting news! We're launching something amazing today. Stay tuned for more updates!",
  "Check out our latest product release. We've been working hard on this and can't wait to share it with you all! 🚀",
  "Behind the scenes look at our team working on the next big thing. Innovation never stops! 💡",
  "Thank you to our amazing community for your continued support. You make everything possible! ❤️",
  "New blog post: 10 tips to improve your social media strategy in 2025. Link in bio! 📱",
  "Weekend vibes! What are your plans for the weekend? Let us know in the comments below! ☀️",
  "Just hit a major milestone! Thank you all for being part of this incredible journey. 🎊",
  "Sneak peek of what's coming next week. Get ready for something special! 👀",
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generatePostId(): string {
  return `${Date.now()}_${randomInt(10000, 99999)}`;
}

function generatePostDate(hoursAgo: number): Date {
  const now = new Date();
  const minutesAgo = randomInt(0, hoursAgo * 60);
  return new Date(now.getTime() - minutesAgo * 60 * 1000);
}

export function generateMockPost(hoursAgo: number = 24): MockPost {
  const reactions = randomInt(10, 500);
  const comments = randomInt(5, 150);
  const shares = randomInt(0, 50);
  const engagement = reactions + comments + shares;
  const postDate = generatePostDate(hoursAgo);

  return {
    id: generatePostId(),
    date: postDate.toISOString(),
    message: randomElement(sampleMessages),
    link: `https://facebook.com/post/${generatePostId()}`,
    image: Math.random() > 0.3 ? randomElement(sampleImages) : undefined,
    type: "PHOTO",
    kpi: {
      page_posts_reactions: {
        value: reactions,
        title: "Number of Reactions",
        formatted_value: reactions.toString(),
      },
      page_posts_comments_count: {
        value: comments,
        title: "Number of Comments",
        formatted_value: comments.toString(),
      },
      page_posts_shares_count: {
        value: shares,
        title: "Number of Shares",
        formatted_value: shares.toString(),
      },
      page_total_engagement_count: {
        value: engagement,
        title: "Total Engagement",
        formatted_value: engagement.toString(),
      },
    },
  };
}

export function generateMockPosts(count: number = 10, maxHoursAgo: number = 24): MockPost[] {
  const posts: MockPost[] = [];
  for (let i = 0; i < count; i++) {
    posts.push(generateMockPost(maxHoursAgo));
  }
  // Sort by date descending
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function generateMockResponse(profileId: string, profileName: string) {
  return {
    data: {
      posts: generateMockPosts(15, 24),
    },
    metadata: {
      version: "v1",
      network: "facebook",
      profile_id: profileId,
      profile_name: profileName,
      task: "posts",
      date_from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      date_until: new Date().toISOString(),
    },
  };
}

