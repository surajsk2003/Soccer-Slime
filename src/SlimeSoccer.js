import React, { useState, useEffect, useRef, useCallback } from 'react';

const TRANSLATIONS = {
  "en-US": {
    "gameTitle": "Soccer Slime",
    "singlePlayer": "Single Player",
    "multiplayer": "Multiplayer",
    "selectDifficulty": "Select Difficulty",
    "easy": "Easy",
    "medium": "Medium",
    "hard": "Hard",
    "selectDuration": "Select Game Duration",
    "cyanTeam": "Cyan Team",
    "redTeam": "Red Team",
    "versus": "vs",
    "oneMinute": "1 Minute",
    "twoMinutes": "2 Minutes",
    "fourMinutes": "4 Minutes",
    "eightMinutes": "8 Minutes",
    "worldCup": "World Cup",
    "multiplayerControls1": "Left Team: W (jump), A/D (move), S (grab)",
    "multiplayerControls2": "Right Team: ↑ (jump), ←/→ (move), ↓ (grab)",
    "singlePlayerControls1": "Use Arrow Keys: ↑ (jump), ←/→ (move), ↓ (grab)",
    "singlePlayerControls2": "Hold ↓ to grab the ball when it's near!",
    "backButton": "Back",
    "gameWinner": "Wins!",
    "gameDraw": "It's a Draw!",
    "backToMenu": "Back to Menu"
  },
  "es-ES": {
    "gameTitle": "Soccer Slime",
    "singlePlayer": "Un Jugador",
    "multiplayer": "Multijugador",
    "selectDifficulty": "Seleccionar Dificultad",
    "easy": "Fácil",
    "medium": "Medio",
    "hard": "Difícil",
    "selectDuration": "Seleccionar Duración del Juego",
    "cyanTeam": "Equipo Cian",
    "redTeam": "Equipo Rojo",
    "versus": "vs",
    "oneMinute": "1 Minuto",
    "twoMinutes": "2 Minutos",
    "fourMinutes": "4 Minutos",
    "eightMinutes": "8 Minutos",
    "worldCup": "Copa Mundial",
    "multiplayerControls1": "Equipo Izquierdo: W (saltar), A/D (mover), S (agarrar)",
    "multiplayerControls2": "Equipo Derecho: ↑ (saltar), ←/→ (mover), ↓ (agarrar)",
    "singlePlayerControls1": "Usar Teclas de Flecha: ↑ (saltar), ←/→ (mover), ↓ (agarrar)",
    "singlePlayerControls2": "¡Mantén presionado ↓ para agarrar la pelota cuando esté cerca!",
    "backButton": "Atrás",
    "gameWinner": "¡Gana!",
    "gameDraw": "¡Es un Empate!",
    "backToMenu": "Volver al Menú"
  }
};

const appLocale = '{{APP_LOCALE}}';
const browserLocale = navigator.languages?.[0] || navigator.language || 'en-US';
const findMatchingLocale = (locale) => {
  if (TRANSLATIONS[locale]) return locale;
  const lang = locale.split('-')[0];
  const match = Object.keys(TRANSLATIONS).find(key => key.startsWith(lang + '-'));
  return match || 'en-US';
};
const locale = (appLocale !== '{{APP_LOCALE}}') ? findMatchingLocale(appLocale) : findMatchingLocale(browserLocale);
const t = (key) => TRANSLATIONS[locale]?.[key] || TRANSLATIONS['en-US'][key] || key;

const GAME_WIDTH = 800;
const GAME_HEIGHT = 400;
const GROUND_HEIGHT = 80;
const SLIME_RADIUS = 40;
const BALL_RADIUS = 10;
const GOAL_WIDTH = 80;
const GOAL_HEIGHT = 120;
const GRAVITY = 0.6;
const SLIME_SPEED = 5;
const SLIME_JUMP_POWER = -12;
const BALL_DAMPING = 0.99;
const BALL_BOUNCE_DAMPING = 0.8;
const MAX_BALL_SPEED = 13;
const SlimeSoccer = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const keysRef = useRef({});
  const lastFrameTimeRef = useRef(0);
  
  const [gameMode, setGameMode] = useState(null);
  const [playerMode, setPlayerMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState({ left: 0, right: 0 });
  const [gameStarted, setGameStarted] = useState(false);
  const [winner, setWinner] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [touchControls, setTouchControls] = useState({ left: false, right: false, jump: false, grab: false });
  
  const gameStateRef = useRef({
    leftSlime: {
      x: 200, y: GAME_HEIGHT - GROUND_HEIGHT, vx: 0, vy: 0,
      isGrabbing: false, hasBall: false, goalLineTime: 0,
      targetX: 200, lastDecisionTime: 0, decisionCooldown: 0, stableStart: true
    },
    rightSlime: {
      x: 600, y: GAME_HEIGHT - GROUND_HEIGHT, vx: 0, vy: 0,
      isGrabbing: false, hasBall: false, goalLineTime: 0
    },
    ball: {
      x: GAME_WIDTH / 2, y: 150, vx: 0, vy: 0,
      grabbedBy: null, grabAngle: 0, grabAngularVelocity: 0
    }
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      e.preventDefault();
      keysRef.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e) => {
      if (e.target.tagName === 'INPUT') return;
      e.preventDefault();
      keysRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleTouchStart = (control) => {
    setTouchControls(prev => ({ ...prev, [control]: true }));
  };

  const handleTouchEnd = (control) => {
    setTouchControls(prev => ({ ...prev, [control]: false }));
  };

  useEffect(() => {
    if (gameStarted && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setGameStarted(false);
            determineWinner();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted, timeLeft]);

  const determineWinner = () => {
    if (score.left > score.right) setWinner(t('cyanTeam'));
    else if (score.right > score.left) setWinner(t('redTeam'));
    else setWinner('Draw');
  };

  const resetPositions = () => {
    const state = gameStateRef.current;
    Object.assign(state.leftSlime, {
      x: 200, y: GAME_HEIGHT - GROUND_HEIGHT, vx: 0, vy: 0,
      isGrabbing: false, hasBall: false, goalLineTime: 0,
      targetX: 200, lastDecisionTime: 0, decisionCooldown: 0, stableStart: true
    });
    Object.assign(state.rightSlime, {
      x: 600, y: GAME_HEIGHT - GROUND_HEIGHT, vx: 0, vy: 0,
      isGrabbing: false, hasBall: false, goalLineTime: 0
    });
    Object.assign(state.ball, {
      x: GAME_WIDTH / 2, y: 150, vx: 0, vy: 0,
      grabbedBy: null, grabAngle: 0, grabAngularVelocity: 0
    });
  };

  const resetGame = () => {
    resetPositions();
    setScore({ left: 0, right: 0 });
    setWinner(null);
  };

  const startGame = (mode) => {
    const times = { '1min': 60, '2min': 120, '4min': 240, '8min': 480, 'worldcup': 300 };
    resetGame();
    setGameMode(mode);
    setTimeLeft(times[mode]);
    setGameStarted(true);
  };
  const updateAI = useCallback(() => {
    if (playerMode !== 'single') return;
    const state = gameStateRef.current;
    const ai = state.leftSlime;
    const ball = state.ball;
    
    const difficultySettings = {
      easy: { speed: 0.5, reaction: 30, accuracy: 0.4, aggression: 0.2, jumpChance: 0.3, grabDistance: 80 },
      medium: { speed: 0.8, reaction: 15, accuracy: 0.7, aggression: 0.6, jumpChance: 0.6, grabDistance: 60 },
      hard: { speed: 1.2, reaction: 5, accuracy: 0.95, aggression: 1.0, jumpChance: 0.9, grabDistance: 40 }
    };
    const settings = difficultySettings[difficulty] || difficultySettings.medium;
    
    if (ai.decisionCooldown > 0) {
      ai.decisionCooldown--;
      const diff = ai.targetX - ai.x;
      if (Math.abs(diff) > 10) ai.vx = Math.sign(diff) * SLIME_SPEED * settings.speed * Math.min(Math.abs(diff) / 50, 1);
      else ai.vx = 0;
      return;
    }
    
    if (ai.stableStart && timeLeft > 55) {
      ai.targetX = 200;
      ai.vx = 0;
      if (Math.abs(ball.x - ai.x) < 150 || timeLeft <= 55) {
        ai.stableStart = false;
        ai.decisionCooldown = settings.reaction;
      }
      return;
    }
    
    let newTargetX = ai.targetX;
    let shouldJump = false;
    let shouldGrab = false;
    const aiDistanceToBall = Math.abs(ai.x - ball.x);
    const ballHeight = GAME_HEIGHT - GROUND_HEIGHT - ball.y;
    
    // Offensive play - chase ball aggressively
    if (ball.x > GAME_WIDTH * (0.3 + settings.aggression * 0.3) && ball.vx >= -2) {
      newTargetX = ball.x - (20 + 20 * settings.accuracy);
      if (aiDistanceToBall < settings.grabDistance && ballHeight < 40 && !ai.hasBall) shouldGrab = true;
      if (aiDistanceToBall < 80 + 40 * settings.accuracy && ballHeight > 25 && ballHeight < 100 && Math.random() < settings.jumpChance) shouldJump = true;
      
      // Hard mode: predict ball movement
      if (difficulty === 'hard' && Math.abs(ball.vx) > 1) {
        newTargetX = ball.x + ball.vx * 10 - 30;
      }
    } 
    // Defensive play - protect goal
    else if (ball.x < GAME_WIDTH * (0.7 - settings.aggression * 0.2) || ball.vx < -1) {
      newTargetX = Math.max(ball.x - (5 + 15 * settings.accuracy), SLIME_RADIUS + 10);
      if (aiDistanceToBall < 100 + 50 * settings.accuracy && ballHeight < 120 && Math.random() < settings.jumpChance) shouldJump = true;
      
      // Emergency defense for hard mode
      if (difficulty === 'hard' && ball.x < GOAL_WIDTH * 3 && ball.vx < -3) {
        newTargetX = SLIME_RADIUS + 20;
        shouldJump = true;
      }
    } 
    // Midfield positioning
    else {
      newTargetX = GAME_WIDTH * (0.25 + settings.aggression * 0.15);
      
      // Hard mode: anticipate opponent moves
      if (difficulty === 'hard' && state.rightSlime.vx !== 0) {
        newTargetX += state.rightSlime.vx > 0 ? -30 : 30;
      }
    }
    
    const targetDiff = Math.abs(newTargetX - ai.targetX);
    const minChange = difficulty === 'easy' ? 20 : difficulty === 'medium' ? 15 : 10;
    
    if (targetDiff > minChange) {
      ai.targetX = newTargetX;
      ai.decisionCooldown = settings.reaction;
    }
    
    ai.isGrabbing = shouldGrab;
    
    const diff = ai.targetX - ai.x;
    if (Math.abs(diff) > 10) ai.vx = Math.sign(diff) * SLIME_SPEED * settings.speed * Math.min(Math.abs(diff) / 50, 1);
    else ai.vx = 0;
    
    if (shouldJump && ai.vy === 0) {
      const jumpPower = difficulty === 'easy' ? SLIME_JUMP_POWER * 0.8 : 
                       difficulty === 'medium' ? SLIME_JUMP_POWER : 
                       SLIME_JUMP_POWER * 1.1;
      ai.vy = jumpPower;
    }
  }, [playerMode, timeLeft, difficulty]);

  const updatePhysics = useCallback(() => {
    const state = gameStateRef.current;
    const keys = keysRef.current;
    
    if (playerMode === 'multi') {
      if (keys['a']) state.leftSlime.vx = -SLIME_SPEED;
      else if (keys['d']) state.leftSlime.vx = SLIME_SPEED;
      else state.leftSlime.vx = 0;
      if (keys['w'] && state.leftSlime.y >= GAME_HEIGHT - GROUND_HEIGHT - 1) state.leftSlime.vy = SLIME_JUMP_POWER;
      state.leftSlime.isGrabbing = keys['s'];
      
      if (keys['arrowleft']) state.rightSlime.vx = -SLIME_SPEED;
      else if (keys['arrowright']) state.rightSlime.vx = SLIME_SPEED;
      else state.rightSlime.vx = 0;
      if (keys['arrowup'] && state.rightSlime.y >= GAME_HEIGHT - GROUND_HEIGHT - 1) state.rightSlime.vy = SLIME_JUMP_POWER;
      state.rightSlime.isGrabbing = keys['arrowdown'];
    } else {
      // Mobile touch controls or keyboard
      if (keys['arrowleft'] || touchControls.left) state.rightSlime.vx = -SLIME_SPEED;
      else if (keys['arrowright'] || touchControls.right) state.rightSlime.vx = SLIME_SPEED;
      else state.rightSlime.vx = 0;
      if ((keys['arrowup'] || touchControls.jump) && state.rightSlime.y >= GAME_HEIGHT - GROUND_HEIGHT - 1) state.rightSlime.vy = SLIME_JUMP_POWER;
      state.rightSlime.isGrabbing = keys['arrowdown'] || touchControls.grab;
      updateAI();
    }
    
    [state.leftSlime, state.rightSlime].forEach((slime, index) => {
      slime.vy += GRAVITY;
      slime.x += slime.vx;
      slime.y += slime.vy;
      
      if (slime.x < SLIME_RADIUS) slime.x = SLIME_RADIUS;
      if (slime.x > GAME_WIDTH - SLIME_RADIUS) slime.x = GAME_WIDTH - SLIME_RADIUS;
      if (slime.y > GAME_HEIGHT - GROUND_HEIGHT) {
        slime.y = GAME_HEIGHT - GROUND_HEIGHT;
        slime.vy = 0;
      }
      
      const isLeftSlime = index === 0;
      const inOwnGoal = (isLeftSlime && slime.x < GOAL_WIDTH) || (!isLeftSlime && slime.x > GAME_WIDTH - GOAL_WIDTH);
      if (inOwnGoal) {
        slime.goalLineTime += 1/60;
        if (slime.goalLineTime >= 1) {
          setScore(prev => isLeftSlime ? { ...prev, right: prev.right + 1 } : { ...prev, left: prev.left + 1 });
          resetPositions();
        }
      } else {
        slime.goalLineTime = 0;
      }
    });
    
    if (state.ball.grabbedBy) {
      const grabber = state.ball.grabbedBy === 'left' ? state.leftSlime : state.rightSlime;
      state.ball.grabAngularVelocity += -grabber.vx * 0.008 * (state.ball.grabbedBy === 'left' ? 1 : -1);
      state.ball.grabAngularVelocity *= 0.85;
      state.ball.grabAngle += state.ball.grabAngularVelocity;
      
      if (state.ball.grabbedBy === 'left') {
        state.ball.grabAngle = Math.max(-Math.PI/2, Math.min(Math.PI/2, state.ball.grabAngle));
      } else {
        while (state.ball.grabAngle < 0) state.ball.grabAngle += Math.PI * 2;
        while (state.ball.grabAngle > Math.PI * 2) state.ball.grabAngle -= Math.PI * 2;
        if (state.ball.grabAngle < Math.PI/2) state.ball.grabAngle = Math.PI/2;
        if (state.ball.grabAngle > 3*Math.PI/2) state.ball.grabAngle = 3*Math.PI/2;
      }
      
      const holdDistance = SLIME_RADIUS + BALL_RADIUS - 5;
      state.ball.x = grabber.x + Math.cos(state.ball.grabAngle) * holdDistance;
      state.ball.y = grabber.y + Math.sin(state.ball.grabAngle) * holdDistance;
      state.ball.vx = grabber.vx;
      state.ball.vy = grabber.vy;
      
      if (!grabber.isGrabbing) {
        const releaseSpeed = Math.abs(state.ball.grabAngularVelocity) * 20;
        state.ball.vx = grabber.vx * 1.5 + Math.cos(state.ball.grabAngle) * (3 + releaseSpeed);
        state.ball.vy = grabber.vy - 2 + Math.sin(state.ball.grabAngle) * releaseSpeed * 0.3;
        state.ball.grabbedBy = null;
        state.ball.grabAngle = 0;
        state.ball.grabAngularVelocity = 0;
        grabber.hasBall = false;
      }
    } else {
      state.ball.vy += GRAVITY;
      state.ball.vx *= BALL_DAMPING;
      state.ball.x += state.ball.vx;
      state.ball.y += state.ball.vy;
    }
    
    if (state.ball.x < BALL_RADIUS) {
      state.ball.x = BALL_RADIUS;
      state.ball.vx = -state.ball.vx * BALL_BOUNCE_DAMPING;
    }
    if (state.ball.x > GAME_WIDTH - BALL_RADIUS) {
      state.ball.x = GAME_WIDTH - BALL_RADIUS;
      state.ball.vx = -state.ball.vx * BALL_BOUNCE_DAMPING;
    }
    if (state.ball.y > GAME_HEIGHT - GROUND_HEIGHT - BALL_RADIUS) {
      state.ball.y = GAME_HEIGHT - GROUND_HEIGHT - BALL_RADIUS;
      state.ball.vy = -state.ball.vy * BALL_BOUNCE_DAMPING;
    }
    if (state.ball.y < BALL_RADIUS) {
      state.ball.y = BALL_RADIUS;
      state.ball.vy = -state.ball.vy * BALL_BOUNCE_DAMPING;
    }
    
    if (state.ball.x <= BALL_RADIUS && state.ball.y > GAME_HEIGHT - GROUND_HEIGHT - GOAL_HEIGHT) {
      setScore(prev => ({ ...prev, right: prev.right + 1 }));
      resetPositions();
    } else if (state.ball.x >= GAME_WIDTH - BALL_RADIUS && state.ball.y > GAME_HEIGHT - GROUND_HEIGHT - GOAL_HEIGHT) {
      setScore(prev => ({ ...prev, left: prev.left + 1 }));
      resetPositions();
    }
    
    [state.leftSlime, state.rightSlime].forEach((slime, index) => {
      const slimeName = index === 0 ? 'left' : 'right';
      const otherSlime = index === 0 ? state.rightSlime : state.leftSlime;
      const dx = state.ball.x - slime.x;
      const dy = state.ball.y - slime.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < SLIME_RADIUS + BALL_RADIUS) {
        if (state.ball.grabbedBy && state.ball.grabbedBy !== slimeName) {
          const speed = Math.sqrt(slime.vx * slime.vx + slime.vy * slime.vy);
          if (speed > 2 || Math.abs(slime.vy) > 5) {
            const angle = Math.atan2(dy, dx);
            state.ball.grabbedBy = null;
            state.ball.grabAngle = 0;
            state.ball.grabAngularVelocity = 0;
            otherSlime.hasBall = false;
            state.ball.vx = Math.cos(angle) * 8 + slime.vx;
            state.ball.vy = Math.sin(angle) * 8 + slime.vy;
          }
        } else if (slime.isGrabbing && !state.ball.grabbedBy) {
          state.ball.grabbedBy = slimeName;
          state.ball.grabAngle = Math.atan2(dy, dx);
          state.ball.grabAngularVelocity = 0;
          slime.hasBall = true;
        } else if (!state.ball.grabbedBy) {
          const angle = Math.atan2(dy, dx);
          if (state.ball.y < slime.y || Math.abs(angle) < Math.PI * 0.5) {
            state.ball.x = slime.x + Math.cos(angle) * (SLIME_RADIUS + BALL_RADIUS);
            state.ball.y = slime.y + Math.sin(angle) * (SLIME_RADIUS + BALL_RADIUS);
            const speed = Math.sqrt(state.ball.vx * state.ball.vx + state.ball.vy * state.ball.vy);
            state.ball.vx = Math.cos(angle) * speed * 1.5 + slime.vx * 0.5;
            state.ball.vy = Math.sin(angle) * speed * 1.5 + slime.vy * 0.5;
            const newSpeed = Math.sqrt(state.ball.vx * state.ball.vx + state.ball.vy * state.ball.vy);
            if (newSpeed > MAX_BALL_SPEED) {
              const scale = MAX_BALL_SPEED / newSpeed;
              state.ball.vx *= scale;
              state.ball.vy *= scale;
            }
          }
        }
      }
    });
  }, [playerMode, updateAI, touchControls.left, touchControls.right, touchControls.jump, touchControls.grab]);
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const state = gameStateRef.current;
    
    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#4169E1');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Grass texture
    const grassGradient = ctx.createLinearGradient(0, GAME_HEIGHT - GROUND_HEIGHT, 0, GAME_HEIGHT);
    grassGradient.addColorStop(0, '#32CD32');
    grassGradient.addColorStop(1, '#228B22');
    ctx.fillStyle = grassGradient;
    ctx.fillRect(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, GROUND_HEIGHT);
    
    // Field lines
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(GAME_WIDTH/2, GAME_HEIGHT - GROUND_HEIGHT);
    ctx.lineTo(GAME_WIDTH/2, GAME_HEIGHT - GROUND_HEIGHT - 50);
    ctx.arc(GAME_WIDTH/2, GAME_HEIGHT - GROUND_HEIGHT - 25, 25, 0, Math.PI * 2);
    ctx.stroke();
    
    // Enhanced goals with shadows
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    
    // Left goal
    ctx.beginPath();
    ctx.moveTo(0, GAME_HEIGHT - GROUND_HEIGHT);
    ctx.lineTo(GOAL_WIDTH, GAME_HEIGHT - GROUND_HEIGHT);
    ctx.lineTo(GOAL_WIDTH, GAME_HEIGHT - GROUND_HEIGHT - GOAL_HEIGHT);
    ctx.lineTo(0, GAME_HEIGHT - GROUND_HEIGHT - GOAL_HEIGHT);
    ctx.stroke();
    
    // Right goal
    ctx.beginPath();
    ctx.moveTo(GAME_WIDTH, GAME_HEIGHT - GROUND_HEIGHT);
    ctx.lineTo(GAME_WIDTH - GOAL_WIDTH, GAME_HEIGHT - GROUND_HEIGHT);
    ctx.lineTo(GAME_WIDTH - GOAL_WIDTH, GAME_HEIGHT - GROUND_HEIGHT - GOAL_HEIGHT);
    ctx.lineTo(GAME_WIDTH, GAME_HEIGHT - GROUND_HEIGHT - GOAL_HEIGHT);
    ctx.stroke();
    
    ctx.shadowColor = 'transparent';
    
    const drawSlime = (slime, isRight, color, accent) => {
      // Slime shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(slime.x, GAME_HEIGHT - GROUND_HEIGHT + 5, SLIME_RADIUS * 0.8, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Slime body with gradient
      const slimeGradient = ctx.createRadialGradient(slime.x - 10, slime.y - 10, 0, slime.x, slime.y, SLIME_RADIUS);
      slimeGradient.addColorStop(0, color);
      slimeGradient.addColorStop(1, accent);
      ctx.fillStyle = slimeGradient;
      ctx.beginPath();
      ctx.arc(slime.x, slime.y, SLIME_RADIUS, Math.PI, 0);
      ctx.fill();
      
      // Slime shine
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(slime.x - 8, slime.y - 15, 12, 0, Math.PI * 2);
      ctx.fill();
      
      // Eyes with animation
      const eyeOffset = Math.sin(Date.now() * 0.003) * 2;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      const eyeX = slime.x + (isRight ? -SLIME_RADIUS * 0.3 : SLIME_RADIUS * 0.3);
      ctx.arc(eyeX, slime.y - SLIME_RADIUS * 0.3 + eyeOffset, 6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      const pupilX = slime.x + (isRight ? -SLIME_RADIUS * 0.35 : SLIME_RADIUS * 0.35);
      ctx.arc(pupilX, slime.y - SLIME_RADIUS * 0.3 + eyeOffset, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Grab indicator
      if (slime.isGrabbing) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(slime.x, slime.y, SLIME_RADIUS + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };
    
    drawSlime(state.leftSlime, false, '#00CED1', '#008B8B');
    drawSlime(state.rightSlime, true, '#DC143C', '#8B0000');
    
    // Enhanced ball with glow
    const ballGlow = ctx.createRadialGradient(state.ball.x, state.ball.y, 0, state.ball.x, state.ball.y, BALL_RADIUS * 2);
    ballGlow.addColorStop(0, 'rgba(255,215,0,0.8)');
    ballGlow.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = ballGlow;
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, BALL_RADIUS * 2, 0, Math.PI * 2);
    ctx.fill();
    
    const ballGradient = ctx.createRadialGradient(state.ball.x - 3, state.ball.y - 3, 0, state.ball.x, state.ball.y, BALL_RADIUS);
    ballGradient.addColorStop(0, '#FFD700');
    ballGradient.addColorStop(1, '#FFA500');
    ctx.fillStyle = ballGradient;
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    
    // Ball highlight
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(state.ball.x - 3, state.ball.y - 3, 3, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const gameLoop = useCallback((currentTime) => {
    if (gameStarted) {
      if (currentTime - lastFrameTimeRef.current >= 16.67) {
        updatePhysics();
        draw();
        lastFrameTimeRef.current = currentTime;
      }
      animationRef.current = requestAnimationFrame(gameLoop);
    }
  }, [gameStarted, updatePhysics, draw]);

  useEffect(() => {
    if (gameStarted) animationRef.current = requestAnimationFrame(gameLoop);
    return () => animationRef.current && cancelAnimationFrame(animationRef.current);
  }, [gameStarted, gameLoop]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-slate-900/40 to-slate-900"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>
      
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4 text-white">
        {!gameStarted && !gameMode && !playerMode && (
          <div className="text-center animate-fade-in">
            <div className="mb-12 relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-3xl blur-xl opacity-30 animate-pulse"></div>
              <div className="relative bg-black/20 backdrop-blur-xl rounded-3xl p-8 border border-white/10">
                <h1 className="text-7xl font-black mb-6 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-pulse">
                  ⚽ {t('gameTitle')} ⚽
                </h1>
                <div className="w-48 h-2 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 mx-auto rounded-full opacity-80"></div>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-6 md:gap-8 justify-center items-center">
              <button 
                onClick={() => setPlayerMode('single')} 
                className="group relative overflow-hidden px-8 md:px-12 py-6 md:py-8 bg-gradient-to-br from-emerald-500/80 to-teal-600/80 backdrop-blur-xl rounded-2xl border border-emerald-400/30 text-lg md:text-xl font-bold transform hover:scale-110 transition-all duration-300 shadow-2xl hover:shadow-emerald-500/25 w-full md:w-auto"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-4">
                  <span className="text-3xl animate-bounce">🤖</span>
                  <div>
                    <div className="text-xl">{t('singlePlayer')}</div>
                    <div className="text-sm opacity-70">vs AI</div>
                  </div>
                </div>
              </button>
              
              <button 
                onClick={() => setPlayerMode('multi')} 
                className="group relative overflow-hidden px-8 md:px-12 py-6 md:py-8 bg-gradient-to-br from-purple-500/80 to-pink-600/80 backdrop-blur-xl rounded-2xl border border-purple-400/30 text-lg md:text-xl font-bold transform hover:scale-110 transition-all duration-300 shadow-2xl hover:shadow-purple-500/25 w-full md:w-auto"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-4">
                  <span className="text-3xl animate-bounce delay-100">👥</span>
                  <div>
                    <div className="text-xl">{t('multiplayer')}</div>
                    <div className="text-sm opacity-70">Local 1v1</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}
        
        {playerMode === 'single' && !difficulty && (
          <div className="text-center animate-slide-in max-w-4xl w-full">
            <div className="mb-12">
              <h2 className="text-5xl font-black mb-6 bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                {t('selectDifficulty')}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-12">
              {[
                { diff: 'easy', icon: '😊', label: t('easy'), color: 'from-green-500 to-emerald-500', desc: 'Relaxed AI' },
                { diff: 'medium', icon: '😐', label: t('medium'), color: 'from-yellow-500 to-orange-500', desc: 'Balanced AI' },
                { diff: 'hard', icon: '😤', label: t('hard'), color: 'from-red-500 to-pink-500', desc: 'Expert AI' }
              ].map(({ diff, icon, label, color, desc }) => (
                <button 
                  key={diff} 
                  onClick={() => setDifficulty(diff)} 
                  className={`group relative overflow-hidden px-10 py-8 bg-gradient-to-br ${color}/80 backdrop-blur-xl rounded-3xl border border-white/20 font-bold transform hover:scale-110 transition-all duration-300 shadow-2xl hover:shadow-lg`}
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative">
                    <div className="text-5xl mb-4 animate-bounce">{icon}</div>
                    <div className="text-2xl font-black mb-2">{label}</div>
                    <div className="text-sm opacity-80">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => setPlayerMode(null)} 
              className="px-8 py-4 bg-gray-800/50 backdrop-blur-xl hover:bg-gray-700/50 rounded-xl border border-gray-600/30 font-semibold transition-all duration-300 hover:scale-105"
            >
              ← {t('backButton')}
            </button>
          </div>
        )}
        
        {((playerMode === 'single' && difficulty) || playerMode === 'multi') && !gameStarted && !gameMode && (
          <div className="text-center animate-slide-in max-w-6xl w-full">
            <div className="mb-12">
              <h2 className="text-5xl font-black mb-6 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                {t('selectDuration')}
              </h2>
              
              <div className="flex items-center justify-center gap-8 mb-8">
                <div className="relative">
                  <div className="absolute -inset-2 bg-cyan-500/30 rounded-xl blur-lg"></div>
                  <div className="relative px-6 py-3 bg-cyan-500/80 backdrop-blur-xl rounded-xl border border-cyan-400/30 text-white font-bold text-lg">
                    {t('cyanTeam')}
                  </div>
                </div>
                <div className="text-4xl animate-pulse">⚔️</div>
                <div className="relative">
                  <div className="absolute -inset-2 bg-red-500/30 rounded-xl blur-lg"></div>
                  <div className="relative px-6 py-3 bg-red-500/80 backdrop-blur-xl rounded-xl border border-red-400/30 text-white font-bold text-lg">
                    {t('redTeam')}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6 mb-12">
              {[
                { mode: '1min', icon: '⚡', label: t('oneMinute'), color: 'from-yellow-500 to-orange-500' },
                { mode: '2min', icon: '🔥', label: t('twoMinutes'), color: 'from-orange-500 to-red-500' },
                { mode: '4min', icon: '⭐', label: t('fourMinutes'), color: 'from-blue-500 to-purple-500' },
                { mode: '8min', icon: '🏆', label: t('eightMinutes'), color: 'from-purple-500 to-pink-500' },
                { mode: 'worldcup', icon: '🌍', label: t('worldCup'), color: 'from-green-500 to-emerald-500' }
              ].map(({ mode, icon, label, color }) => (
                <button 
                  key={mode} 
                  onClick={() => startGame(mode)} 
                  className={`group relative overflow-hidden px-8 py-6 bg-gradient-to-br ${color}/80 backdrop-blur-xl rounded-2xl border border-white/20 font-bold transform hover:scale-110 transition-all duration-300 shadow-2xl hover:shadow-lg`}
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative">
                    <div className="text-3xl mb-2 animate-bounce">{icon}</div>
                    <div className="text-sm font-semibold">{label}</div>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="relative mb-8">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-3xl blur-xl"></div>
              <div className="relative bg-black/30 backdrop-blur-2xl rounded-3xl p-8 border border-white/10">
                <h3 className="text-2xl font-bold mb-6 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">🎮 Controls</h3>
                {playerMode === 'multi' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-cyan-500/20 backdrop-blur-xl p-6 rounded-2xl border border-cyan-400/30">
                      <div className="font-bold text-cyan-300 mb-3 text-lg">Left Player (Cyan)</div>
                      <div className="text-cyan-100">{t('multiplayerControls1')}</div>
                    </div>
                    <div className="bg-red-500/20 backdrop-blur-xl p-6 rounded-2xl border border-red-400/30">
                      <div className="font-bold text-red-300 mb-3 text-lg">Right Player (Red)</div>
                      <div className="text-red-100">{t('multiplayerControls2')}</div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-green-300 text-lg">{t('singlePlayerControls1')}</p>
                    <p className="text-yellow-300 text-lg">{t('singlePlayerControls2')}</p>
                  </div>
                )}
              </div>
            </div>
            
            <button 
              onClick={() => playerMode === 'single' ? setDifficulty(null) : setPlayerMode(null)} 
              className="px-8 py-4 bg-gray-800/50 backdrop-blur-xl hover:bg-gray-700/50 rounded-xl border border-gray-600/30 font-semibold transition-all duration-300 hover:scale-105"
            >
              ← {t('backButton')}
            </button>
          </div>
        )}
        
        {(gameStarted || winner) && (
          <div className="flex flex-col items-center animate-fade-in w-full max-w-4xl">
            <div className="relative w-full mb-4">
              <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-2xl blur-xl"></div>
              <div className="relative bg-black/40 backdrop-blur-2xl px-8 py-6 rounded-2xl border border-white/20 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-6 h-6 bg-gradient-to-r from-cyan-400 to-cyan-600 rounded-full animate-pulse shadow-lg shadow-cyan-500/50"></div>
                  <span className="text-2xl font-black bg-gradient-to-r from-cyan-300 to-cyan-500 bg-clip-text text-transparent">
                    {t('cyanTeam')}: {score.left}
                  </span>
                </div>
                
                <div className="text-center">
                  <div className="text-4xl font-mono font-black bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">
                    {formatTime(timeLeft)}
                  </div>
                  <div className="text-xs text-gray-400 font-semibold tracking-wider">TIME LEFT</div>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-black bg-gradient-to-r from-red-300 to-red-500 bg-clip-text text-transparent">
                    {score.right} : {t('redTeam')}
                  </span>
                  <div className="w-6 h-6 bg-gradient-to-r from-red-400 to-red-600 rounded-full animate-pulse shadow-lg shadow-red-500/50"></div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-2xl"></div>
              <div className="relative">
                <canvas 
                  ref={canvasRef} 
                  width={GAME_WIDTH} 
                  height={GAME_HEIGHT} 
                  className={`border-4 border-white/20 rounded-2xl shadow-2xl backdrop-blur-xl ${isMobile ? 'max-w-full h-auto' : ''}`}
                  style={isMobile ? { width: '100%', maxWidth: '400px' } : {}}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent rounded-2xl pointer-events-none"></div>
              </div>
            </div>
            
            {/* Mobile Touch Controls */}
            {isMobile && gameStarted && (
              <div className="mt-6 w-full max-w-md">
                <div className="grid grid-cols-4 gap-4">
                  <button
                    onTouchStart={() => handleTouchStart('left')}
                    onTouchEnd={() => handleTouchEnd('left')}
                    onMouseDown={() => handleTouchStart('left')}
                    onMouseUp={() => handleTouchEnd('left')}
                    className="bg-blue-500/80 backdrop-blur-xl rounded-xl p-4 text-2xl font-bold border border-blue-400/30 active:bg-blue-400/80 select-none"
                  >
                    ←
                  </button>
                  <button
                    onTouchStart={() => handleTouchStart('jump')}
                    onTouchEnd={() => handleTouchEnd('jump')}
                    onMouseDown={() => handleTouchStart('jump')}
                    onMouseUp={() => handleTouchEnd('jump')}
                    className="bg-green-500/80 backdrop-blur-xl rounded-xl p-4 text-xl font-bold border border-green-400/30 active:bg-green-400/80 select-none"
                  >
                    JUMP
                  </button>
                  <button
                    onTouchStart={() => handleTouchStart('grab')}
                    onTouchEnd={() => handleTouchEnd('grab')}
                    onMouseDown={() => handleTouchStart('grab')}
                    onMouseUp={() => handleTouchEnd('grab')}
                    className="bg-yellow-500/80 backdrop-blur-xl rounded-xl p-4 text-xl font-bold border border-yellow-400/30 active:bg-yellow-400/80 select-none"
                  >
                    GRAB
                  </button>
                  <button
                    onTouchStart={() => handleTouchStart('right')}
                    onTouchEnd={() => handleTouchEnd('right')}
                    onMouseDown={() => handleTouchStart('right')}
                    onMouseUp={() => handleTouchEnd('right')}
                    className="bg-blue-500/80 backdrop-blur-xl rounded-xl p-4 text-2xl font-bold border border-blue-400/30 active:bg-blue-400/80 select-none"
                  >
                    →
                  </button>
                </div>
                <div className="text-center mt-3 text-sm text-gray-400">
                  Touch controls for mobile
                </div>
              </div>
            )}
            
            {winner && (
              <div className="mt-12 text-center animate-bounce-in">
                <div className="relative">
                  <div className="absolute -inset-8 bg-gradient-to-r from-yellow-400/30 via-orange-400/30 to-red-400/30 rounded-3xl blur-2xl animate-pulse"></div>
                  <div className="relative bg-gradient-to-br from-yellow-400 via-orange-400 to-red-400 p-12 rounded-3xl shadow-2xl border-4 border-white/20">
                    <div className="text-8xl mb-6 animate-bounce">{winner === 'Draw' ? '🤝' : '🏆'}</div>
                    <h2 className="text-5xl font-black mb-8 text-gray-900">
                      {winner === 'Draw' ? t('gameDraw') : `${winner} ${t('gameWinner')}`}
                    </h2>
                    <button 
                      onClick={() => { setGameMode(null); setPlayerMode(null); setDifficulty(null); setWinner(null); }} 
                      className="px-12 py-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-2xl text-white font-black text-xl transform hover:scale-110 transition-all duration-300 shadow-2xl border-2 border-white/20"
                    >
                      🏠 {t('backToMenu')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SlimeSoccer;