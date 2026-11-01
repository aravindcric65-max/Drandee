import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock } from 'lucide-react';

const SchedulePicker = ({ selected, onChange }) => {
  const [publishType, setPublishType] = useState('now'); // 'now' or 'schedule'
  const [scheduledTime, setScheduledTime] = useState('');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          onClick={() => { setPublishType('now'); onChange('now'); }}
          className={`p-4 rounded-xl flex items-center justify-center gap-2
            ${publishType === 'now' ? 'bg-primary/20 ring-2 ring-primary' : 'bg-bgCard'}`}
        >
          <Clock className="w-5 h-5 text-primary" />
          <span className="text-white font-medium">Now</span>
        </motion.button>

        <motion.button
          onClick={() => { setPublishType('schedule'); onChange('schedule'); }}
          className={`p-4 rounded-xl flex items-center justify-center gap-2
            ${publishType === 'schedule' ? 'bg-primary/20 ring-2 ring-primary' : 'bg-bgCard'}`}
        >
          <Calendar className="w-5 h-5 text-primary" />
          <span className="text-white font-medium">Schedule</span>
        </motion.button>
      </div>

      {publishType === 'schedule' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <input
            type="datetime-local"
            value={scheduledTime}
            onChange={(e) => { setScheduledTime(e.target.value); onChange(e.target.value); }}
            className="w-full p-4 bg-bgCard rounded-xl text-white border border-bgBorder focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </motion.div>
      )}
    </div>
  );
};

export default SchedulePicker;