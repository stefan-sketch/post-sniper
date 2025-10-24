import { useRef, useEffect, useState } from 'react';
import { FixedSizeList as List } from 'react-window';

interface VirtualizedPostListProps<T> {
  posts: T[];
  renderPost: (post: T) => React.ReactNode;
  itemHeight?: number;
  className?: string;
}

export function VirtualizedPostList<T>({ 
  posts, 
  renderPost, 
  itemHeight = 400,
  className = ''
}: VirtualizedPostListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(600);

  // Calculate available height
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const availableHeight = window.innerHeight - rect.top - 20; // 20px padding
        setHeight(Math.max(400, availableHeight));
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style} className="px-2">
      {renderPost(posts[index])}
    </div>
  );

  return (
    <div ref={containerRef} className={`w-full ${className}`}>
      <List
        height={height}
        itemCount={posts.length}
        itemSize={itemHeight}
        width="100%"
        className="hide-scrollbar"
        style={{
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {Row}
      </List>
    </div>
  );
}

