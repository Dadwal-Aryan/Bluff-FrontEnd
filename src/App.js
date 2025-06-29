// src/App.js
import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const socket = io('https://bluff-backend-jckf.onrender.com');

function App() {
  const [roomId] = useState('room-abc');
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState(null);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('playerName') || '');
  const [newNameInput, setNewNameInput] = useState('');
  const [currentTurn, setCurrentTurn] = useState(null);
  const [hands, setHands] = useState({});
  const [selected, setSelected] = useState([]);
  const [tableCards, setTableCards] = useState([]);
  const [message, setMessage] = useState('');
  const [lastPlayed, setLastPlayed] = useState(null);
  const [revealedCards, setRevealedCards] = useState([]);
  const [declaredRank, setDeclaredRank] = useState('');
  const [winner, setWinner] = useState(null);

  const handRef = useRef(null);
  const hand = playerId ? (hands[playerId] || []) : [];
  const opponents = players.filter(p => p.id !== playerId);

  const getNameById = (id) => players.find(p => p.id === id)?.name || 'Player';

  const pluralizeRank = (count, rank) => {
    const rankNames = {
      '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six',
      '7': 'Seven', '8': 'Eight', '9': 'Nine', '10': 'Ten',
      'J': 'Jack', 'Q': 'Queen', 'K': 'King', 'A': 'Ace',
    };
    const baseName = rankNames[rank] || rank;
    if (count === 1) return `1 ${baseName}`;
    if (rank === '6') return `${count} Sixes`;
    return `${count} ${baseName}s`;
  };

  useEffect(() => {
    socket.on('connect', () => setPlayerId(socket.id));
    socket.emit('join room', roomId);

    socket.on('room state', (playersWithNames) => {
        setPlayers(playersWithNames);
        const me = playersWithNames.find(p => p.id === socket.id);
        if (me && me.name) {
            setPlayerName(me.name);
            setNewNameInput(me.name);
            localStorage.setItem('playerName', me.name);
        }
    });

    socket.on('deal cards', (cards) => {
      setHands(prev => ({ ...prev, [socket.id]: cards }));
      // Reset everything for a new deal
      setSelected([]);
      setTableCards([]);
      setLastPlayed(null);
      setDeclaredRank('');
      setRevealedCards([]);
      setMessage('');
      setWinner(null);
    });

    socket.on('turn', (playerSocketId) => {
      setCurrentTurn(playerSocketId);
      setMessage(''); // Clear messages on turn change
    });

    socket.on('cards played', ({ playerId: whoPlayed, playedCards, declaredRank }) => {
      setTableCards(prev => [...prev, { playerId: whoPlayed, cards: playedCards, declaredRank }]);
      setLastPlayed({ playerId: whoPlayed, cards: playedCards, declaredRank });
      setDeclaredRank(declaredRank);
      if (whoPlayed === socket.id) setSelected([]);
    });

    socket.on('update hands', (allHands) => setHands(allHands));

    socket.on('table cleared', () => {
      setTableCards([]);
      setLastPlayed(null);
      setDeclaredRank('');
      setRevealedCards([]);
    });

    socket.on('reveal cards', (cards) => {
        setRevealedCards(cards);
        setTimeout(() => setRevealedCards([]), 3000); // Hide again after 3s
    });

    socket.on('message', (msg) => setMessage(msg));
    socket.on('error message', (msg) => alert(msg));
    socket.on('game over', ({ winnerName }) => setWinner(winnerName));

    return () => {
      socket.off('connect');
      socket.off('room state');
      socket.off('deal cards');
      socket.off('turn');
      socket.off('cards played');
      socket.off('update hands');
      socket.off('table cleared');
      socket.off('reveal cards');
      socket.off('message');
      socket.off('error message');
      socket.off('game over');
    };
  }, [roomId, socket.id]);

  const handleNameChange = () => {
    const name = newNameInput.trim();
    if (name) {
      setPlayerName(name);
      localStorage.setItem('playerName', name);
      socket.emit('set name', { roomId, name });
    }
  };

  const toggleCard = (card) => {
    setSelected(prev => prev.includes(card) ? prev.filter(c => c !== card) : [...prev, card]);
  };

  const playCards = () => {
    if (currentTurn !== playerId) return alert("It's not your turn!");
    if (selected.length === 0) return alert("Select at least one card to play.");

    let currentDeclaredRank = declaredRank;
    if (!currentDeclaredRank) {
      const inputRank = prompt("Declare the rank of your played cards (e.g., 2, 3, J, Q, K, A):");
      if (!inputRank) return;
      currentDeclaredRank = inputRank.trim().toUpperCase();
    }

    socket.emit('play cards', { roomId, playedCards: selected, declaredRank: currentDeclaredRank });
  };
  
  const skipTurn = () => socket.emit('skip turn', roomId);
  const callBluff = () => socket.emit('call bluff', roomId);
  const scrollHand = (direction) => handRef.current?.scrollBy({ left: direction * 200, behavior: 'smooth' });

  return (
    <div className="game-container">
      {winner && (
        <div className="game-over-overlay">
          <div className="game-over-box">
            <h2>Game Over!</h2>
            <p>🎉 {winner} wins! 🎉</p>
          </div>
        </div>
      )}

      <div className="top-info">
        <span>Room: {roomId}</span>
        <div className="name-changer">
            <input
                type="text"
                value={newNameInput}
                onChange={(e) => setNewNameInput(e.target.value)}
                placeholder="Enter your name"
            />
            <button onClick={handleNameChange}>Set Name</button>
        </div>
        <span>Players: {players.length}</span>
      </div>

      <div className="table">
        <div className="player-area opponent-area">
          {opponents.map(op => (
            <div key={op.id}>
              <p>{op.name}</p>
              <div className="card-row">
                {(hands[op.id] || []).map((_, i) => <div key={i} className="card back"></div>)}
              </div>
            </div>
          ))}
        </div>

        <div className="center-area">
          <div className="pile">
            {tableCards.map((play, i) =>
              play.cards.map((card, j) => (
                <div key={`${i}-${j}`} className="card">
                  {revealedCards.includes(card) ? card : <div className="back"></div>}
                </div>
              ))
            )}
          </div>
          {lastPlayed && (
            <div className="claim-text">
              Claim: {pluralizeRank(lastPlayed.cards.length, lastPlayed.declaredRank)}
            </div>
          )}
          {message && <div className="message-box">{message}</div>}
        </div>

        <div className="player-area your-area">
          <p>{playerName} (You) - Turn: {currentTurn === playerId ? 'Yes' : 'No'}</p>
          <div className="hand-container">
            <button className="scroll-btn" onClick={() => scrollHand(-1)}>◀</button>
            <div className="card-row" ref={handRef}>
              {hand.map(card => (
                <div key={card} onClick={() => toggleCard(card)} className={`card ${selected.includes(card) ? 'selected' : ''}`}>
                  {card}
                </div>
              ))}
            </div>
            <button className="scroll-btn" onClick={() => scrollHand(1)}>▶</button>
          </div>
          <div className="action-buttons">
            <button onClick={playCards} disabled={currentTurn !== playerId || selected.length === 0}>Play Cards</button>
            <button onClick={skipTurn} disabled={currentTurn !== playerId || !declaredRank}>Skip Turn</button>
            <button onClick={callBluff} disabled={currentTurn !== playerId || !lastPlayed}>Call Bluff</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;