import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, UserPlus, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PushNotification = () => {
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const handleNewNotification = (e) => {
      const notif = e.detail;
      setNotifications(prev => {
        // Prevent duplicates
        if (prev.find(n => n.id === notif.id)) return prev;
        return [...prev, notif];
      });

      // Auto dismiss after 4 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notif.id));
      }, 4000);
    };

    window.addEventListener('new_notification', handleNewNotification);
    return () => window.removeEventListener('new_notification', handleNewNotification);
  }, []);

  const getIcon = (type) => {
    switch(type) {
      case 'respect': return <Heart className="w-5 h-5 text-red-500 fill-red-500" />;
      case 'comment': return <MessageCircle className="w-5 h-5 text-blue-400 fill-blue-400" />;
      case 'follow': return <UserPlus className="w-5 h-5 text-green-400" />;
      default: return <Bell className="w-5 h-5 text-white" />;
    }
  };

  const handleTap = (notif) => {
    setNotifications(prev => prev.filter(n => n.id !== notif.id));
    if (notif.postId) {
      navigate(`/reels?postId=${notif.postId}`);
    } else if (notif.actorId) {
      navigate(`/profile/${notif.actorId}`);
    } else {
      navigate('/notifications');
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] flex flex-col items-center pt-safe pt-4 px-4 gap-2 pointer-events-none">
      <AnimatePresence>
        {notifications.map(notif => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.2 } }}
            onClick={() => handleTap(notif)}
            className="bg-[#1a1a24]/80 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl flex items-center gap-3 w-full max-w-sm pointer-events-auto cursor-pointer"
          >
            {notif.actorAvatar ? (
              <img src={notif.actorAvatar} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                {getIcon(notif.type)}
              </div>
            )}
            
            <div className="flex-1">
              <p className="text-sm text-white leading-tight">
                <span className="font-bold">{notif.actorName}</span> {notif.message}
              </p>
            </div>
            
            <div className="flex-shrink-0">
              {getIcon(notif.type)}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default PushNotification;
