import React, { useEffect, useState } from 'react';

function Timer({ duration, onTimeUp }) {
  const [timeRemaining, setTimeRemaining] = useState(duration);

  useEffect(() => {
    setTimeRemaining(duration);
  }, [duration]);

  useEffect(() => {
    if (timeRemaining <= 0) {
      if (onTimeUp) onTimeUp();
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, onTimeUp]);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const percentage = (timeRemaining / duration) * 100;

  const getColor = () => {
    if (percentage > 50) return '#4ade80';
    if (percentage > 25) return '#fbbf24';
    return '#ef4444';
  };

  return (
    <div style={styles.container}>
      <div style={styles.timerCircle}>
        <svg style={styles.svg} viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={getColor()}
            strokeWidth="8"
            strokeDasharray={`${percentage * 2.827} 282.7`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dasharray 0.3s ease' }}
          />
        </svg>
        <div style={styles.timeText}>
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px'
  },
  timerCircle: {
    position: 'relative',
    width: '120px',
    height: '120px'
  },
  svg: {
    width: '100%',
    height: '100%'
  },
  timeText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1f2937'
  }
};

export default Timer;
