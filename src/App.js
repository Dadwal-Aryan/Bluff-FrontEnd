import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const socket = io('https://bluff-backend-jckf.onrender.com');

function App() {
  const [roomId] = useState('room-abc');
  const [players, setPlayers] = useState([]); // [{id, name}]
  const [playerId, setPlayerId] = useState(null);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('playerName') || '');
  const [newNameInput, setNewNameInput] = useState('');
  const [currentTurn, setCurrentTurn] = useState(null);
  const [hands, setHands] = useState({});  // All players' hands keyed by playerId
  const [selected, setSelected] = useState([]);
  const [tableCards, setTableCards] = useState([]);
  const [message, setMessage] = useState(null);
  const [lastPlayed, setLastPlayed] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [declaredRank, setDeclaredRank] = useState('');

  const handRef = useRef(null);

  const hand = playerId ? (hands[playerId] || []) : [];

  // Find opponents (assuming 2 players max)
  const opponents = players.filter(p => p.id !== playerId);

  // Get player name by id
  const getNameById = (id) => {
    const p = players.find(p => p.id === id);
    return p ? p.name : 'Player';
  };

  useEffect(() => {
    socket.on('connect', () => {
      setPlayerId(socket.id);
      socket.emit('join room', roomId);
    });

    socket.on('room state', (playersWithNames) => {
      setPlayers(playersWithNames);

      const me = playersWithNames.find(p => p.id === socket.id);

      if (me) {
        if ((!me.name || me.name === 'Player') && !playerName) {
          // Prompt only if no name stored locally and server default name
          let storedName = localStorage.getItem('playerName') || '';
          if (!storedName) {
            let name = prompt("Enter your player name:", "");
            if (!name || name.trim() === "") {
              name = "Player";
            }
            storedName = name.trim();
            localStorage.setItem('playerName', storedName);
            socket.emit('set name', { roomId, name: storedName });
          } else {
            socket.emit('set name', { roomId, name: storedName });
          }
          setPlayerName(storedName);
          setNewNameInput(storedName);
        } else if (me.name !== playerName) {
          setPlayerName(me.name);
          setNewNameInput(me.name);
          localStorage.setItem('playerName', me.name);
        } else if (!newNameInput) {
          // Sync input if empty
          setNewNameInput(me.name);
        }
      }
    });

    socket.on('deal cards', (cards) => {
      setHands((prev) => ({ ...prev, [socket.id]: cards }));
      setSelected([]);
      setTableCards([]);
      setLastPlayed(null);
      setDeclaredRank('');
      setRevealed(false);
    });

    socket.on('turn', (playerSocketId) => {
      setCurrentTurn(playerSocketId);
      setMessage(null);
    });

    socket.on('cards played', ({ playerId: whoPlayed, playedCards, declaredRank }) => {
      setTableCards((prev) => [...prev, { playerId: whoPlayed, cards: playedCards, declaredRank }]);
      setLastPlayed({ playerId: whoPlayed, cards: playedCards });
      setDeclaredRank(declaredRank);

      if (whoPlayed === socket.id) {
        setSelected([]);
      }

      setRevealed(false);
    });

    socket.on('update hands', (allHands) => {
      setHands(allHands);
    });

    socket.on('table cleared', () => {
      setTableCards([]);
      setLastPlayed(null);
      setDeclaredRank('');
      setRevealed(false);
    });

    socket.on('message', (msg) => {
      setMessage(msg);
    });

    socket.on('reveal cards', () => {
      setRevealed(true);
    });

    socket.on('error message', (msg) => {
      alert(msg);
    });

    return () => {
      socket.off('connect');
      socket.off('deal cards');
      socket.off('turn');
      socket.off('room state');
      socket.off('cards played');
      socket.off('update hands');
      socket.off('table cleared');
      socket.off('message');
      socket.off('reveal cards');
      socket.off('error message');
    };
  }, [roomId, playerName, newNameInput]);

  // Send name change to server on button click
  const updateName = () => {
    const trimmed = newNameInput.trim();
    if (trimmed === '') {
      alert('Name cannot be empty.');
      return;
    }
    if (trimmed === playerName) return; // no change
    socket.emit('set name', { roomId, name: trimmed });
    setPlayerName(trimmed);
    localStorage.setItem('playerName', trimmed);
  };

  const toggleCard = (index) => {
    setSelected((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const playCards = () => {
    if (playerId !== currentTurn) {
      alert("It's not your turn!");
      return;
    }

    const selectedCards = selected.map(i => hand[i]);
    if (selectedCards.length === 0) {
      alert("Select at least one card to play.");
      return;
    }

    let declared = prompt("Declare the rank (e.g., 2, 3, 10, J, Q, K, A):");
    if (!declared) return;
    declared = declared.toUpperCase();

    socket.emit('play cards', {
      roomId,
      playedCards: selectedCards,
      declaredRank: declared
    });
  };

  const callBluff = () => {
    if (!lastPlayed || lastPlayed.playerId === playerId) {
      alert("You can only call bluff on your opponent's play.");
      return;
    }
    socket.emit('call bluff', roomId);
  };

  const scrollLeft = () => {
    if (handRef.current) handRef.current.scrollBy({ left: -150, behavior: 'smooth' });
  };

  const scrollRight = () => {
    if (handRef.current) handRef.current.scrollBy({ left: 150, behavior: 'smooth' });
  };

  return (
    <div className="game-container">
      <p>
        Players in room: {players.length} &nbsp;|&nbsp; 
        Your name: <strong>{playerName || '...'}</strong>
      </p>

      <div style={{ marginBottom: '15px' }}>
        <input
          type="text"
          maxLength={20}
          value={newNameInput}
          onChange={(e) => setNewNameInput(e.target.value)}
          placeholder="Change your name"
          style={{ padding: '5px', fontSize: '1rem' }}
        />
        <button onClick={updateName} style={{ marginLeft: '8px', padding: '5px 10px' }}>
          Update Name
        </button>
      </div>

      <p>
        {currentTurn === playerId ? "Your turn" : `Turn: ${getNameById(currentTurn) || 'Opponent'}`}
      </p>
      {message && <p className="message">{message}</p>}

      <div className="table">
        {/* Opponent cards */}
        <div className="opponent">
          {opponents.map((opponent) => (
            <div key={opponent.id}>
              <p>{opponent.name || 'Opponent'}</p>
              <div className="card-row opponent-row">
                {(hands[opponent.id] || []).map((_, i) => (
                  <div key={`${opponent.id}-${i}`} className="card back"></div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Center pile and declared rank */}
        <div className="center">
          <div className="claimed-rank">
            {declaredRank && <p>Claim: {declaredRank}s</p>}
          </div>
          <div className="pile">
            {tableCards.map((entry, i) => (
              <div key={i} style={{ position: 'relative', display: 'inline-block', marginRight: '10px' }}>
                {entry.cards.map((card, j) => (
                  <div key={`${i}-${j}`} className="card played">
                    {entry.playerId === playerId || revealed ? card : <div className="back" />}
                  </div>
                ))}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  right: '-30px',
                  transform: 'translateY(-50%)',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  userSelect: 'none',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  textShadow: '1px 1px 3px black',
                }}>
                  {entry.declaredRank}s
                </div>
              </div>
            ))}
          </div>
          <button className="play-btn" onClick={playCards}>Throw Selected Cards</button>
          <button className="bluff-btn" onClick={callBluff} disabled={!lastPlayed || lastPlayed.playerId === playerId}>
            Call Bluff
          </button>
        </div>

        {/* Player cards */}
        <div className="player">
          <p>{playerName || 'You'}</p>
          <div className="hand-container">
            <button className="scroll-btn left" onClick={scrollLeft} aria-label="Scroll Left">&#9664;</button>
            <div className="card-row" ref={handRef}>
              {hand.map((card, index) => (
                <div
                  key={index}
                  className={`card ${selected.includes(index) ? 'selected' : ''}`}
                  onClick={() => toggleCard(index)}
                >
                  {card}
                </div>
              ))}
            </div>
            <button className="scroll-btn right" onClick={scrollRight} aria-label="Scroll Right">&#9654;</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
