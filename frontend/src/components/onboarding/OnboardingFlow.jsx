import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import DrandeeLogo from '../brand/DrandeeLogo';
import { apiGet, apiPost } from '../../api';

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
  const navigate = useNavigate();
  const [step, setStep] = useState(!user?.onboardingCompleted && !user?.username ? "username" : "interests");
  
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
        const res = await apiGet(`/api/user/check-username?username=${clean}`, {});
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
      const res = await apiPost('/api/user/onboarding', { username: usernameInput }, {});
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
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await apiPost('/api/user/onboarding', { interests: selectedInterests }, {});
      if (res.success) {
        // updateUser merges onboardingCompleted:true into context + localStorage atomically.
        // ProtectedRoute will re-evaluate and render children once state updates.
        updateUser(res.user);
        // Call onComplete callback if provided, then navigate as fallback.
        if (typeof onComplete === 'function') onComplete();
        // Navigate explicitly in case ProtectedRoute re-render hasn't fired yet.
        navigate('/feed', { replace: true });
      } else {
        setErrorMessage(res.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('[OnboardingFlow] interests submit failed:', err);
      setErrorMessage('Failed to save preferences. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0A] text-white flex flex-col items-center justify-center px-4 py-8 overflow-y-auto">
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
            <h1 className="text-[length:var(--text-h1)] sm:text-[length:var(--text-display)] font-bold tracking-[-0.02em] mb-3 text-center">
              Welcome to Drandee
            </h1>
            <p className="text-[#A0A0A8] text-[length:var(--text-body)] leading-[1.6] mb-8 text-center px-4">
              Choose your unique username to get started.
            </p>

            <form onSubmit={handleUsernameSubmit} className="w-full relative px-2">
              <label htmlFor="username-input" className="sr-only">Choose a username</label>
              <div className="relative flex items-center mb-2">
                <span className="absolute left-4 text-[#6E6E76] font-medium text-lg select-none">@</span>
                <input
                  id="username-input"
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="yourname"
                  className="w-full bg-[#14151A] border-2 border-[#2A2B30] focus:border-[#7F77DD] rounded-[var(--radius-md)] py-4 pl-10 pr-12 text-[length:var(--text-body)] font-medium outline-none transition-[border-color] duration-[150ms] placeholder-[#6E6E76]"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  disabled={isSubmitting}
                />
                
                {/* Status Indicator */}
                <div className="absolute right-4 flex items-center justify-center">
                  {usernameStatus === 'checking' && (
                    <div className="w-5 h-5 border-2 border-[#6E6E76] border-t-[#7F77DD] rounded-full animate-spin" />
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
                  <p className="text-[length:var(--text-caption)] text-[#FF3B30]">{errorMessage}</p>
                ) : usernameStatus === 'available' ? (
                  <p className="text-[length:var(--text-caption)] text-[#25D366]">Username is available!</p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={usernameStatus !== 'available' || isSubmitting}
                className="w-full py-4 min-h-[44px] rounded-[var(--radius-md)] font-semibold text-[length:var(--text-body)] bg-[#7F77DD] text-white hover:bg-[#6A61C9] disabled:opacity-50 disabled:cursor-not-allowed transition-[background] duration-[150ms] mb-4"
              >
                {isSubmitting ? 'Confirming...' : 'Confirm username'}
              </button>

              <button
                type="button"
                onClick={handleSkipUsername}
                disabled={isSubmitting}
                className="w-full py-3 min-h-[44px] rounded-[var(--radius-md)] font-medium text-[#A0A0A8] hover:text-white text-[length:var(--text-body)] transition-[color] duration-[150ms]"
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
            <h1 className="text-[length:var(--text-h1)] sm:text-[length:var(--text-display)] font-bold tracking-[-0.02em] mb-3 text-center mt-8">
              What are you into?
            </h1>
            <p className="text-[#A0A0A8] text-[length:var(--text-body)] leading-[1.6] mb-8 text-center px-4">
              Choose your interests to personalize your Drandee experience.
            </p>

            <div className="flex flex-wrap justify-center gap-3 mb-8 w-full px-2">
              {interestsList.map((interest) => {
                const isSelected = selectedInterests.includes(interest.id);
                return (
                  <motion.button
                    key={interest.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleInterest(interest.id)}
                    className={`
                      flex items-center gap-2 px-4 py-3 rounded-full font-medium transition-all duration-[150ms]
                      ${isSelected 
                        ? 'bg-[#7F77DD]/15 border border-[#7F77DD] text-white' 
                        : 'bg-[#14151A] border border-[#2A2B30] text-[#A0A0A8] hover:bg-[#1A1B20] hover:text-white'
                      }
                    `}
                  >
                    <span>{interest.icon}</span>
                    <span>{interest.label}</span>
                    {isSelected && (
                      <svg className="w-4 h-4 ml-1 text-[#7F77DD]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    )}
                  </motion.button>
                );
              })}
            </div>

            <div className="w-full max-w-md px-4 pb-8">
              <button
                onClick={handleInterestsSubmit}
                disabled={isSubmitting}
                className="w-full py-4 min-h-[44px] rounded-[var(--radius-md)] font-semibold text-[length:var(--text-body)] bg-[#7F77DD] text-white hover:bg-[#6A61C9] disabled:opacity-50 disabled:cursor-not-allowed transition-[background] duration-[150ms]"
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
