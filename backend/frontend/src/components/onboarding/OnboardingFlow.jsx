import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../../context/UserContext';
import DrandeeLogo from '../brand/DrandeeLogo';
import { apiGet, apiPost, auth } from '../../api';

const interestsList = [
  { id: 'music', label: 'Music', icon: '🎵' },
  { id: 'technology', label: 'Technology', icon: '💻' },
  { id: 'gaming', label: 'Gaming', icon: '🎮' },
  { id: 'fashion', label: 'Fashion', icon: '👗' },
  { id: 'fitness', label: 'Fitness', icon: '🏋️' },
  { id: 'photography', label: 'Photography', icon: '📸' },
  { id: 'travel', label: 'Travel', icon: '✈️' },
  { id: 'art', label: 'Art', icon: '🎨' },
  { id: 'comedy', label: 'Comedy', icon: '😂' },
  { id: 'business', label: 'Business', icon: '📈' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'movies', label: 'Movies', icon: '🍿' },
  { id: 'food', label: 'Food', icon: '🍕' },
  { id: 'lifestyle', label: 'Lifestyle', icon: '✨' }
];

const OnboardingFlow = ({ onComplete }) => {
  const { user, updateUser } = useUser();
  const [step, setStep] = useState(user?.username ? 'interests' : 'username');
  
  // Username state
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameStatus, setUsernameStatus] = useState('idle'); // idle, checking, available, taken, error
  const [errorMessage, setErrorMessage] = useState('');
  
  // Interests state
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounce username check
  useEffect(() => {
    if (step !== 'username') return;
    
    const checkUsername = async () => {
      const clean = usernameInput.trim().toLowerCase();
      if (!clean) {
        setUsernameStatus('idle');
        return;
      }
      if (clean.length < 3 || clean.length > 20 || !/^[a-z0-9_]+$/.test(clean)) {
        setUsernameStatus('error');
        setErrorMessage('Use 3-20 letters, numbers, or underscores.');
        return;
      }
      
      setUsernameStatus('checking');
      try {
        const res = await apiGet(`/api/user/check-username?username=${clean}`, auth(user?.token || localStorage.getItem('token')));
        if (res.available) {
          setUsernameStatus('available');
        } else {
          setUsernameStatus('taken');
          setErrorMessage('Username is already taken.');
        }
      } catch (err) {
        setUsernameStatus('idle');
      }
    };

    const timer = setTimeout(checkUsername, 400);
    return () => clearTimeout(timer);
  }, [usernameInput, step, user?.token]);

  const handleUsernameSubmit = async (e) => {
    if (e) e.preventDefault();
    if (usernameStatus !== 'available') return;
    
    setIsSubmitting(true);
    try {
      const res = await apiPost('/api/user/onboarding', { username: usernameInput }, auth(user?.token || localStorage.getItem('token')));
      if (res.success) {
        updateUser(res.user);
        setStep('interests');
      }
    } catch (err) {
      if (err?.response?.status === 409 || err?.code === 'USERNAME_TAKEN') {
        setUsernameStatus('taken');
        setErrorMessage('Username is already taken.');
      } else {
        setErrorMessage('Something went wrong. Please try again.');
        setUsernameStatus('error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipUsername = () => {
    setStep('interests');
  };

  const toggleInterest = (id) => {
    setSelectedInterests(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleInterestsSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await apiPost('/api/user/onboarding', { interests: selectedInterests }, auth(user?.token || localStorage.getItem('token')));
      if (res.success) {
        updateUser(res.user);
        onComplete();
      }
    } catch (err) {
      console.error(err);
      onComplete(); // Failsafe fallback
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-4 overflow-y-auto">
      <AnimatePresence mode="wait">
        {step === 'username' && (
          <motion.div 
            key="username"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md flex flex-col items-center"
          >
            <DrandeeLogo className="w-16 h-16 mb-6" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 text-center">
              Welcome to Drandee
            </h1>
            <p className="text-gray-400 mb-8 text-center px-4">
              Choose your unique username to get started.
            </p>

            <form onSubmit={handleUsernameSubmit} className="w-full relative px-2">
              <div className="relative flex items-center mb-2">
                <span className="absolute left-4 text-gray-500 font-medium text-lg select-none">@</span>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="yourname"
                  className="w-full bg-[#1A1A1A] border-2 border-transparent focus:border-[#00F0FF] rounded-2xl py-4 pl-10 pr-12 text-lg font-medium outline-none transition-all placeholder-gray-600"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  disabled={isSubmitting}
                />
                
                {/* Status Indicator */}
                <div className="absolute right-4 flex items-center justify-center">
                  {usernameStatus === 'checking' && (
                    <div className="w-5 h-5 border-2 border-gray-500 border-t-[#00F0FF] rounded-full animate-spin" />
                  )}
                  {usernameStatus === 'available' && (
                    <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  )}
                  {usernameStatus === 'taken' && (
                    <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  )}
                </div>
              </div>

              {/* Status Message */}
              <div className="h-6 px-2 mb-6">
                {usernameStatus === 'error' || usernameStatus === 'taken' ? (
                  <p className="text-red-500 text-sm">{errorMessage}</p>
                ) : usernameStatus === 'available' ? (
                  <p className="text-green-500 text-sm">Username is available!</p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={usernameStatus !== 'available' || isSubmitting}
                className="w-full py-4 rounded-xl font-bold text-lg bg-white text-black disabled:opacity-50 disabled:bg-gray-800 disabled:text-gray-500 transition-all mb-4"
              >
                {isSubmitting ? 'Confirming...' : 'Confirm username'}
              </button>

              <button
                type="button"
                onClick={handleSkipUsername}
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl font-medium text-gray-400 hover:text-white transition-colors"
              >
                Skip for now
              </button>
            </form>
          </motion.div>
        )}

        {step === 'interests' && (
          <motion.div 
            key="interests"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg flex flex-col items-center"
          >
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 text-center mt-8">
              What are you into?
            </h1>
            <p className="text-gray-400 mb-8 text-center px-4">
              Choose your interests to personalize your Drandee experience.
            </p>

            <div className="flex flex-wrap justify-center gap-3 mb-10 w-full px-2">
              {interestsList.map((interest) => {
                const isSelected = selectedInterests.includes(interest.id);
                return (
                  <motion.button
                    key={interest.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleInterest(interest.id)}
                    className={`
                      flex items-center gap-2 px-4 py-3 rounded-full font-medium transition-all
                      ${isSelected 
                        ? 'bg-gradient-to-r from-[#00F0FF]/20 to-[#8A2BE2]/20 border border-[#00F0FF] text-white shadow-[0_0_15px_rgba(0,240,255,0.2)]' 
                        : 'bg-[#1A1A1A] border border-transparent text-gray-400 hover:bg-[#2A2A2A] hover:text-white'
                      }
                    `}
                  >
                    <span>{interest.icon}</span>
                    <span>{interest.label}</span>
                    {isSelected && (
                      <svg className="w-4 h-4 ml-1 text-[#00F0FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    )}
                  </motion.button>
                );
              })}
            </div>

            <div className="w-full max-w-md px-4 pb-8">
              <button
                onClick={handleInterestsSubmit}
                disabled={isSubmitting}
                className="w-full py-4 rounded-xl font-bold text-lg bg-white text-black disabled:opacity-50 transition-all mb-4"
              >
                {isSubmitting ? 'Saving...' : (selectedInterests.length > 0 ? 'Continue' : 'Skip')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OnboardingFlow;
