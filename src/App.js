import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const socket = io('https://bluff-backend-jckf.onrender.com');

function App() {
  const [roomId] = useState('room-abc');
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState(null);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('playerName') || '');
  const [currentTurn, setCurrentTurn] = useState(null);
  const [hands, setHands] = useState({});
  const [selected, setSelected] = useState([]);
  const [tableCards, setTableCards] = useState([]);
  const [message, setMessage] = useState('');
  const [lastPlayed, setLastPlayed] = useState(null);
  const [revealedCards, setRevealedCards] = useState([]);
  const [declaredRank, setDeclaredRank] = useState('');
  const [winner, setWinner] = useState(null);
  const [gameJoined, setGameJoined] = useState(false);

  const handRef = useRef(null);
  const hand = playerId ? (hands[playerId] || []) : [];
  const opponents = players.filter(p => p.id !== playerId);

  const pluralizeRank = (count, rank) => {
    if (!rank) return '';
    const rankNames = {'2':'Two','3':'Three','4':'Four','5':'Five','6':'Six','7':'Seven','8':'Eight','9':'Nine','10':'Ten','J':'Jack','Q':'Queen','K':'King','A':'Ace'};
    const baseName = rankNames[rank] || rank;
    if (rank === '6') return count === 1 ? `1 Six` : `${count} Sixes`;
    return count === 1 ? `1 ${baseName}` : `${count} ${baseName}s`;
  };

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server with id:', socket.id);
      setPlayerId(socket.id);
    });

    socket.on('room state', setPlayers);
    socket.on('game started', ({ hands, turn, players }) => {
        setHands(hands);
        setCurrentTurn(turn);
        setPlayers(players);
        setSelected([]);
        setTableCards([]);
        setLastPlayed(null);
        setDeclaredRank('');
        setRevealedCards([]);
        setMessage('');
        setWinner(null);
    });
    socket.on('turn', setCurrentTurn);
    socket.on('cards played', ({ whoPlayed, playedCards, declaredRank }) => {
      setTableCards(prev => [...prev, ...playedCards]); 
      setLastPlayed({ playerId: whoPlayed, cards: playedCards, declaredRank });
      setDeclaredRank(declaredRank);
      if (whoPlayed === socket.id) setSelected([]);
    });
    socket.on('update hands', setHands);
    socket.on('table cleared', () => {
      setTableCards([]);
      setLastPlayed(null);
      setDeclaredRank('');
      setRevealedCards([]);
    });
    socket.on('reveal cards', (cards) => {
        setRevealedCards(cards);
        setTimeout(() => setRevealedCards([]), 3000);
    });
    socket.on('message', setMessage);
    socket.on('error message', alert);
    socket.on('game over', ({ winnerName }) => setWinner(winnerName));

    return () => {
      socket.off('connect');
      socket.off('room state');
      socket.off('game started');
      socket.off('turn');
      socket.off('cards played');
      socket.off('update hands');
      socket.off('table cleared');
      socket.off('reveal cards');
      socket.off('message');
      socket.off('error message');
      socket.off('game over');
    };
  }, []);

  const joinGame = () => {
    let nameToSet = playerName.trim();
    if (!nameToSet) {
      nameToSet = `Player #${Math.floor(Math.random() * 1000)}`;
    }
    setPlayerName(nameToSet);
    localStorage.setItem('playerName', nameToSet);
    socket.emit('join room', { roomId, playerName: nameToSet });
    setGameJoined(true);
  };
  
  const toggleCard = (card) => {
    setSelected(prev => prev.includes(card) ? prev.filter(c => c !== card) : [...prev, card]);
  };
  
  const playCards = () => {
    if (selected.length === 0) return alert("Select at least one card to play.");
    let currentDeclaredRank = declaredRank;
    if (!currentDeclaredRank) {
      const inputRank = prompt("Declare the rank for this round (e.g., 2, J, A):");
      if (!inputRank) return;
      currentDeclaredRank = inputRank.trim().toUpperCase();
    }
    socket.emit('play cards', { roomId, playedCards: selected, declaredRank: currentDeclaredRank });
  };
  
  const skipTurn = () => socket.emit('skip turn', { roomId });
  const callBluff = () => socket.emit('call bluff', { roomId });
  const requestNewGame = () => socket.emit('request new game', { roomId });
  const scrollHand = (direction) => handRef.current?.scrollBy({ left: direction * 200, behavior: 'smooth' });
  
  const isMyTurn = currentTurn === playerId;

  if (!gameJoined) {
    return (
        <div className="name-entry-container">
            <h1>Welcome to Bluff!</h1>
            <p>Please enter your name to join the game.</p>
            <div className="name-changer">
                <input 
                    type="text" 
                    value={playerName} 
                    onChange={(e) => setPlayerName(e.target.value)} 
                    placeholder="Enter your name" 
                    onKeyPress={(e) => e.key === 'Enter' && joinGame()}
                />
                <button onClick={joinGame}>Join Game</button>
            </div>
        </div>
    )
  }
  
  return (
    <div className="game-container">
      {winner && (
        <div className="game-over-overlay">
          <div className="game-over-box">
            <h2>Game Over</h2>
            <p>🎉 {winner} wins! 🎉</p>
            <button onClick={requestNewGame}>Play Again</button>
          </div>
        </div>
      )}

      <div className="top-info">
        <span>Players in room: {players.length}</span>
        <span className='player-name-display'>Playing as: <strong>{playerName}</strong></span>
      </div>

      <div className="table">
        <div className="player-area opponent-area">
          {opponents.map(op => (
            <div key={op.id}>
              <p className={currentTurn === op.id ? 'active-turn' : ''}>{op.name}</p>
              <div className="card-row">
                {(hands[op.id] || []).map((_, i) => <div key={i} className="card back"></div>)}
              </div>
            </div>
          ))}
        </div>

        <div className="center-area">
          <div className="pile">
            {tableCards.slice(-5).map((card, i) =>
                <div key={i} className="card" style={{'--i': i}}>
                  {revealedCards.includes(card) ? card : <div className="back"></div>}
                </div>
            )}
          </div>
          {lastPlayed && <div className="claim-text">Claim: {pluralizeRank(lastPlayed.cards.length, lastPlayed.declaredRank)}</div>}
          {message && <div className="message-box">{message}</div>}
        </div>

        <div className="player-area your-area">
            <p className={isMyTurn ? 'active-turn' : ''}>{playerName || 'You'}</p>
            <div className="hand-container">
                <button className="scroll-btn" onClick={() => scrollHand(-1)}>◀</button>
                <div className="card-row" ref={handRef}>
                {hand.map(card => (
                    <div key={card} onClick={() => toggleCard(card)} className={`card ${selected.includes(card) ? 'selected' : ''}`}>{card}</div>
                ))}
                </div>
                <button className="scroll-btn" onClick={() => scrollHand(1)}>▶</button>
            </div>
            <div className="action-buttons">
                <button className="play-btn" onClick={playCards} disabled={!isMyTurn || selected.length === 0}>Play Cards</button>
                <button className="skip-btn" onClick={skipTurn} disabled={!isMyTurn || !declaredRank}>Skip Turn</button>
                <button className="bluff-btn" onClick={callBluff} disabled={!isMyTurn || !lastPlayed}>Call Bluff</button>
            </div>
        </div>
      </div>
    </div>
  );
}

export default App;
