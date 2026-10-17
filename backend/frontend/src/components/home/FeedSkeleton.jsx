import React, { useMemo } from 'react';

const CreatorRow = () => (
  <div 
    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between"
    role="status"
    aria-label="Loading creator information"
  >
    <div className="flex items-center gap-2.5 sm:gap-3">
      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/5 animate-pulse flex-shrink-0" />
      <div className="flex flex-col gap-2 min-w-0">
        <div className="w-24 sm:w-28 h-3 rounded-full bg-white/5 animate-pulse" />
        <div className="w-16 sm:w-20 h-2 rounded-full bg-white/[0.03] animate-pulse" />
      </div>
    </div>
    <div className="w-16 sm:w-20 h-7 sm:h-8 rounded-full bg-white/5 animate-pulse flex-shrink-0" />
  </div>
);

const InteractionRow = () => (
  <div 
    className="w-full px-4 sm:px-5 py-2 flex items-center justify-between"
    role="status"
    aria-label="Loading interactions"
  >
    <div className="flex items-center gap-4 sm:gap-5 md:gap-6">
      <div className="flex gap-2 items-center">
        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/5 animate-pulse"/>
        <div className="w-5 sm:w-6 h-2 rounded-full bg-white/5 animate-pulse"/>
      </div>
      <div className="flex gap-2 items-center">
        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/5 animate-pulse"/>
        <div className="w-5 sm:w-6 h-2 rounded-full bg-white/5 animate-pulse"/>
      </div>
      <div className="flex gap-2 items-center">
        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/5 animate-pulse"/>
        <div className="w-5 sm:w-6 h-2 rounded-full bg-white/5 animate-pulse"/>
      </div>
    </div>
    <div className="flex gap-2">
      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/5 animate-pulse" />
      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/5 animate-pulse" />
    </div>
  </div>
);

const VideoSkeleton = () => (
  <article 
    className="w-full mb-8 sm:mb-10 md:mb-12 border-b border-white/5 pb-8 sm:pb-10 md:pb-12 last:border-0 last:mb-24 sm:last:mb-32 overflow-hidden"
    role="status"
    aria-label="Loading video post"
  >
    <CreatorRow />
    <div className="w-full px-3 sm:px-4 mb-3">
      <div className="w-full aspect-[4/5] sm:aspect-[9/16] md:aspect-video rounded-[20px] sm:rounded-[24px] bg-white/[0.02] animate-pulse border border-white/5" />
    </div>
    <div className="px-4 sm:px-5 py-2 flex flex-col gap-2 mb-2">
      <div className="w-3/4 h-3 rounded-full bg-white/5 animate-pulse" />
      <div className="w-1/2 h-3 rounded-full bg-white/5 animate-pulse" />
    </div>
    <InteractionRow />
  </article>
);

const PhotoSkeleton = () => (
  <article 
    className="w-full mb-8 sm:mb-10 md:mb-12 border-b border-white/5 pb-8 sm:pb-10 md:pb-12 last:border-0 last:mb-24 sm:last:mb-32 overflow-hidden"
    role="status"
    aria-label="Loading photo post"
  >
    <CreatorRow />
    <div className="w-full px-3 sm:px-4 mb-3">
      <div className="w-full aspect-[3/4] sm:aspect-[4/5] rounded-[20px] sm:rounded-[24px] bg-white/[0.02] animate-pulse border border-white/5" />
    </div>
    <InteractionRow />
  </article>
);

const TextSkeleton = () => (
  <article 
    className="w-full mb-8 sm:mb-10 md:mb-12 border-b border-white/5 pb-8 sm:pb-10 md:pb-12 last:border-0 last:mb-24 sm:last:mb-32 overflow-hidden"
    role="status"
    aria-label="Loading text post"
  >
    <CreatorRow />
    <div className="px-4 sm:px-5 py-3 sm:py-4 flex flex-col gap-3">
      <div className="w-full h-4 sm:h-5 rounded-full bg-white/5 animate-pulse" />
      <div className="w-[90%] h-4 sm:h-5 rounded-full bg-white/5 animate-pulse" />
      <div className="w-[70%] h-4 sm:h-5 rounded-full bg-white/5 animate-pulse" />
    </div>
    <InteractionRow />
  </article>
);

const DiscussionSkeleton = () => (
  <article 
    className="w-full mb-8 sm:mb-10 md:mb-12 border-b border-white/5 pb-8 sm:pb-10 md:pb-12 last:border-0 last:mb-24 sm:last:mb-32 overflow-hidden"
    role="status"
    aria-label="Loading discussion post"
  >
    <div className="mx-3 sm:mx-4 my-2 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] bg-white/[0.02] border border-white/5 relative overflow-hidden">
      {/* Background gradient hint */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
      
      {/* Context Label */}
      <div className="w-20 sm:w-24 h-2.5 sm:h-3 rounded-full bg-white/5 animate-pulse mb-4 sm:mb-6" />
      
      {/* Question */}
      <div className="flex flex-col gap-2.5 sm:gap-3 mb-4 sm:mb-6">
        <div className="w-full h-5 sm:h-6 rounded-full bg-white/[0.04] animate-pulse" />
        <div className="w-2/3 h-5 sm:h-6 rounded-full bg-white/[0.04] animate-pulse" />
      </div>
      
      {/* Reply count & join */}
      <div className="flex justify-between items-center mt-2 border-t border-white/5 pt-3 sm:pt-4">
        <div className="w-24 sm:w-28 h-3 rounded-full bg-white/5 animate-pulse" />
        <div className="w-24 sm:w-28 h-7 sm:h-8 rounded-full bg-white/5 animate-pulse" />
      </div>
    </div>
    <InteractionRow />
  </article>
);

export const FeedSkeleton = () => {
  const skeletonItems = useMemo(() => [
    { type: 'video', key: 'video-1' },
    { type: 'text', key: 'text-1' },
    { type: 'photo', key: 'photo-1' },
    { type: 'discussion', key: 'discussion-1' },
    { type: 'video', key: 'video-2' }
  ], []);

  return (
    <div 
      className="w-full h-[100dvh] bg-black overflow-y-auto overflow-x-hidden hide-scrollbar pb-24 sm:pb-32 pt-2"
      role="feed"
      aria-label="Loading feed"
      aria-busy="true"
    >
      {skeletonItems.map((item) => {
        switch (item.type) {
          case 'video':
            return <VideoSkeleton key={item.key} />;
          case 'photo':
            return <PhotoSkeleton key={item.key} />;
          case 'text':
            return <TextSkeleton key={item.key} />;
          case 'discussion':
            return <DiscussionSkeleton key={item.key} />;
          default:
            return null;
        }
      })}
    </div>
  );
};

export default FeedSkeleton;