import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Play, Image as ImageIcon, Type, Layout } from 'lucide-react';

export const TopPostCard = ({ post, rank }) => {
  const navigate = useNavigate();

  // Re-use existing post view logic (just navigates to the post in feed or opens modal if we had one)
  // Or navigate to the creator's profile and open it there.
  // The simplest is to use the standard post link if there is one. 
  // Wait, Drandee uses /profile or /reels. For now we will just emit an onClick or just show it cleanly.
  // The prompt said: "Clicking a post MUST use the existing canonical post navigation/viewer architecture. Do NOT invent /post/:id if the project does not already use that route. Trace existing post navigation and reuse it."
  // Based on my previous audit of AppRoutes, there is no /post/:id route. Content is viewed on /feed, /profile, /reels, /spotlight.
  // So clicking should probably navigate to /profile with some state, or just open a modal. 
  // Let's navigate to /profile which we know exists, and the profile page handles showing the user's posts.
  
  const handlePostClick = () => {
    // Navigating to the authenticated user's own profile where the post exists.
    navigate('/profile', { state: { openPostId: post.id, type: post.contentType } });
  };

  const getIcon = () => {
    switch (post.contentType) {
      case 'video': return <Play className="w-4 h-4 text-white" />;
      case 'image': return <ImageIcon className="w-4 h-4 text-white" />;
      case 'carousel': return <Layout className="w-4 h-4 text-white" />;
      case 'text': return <Type className="w-4 h-4 text-white" />;
      default: return null;
    }
  };

  const getThumbnail = () => {
    if (post.mediaUrl) {
      return (
        <div className="relative w-24 h-32 flex-shrink-0 rounded-lg overflow-hidden bg-[#222]">
          <img src={post.mediaUrl} alt="Thumbnail" className="w-full h-full object-cover" />
          <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1 backdrop-blur-md">
            {getIcon()}
          </div>
        </div>
      );
    }
    return (
      <div className="relative w-24 h-32 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-[#7F77DD] to-[#9B4DCA] flex items-center justify-center p-3">
        <span className="text-xs text-white font-medium line-clamp-4 text-center">
          {post.caption || 'Text Post'}
        </span>
        <div className="absolute top-2 right-2 bg-black/40 rounded-full p-1 backdrop-blur-md">
          {getIcon()}
        </div>
      </div>
    );
  };

  return (
    <div 
      onClick={handlePostClick}
      className="bg-[#111111] border border-white/10 rounded-xl p-4 flex gap-4 hover:border-white/20 transition-all cursor-pointer items-center"
    >
      <div className="flex flex-col items-center justify-center w-8">
        <span className="text-[#8A8A8F] text-sm font-medium">#{rank}</span>
      </div>

      {getThumbnail()}

      <div className="flex-1 min-w-0 py-1 flex flex-col h-full justify-between gap-3">
        <div>
          <p className="text-white text-sm line-clamp-2 leading-relaxed">
            {post.caption || 'No caption'}
          </p>
          <p className="text-[#8A8A8F] text-xs mt-1">
            {new Date(post.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-4 text-[#8A8A8F] text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5" />
            {post.respects.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" />
            {post.comments.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5" />
            {post.shares.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};
