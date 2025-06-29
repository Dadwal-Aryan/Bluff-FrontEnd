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
  const [message, setMessage] = useState('');
  const [lastPlayed, setLastPlayed] = useState(null);
  const [revealedCards, setRevealedCards] = useState([]);
  const [declaredRank, setDeclaredRank] = useState('');
  const [winner, setWinner] = useState(null);
  const [gameJoined, setGameJoined] = useState(false);

  const handRef = useRef(null);
  const messageTimeoutRef = useRef(null);

  const hand = playerId ? (hands[playerId] || []) : [];
  const opponents = players.filter(p => p.id !== playerId);

  // --- NEW: Helper function to sort cards in hand ---
  const sortHand = (cards) => {
    const rankOrder = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
    const getRankIndex = (card) => rankOrder.indexOf(card.slice(0, -1));

    const groupedByRank = cards.reduce((acc, card) => {
      const rank = card.slice(0, -1);
      if (!acc[rank]) {
        acc[rank] = [];
      }
      acc[rank].push(card);
      return acc;
    }, {});

    const pairsAndMore = [];
    const singletons = [];

    // Separate pairs/groups from single cards
    for (const rank in groupedByRank) {
      if (groupedByRank[rank].length > 1) {
        pairsAndMore.push(groupedByRank[rank]);
      } else {
        singletons.push(groupedByRank[rank]);
      }
    }

    // Sort the groups based on rank order
    const sortInnerGroups = (groups) => groups.sort((a, b) => getRankIndex(a[0]) - getRankIndex(b[0]));
    
    sortInnerGroups(pairsAndMore);
    sortInnerGroups(singletons);

    // Combine sorted groups, with pairs first, then singletons
    const sortedCards = [...pairsAndMore.flat(), ...singletons.flat()];
    return sortedCards;
  };

  // --- NEW: Helper function to determine card color ---
  const getCardColorClass = (card) => {
    const suit = card.slice(-1);
    if (suit === '♥' || suit === '♦') {
      return 'red-card';
    }
    return '';
  };

  const pluralizeRank = (count, rank) => {
    if (!rank) return '';
    const rankNames = {'2':'Two','3':'Three','4':'Four','5':'Five','6':'Six','7':'Seven','8':'Eight','9':'Nine','10':'Ten','J':'Jack','Q':'Queen','K':'King','A':'Ace'};
    const baseName = rankNames[rank] || rank;
    if (rank === '6') return count === 1 ? `1 Six` : `${count} Sixes`;
    return count === 1 ? `1 ${baseName}` : `${count} ${baseName}s`;
  };

  useEffect(() => {
    socket.on('connect', () => {
      setPlayerId(socket.id);
    });

    socket.on('room state', setPlayers);
    socket.on('game started', ({ hands, turn, players }) => {
        // --- MODIFIED: Sort hands upon receiving them ---
        Object.keys(hands).forEach(pId => {
            hands[pId] = sortHand(hands[pId]);
        });
        setHands(hands);
        setCurrentTurn(turn);
        setPlayers(players);
        setSelected([]);
        setLastPlayed(null);
        setDeclaredRank('');
        setRevealedCards([]);
        setMessage('');
        setWinner(null);
    });
    socket.on('turn', setCurrentTurn);
    socket.on('cards played', ({ whoPlayed, playedCards, declaredRank }) => {
      setLastPlayed({ playerId: whoPlayed, cards: playedCards, declaredRank });
      setDeclaredRank(declaredRank);
      if (whoPlayed === socket.id) setSelected([]);
    });
    
    // --- MODIFIED: Sort hands upon receiving an update ---
    socket.on('update hands', (allHands) => {
        Object.keys(allHands).forEach(pId => {
            allHands[pId] = sortHand(allHands[pId]);
        });
        setHands(allHands);
    });

    socket.on('table cleared', () => {
      setLastPlayed(null);
      setDeclaredRank('');
      setRevealedCards([]);
    });
    socket.on('reveal cards', (cards) => {
        setRevealedCards(cards);
        setTimeout(() => setRevealedCards([]), 4000);
    });
    
    socket.on('message', (msg) => {
        setMessage(msg);
        if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
        messageTimeoutRef.current = setTimeout(() => setMessage(''), 4000);
    });

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
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    };
  }, []);

  const joinGame = () => {
    let nameToSet = playerName.trim();
    if (!nameToSet) nameToSet = `Player #${Math.floor(Math.random() * 1000)}`;
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
        <span className='player-name-display'>Playing as: <strong>{playerName}</strong></span>
        <span>Players in room: {players.length}</span>
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
            {lastPlayed && lastPlayed.cards.map((card, i) => {
              const showFace = lastPlayed.playerId === playerId || revealedCards.includes(card);
              if (showFace) {
                return (
                  <div key={i} className={`card ${getCardColorClass(card)}`} style={{'--i': i}}>
                    {card}
                  </div>
                );
              } else {
                return (
                  <div key={i} className="card back" style={{'--i': i}}></div>
                );
              }
            })}
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
                    <div key={card} onClick={() => toggleCard(card)} className={`card ${selected.includes(card) ? 'selected' : ''} ${getCardColorClass(card)}`}>
                        {card}
                    </div>
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
