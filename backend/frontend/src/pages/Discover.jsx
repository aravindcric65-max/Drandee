import React, { useContext, useState, useMemo } from "react";
import { UserContext } from "../context/UserContext";
import FeedCard from "../components/FeedCard";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, TrendingUp, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../components/Navbar";

const Discover = () => {
  const { posts = [], user = { following: [] } } = useContext(UserContext) || {};
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("trending"); // "trending" | "suggested"
  const navigate = useNavigate();

  const filteredPosts = useMemo(() => {
    if (!search) return [];
    return posts.filter((post) =>
      post.creatorName?.toLowerCase().includes(search.toLowerCase()) ||
      post.caption?.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, posts]);

  // Score = totalRespects * 2 + (watchCount or views)
  const trending = useMemo(() => {
    return [...posts]
      .sort((a, b) => {
        const scoreA = (a.totalRespects || 0) * 2 + (a.watchCount || a.views || 0);
        const scoreB = (b.totalRespects || 0) * 2 + (b.watchCount || b.views || 0);
        return scoreB - scoreA;
      })
      .slice(0, 15);
  }, [posts]);

  const suggested = useMemo(() => {
    return posts
      .filter((post) => user.following && !user.following.includes(post.creatorId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 15);
  }, [posts, user.following]);

  const displayedPosts = search ? filteredPosts : (activeTab === "trending" ? trending : suggested);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col pb-[calc(64px+env(safe-area-inset-bottom))] overflow-y-auto">
      <header className="sticky top-0 z-50 bg-[#09090e]/90 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
            <input
              placeholder="Search creators & posts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[var(--primary)] focus:bg-white/10 transition-all text-white placeholder:text-white/40"
            />
          </div>
        </div>

        {!search && (
          <div className="flex px-4 border-b border-white/5">
            <button
              onClick={() => setActiveTab("trending")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors relative ${activeTab === "trending" ? "text-white" : "text-white/50"}`}
            >
              <TrendingUp size={16} /> Trending
              {activeTab === "trending" && (
                <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 w-full h-[2px] bg-[var(--primary)] rounded-t-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("suggested")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors relative ${activeTab === "suggested" ? "text-white" : "text-white/50"}`}
            >
              <Users size={16} /> Suggested
              {activeTab === "suggested" && (
                <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 w-full h-[2px] bg-[var(--primary)] rounded-t-full" />
              )}
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 p-2 md:p-4 max-w-3xl w-full mx-auto">
        <AnimatePresence mode="popLayout">
          {displayedPosts.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="py-20 text-center text-white/40 flex flex-col items-center gap-3"
            >
              <Search size={48} className="opacity-20" />
              <p>{search ? "No results found" : "No posts to discover right now"}</p>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="grid gap-4"
            >
              {displayedPosts.map((post) => (
                <FeedCard key={post.id} post={post} allPosts={posts} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <Navbar />
    </div>
  );
};

export default Discover;