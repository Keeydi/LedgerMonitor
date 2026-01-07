import { useState, useEffect, useCallback } from 'react';

type CaptureStatus = 'counting' | 'sending' | 'waiting';

interface UseCaptureTimerOptions {
  cameraId: string;
  isOnline: boolean;
  lastCapture: Date | string; // Server timestamp for synchronization
  onCapture: () => Promise<void>;
}

const COUNTDOWN_SECONDS = 10;
const WAIT_SECONDS = 15 * 60; // 15 minutes (900 seconds)

export function useCaptureTimer({ cameraId, isOnline, lastCapture, onCapture }: UseCaptureTimerOptions) {
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>('waiting');
  const [nextCaptureTime, setNextCaptureTime] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);

  // Calculate timer based on server's lastCapture timestamp
  // Cycle: Capture -> Wait (15 min) -> Countdown (10 sec) -> Capture (repeat)
  const calculateTimeRemaining = useCallback(() => {
    if (!isOnline) {
      setNextCaptureTime(0);
      return;
    }

    const lastCaptureDate = new Date(lastCapture);
    const now = Date.now();
    const lastCaptureTime = lastCaptureDate.getTime();
    
    // Calculate time since last capture (in seconds)
    const timeSinceLastCapture = Math.floor((now - lastCaptureTime) / 1000);
    
    // If last capture was less than WAIT_SECONDS ago, we're in waiting period
    if (timeSinceLastCapture < WAIT_SECONDS) {
      const remaining = WAIT_SECONDS - timeSinceLastCapture;
      setNextCaptureTime(remaining);
      setCaptureStatus('waiting');
    } else {
      // We're past the wait period, now in countdown phase
      const timeInCountdownPhase = timeSinceLastCapture - WAIT_SECONDS;
      
      if (timeInCountdownPhase < COUNTDOWN_SECONDS) {
        // In countdown phase
        const countdownRemaining = COUNTDOWN_SECONDS - timeInCountdownPhase;
        setNextCaptureTime(countdownRemaining);
        setCaptureStatus('counting');
      } else {
        // Past countdown, should trigger capture (this shouldn't happen often, but handle it)
        setNextCaptureTime(0);
        setCaptureStatus('counting');
      }
    }
  }, [lastCapture, isOnline]);

  const triggerCapture = useCallback(async () => {
    if (isCapturing) return; // Prevent multiple simultaneous captures
    
    setIsCapturing(true);
    setCaptureStatus('sending');

    try {
      await onCapture();
      // After capture, the server will update lastCapture, and we'll recalculate on next render
      // Set status to waiting - the timer will update based on new lastCapture from server
      setCaptureStatus('waiting');
    } catch (error) {
      console.error('Error triggering capture:', error);
      setCaptureStatus('waiting');
    } finally {
      setIsCapturing(false);
    }
  }, [onCapture, isCapturing]);

  const resetTimer = useCallback(() => {
    // Reset just recalculates based on current lastCapture
    calculateTimeRemaining();
  }, [calculateTimeRemaining]);

  // Recalculate when lastCapture changes (from server)
  useEffect(() => {
    calculateTimeRemaining();
  }, [calculateTimeRemaining]);

  // Update timer every second
  useEffect(() => {
    if (!isOnline) {
      setNextCaptureTime(0);
      return;
    }

    const updateTimer = () => {
      const lastCaptureDate = new Date(lastCapture);
      const now = Date.now();
      const lastCaptureTime = lastCaptureDate.getTime();
      
      // Calculate time since last capture (in seconds)
      const timeSinceLastCapture = Math.floor((now - lastCaptureTime) / 1000);
      
      // If last capture was less than WAIT_SECONDS ago, we're in waiting period
      if (timeSinceLastCapture < WAIT_SECONDS) {
        const remaining = WAIT_SECONDS - timeSinceLastCapture;
        setNextCaptureTime(remaining);
        setCaptureStatus('waiting');
      } else {
        // We're past the wait period, now in countdown phase
        const timeInCountdownPhase = timeSinceLastCapture - WAIT_SECONDS;
        
        if (timeInCountdownPhase < COUNTDOWN_SECONDS) {
          // In countdown phase
          const countdownRemaining = COUNTDOWN_SECONDS - timeInCountdownPhase;
          setNextCaptureTime(countdownRemaining);
          setCaptureStatus('counting');
          
          // Trigger capture when countdown reaches 0
          if (countdownRemaining <= 1 && !isCapturing) {
            triggerCapture();
          }
        } else {
          // Past countdown, should trigger capture immediately
          setNextCaptureTime(0);
          setCaptureStatus('counting');
          if (!isCapturing) {
            triggerCapture();
          }
        }
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [isOnline, lastCapture, triggerCapture, isCapturing]);

  return {
    captureStatus,
    nextCaptureTime,
    resetTimer,
  };
}


