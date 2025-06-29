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
  const [skippedPlayers, setSkippedPlayers] = useState([]); // players who skipped current round

  const handRef = useRef(null);

  const hand = playerId ? (hands[playerId] || []) : [];

  // Find opponents (assuming 2 players max)
  const opponents = players.filter(p => p.id !== playerId);

  // Get player name by id
  const getNameById = (id) => {
    const p = players.find(p => p.id === id);
    return p ? p.name : 'Player';
  };

  // Helper: pluralize rank name properly
  const pluralizeRank = (count, rank) => {
    const rankNames = {
      '2': 'Two',
      '3': 'Three',
      '4': 'Four',
      '5': 'Five',
      '6': 'Six',
      '7': 'Seven',
      '8': 'Eight',
      '9': 'Nine',
      '10': 'Ten',
      'J': 'Jack',
      'Q': 'Queen',
      'K': 'King',
      'A': 'Ace',
    };

    const baseName = rankNames[rank] || rank;
    if (count === 1) return `${count} ${baseName}`;
    else return `${count} ${baseName}s`;
  };

  useEffect(() => {
    socket.on('connect', () => {
      setPlayerId(socket.id);
      socket.emit('join room', roomId);
    });

    socket.on('room state', (playersWithNames) => {
      setPlayers(playersWithNames);

      const me = playersWithNames.find(p => p.id === socket.id);

      if (me && (!me.name || me.name === 'Player')) {
        let storedName = localStorage.getItem('playerName') || '';
        if (!storedName) {
          let name = prompt("Enter your player name:", "");
          if (!name || name.trim() === "") {
            name = "Player";
          }
          storedName = name;
          localStorage.setItem('playerName', storedName);
          socket.emit('set name', { roomId, name: storedName });
        }
        setPlayerName(storedName);
        setNewNameInput(storedName);
      } else if (me && me.name !== playerName) {
        setPlayerName(me.name);
        setNewNameInput(me.name);
        localStorage.setItem('playerName', me.name);
      }
    });

    socket.on('deal cards', (cards) => {
      setHands((prev) => ({ ...prev, [socket.id]: cards }));
      setSelected([]);
      setTableCards([]);
      setLastPlayed(null);
      setDeclaredRank('');
      setSkippedPlayers([]);
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
      setSkippedPlayers([]); // reset skips on card play

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
      setSkippedPlayers([]);
      setRevealed(false);
    });

    socket.on('player skipped', (skippedPlayerId) => {
      setSkippedPlayers((prev) => {
        const updated = [...prev, skippedPlayerId];
        // If all players skipped, reset declared rank and clear skips
        if (updated.length === players.length) {
          setDeclaredRank('');
          return [];
        }
        return updated;
      });
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
      socket.off('player skipped');
      socket.off('message');
      socket.off('reveal cards');
      socket.off('error message');
    };
  }, [roomId, playerName, players.length]);

  // Function to send name change to server
  const updateName = () => {
    if (newNameInput.trim() === '') {
      alert('Name cannot be empty.');
      return;
    }
    socket.emit('set name', { roomId, name: newNameInput.trim() });
    setPlayerName(newNameInput.trim());
    localStorage.setItem('playerName', newNameInput.trim());
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

    // Only prompt for rank if no declaredRank yet (first player in round)
    let declared = declaredRank;
    if (!declaredRank) {
      let inputRank = prompt("Declare the rank (e.g., 2, 3, 10, J, Q, K, A):");
      if (!inputRank) return;
      declared = inputRank.toUpperCase();
    }

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

  // New Skip button logic
  const skipTurn = () => {
    if (playerId !== currentTurn) {
      alert("It's not your turn!");
      return;
    }
    socket.emit('skip turn', roomId);
  };

  const scrollLeft = () => {
    if (handRef.current) handRef.current.scrollBy({ left: -150, behavior: 'smooth' });
  };

  const scrollRight = () => {
    if (handRef.current) handRef.current.scrollBy({ left: 150, behavior: 'smooth' });
  };

  // Display played cards count + pluralized rank text
  const renderClaimText = (entry) => {
    const count = entry.cards.length;
    return pluralizeRank(count, entry.declaredRank);
  };

  // Check if current player can declare rank (only if declaredRank is empty)
  const canDeclareRank = playerId === currentTurn && declaredRank === '';

  // Check if current player can skip (when declaredRank exists and it's their turn)
  const canSkip = playerId === currentTurn && declaredRank !== '';

  return (
    <div className="game-container">
      <p>
        Players in room: {players.length} &nbsp;|&nbsp; 
        Your name: <strong>{playerName || '...'}</strong>
      </p>

      {/* Name change UI */}
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
            {declaredRank && <p>Claim: {renderClaimText({ cards: lastPlayed?.cards || [], declaredRank })}</p>}
          </div>
          <div className="pile">
            {tableCards.map((entry, i) => (
              <div key={i} style={{ position: 'relative', display: 'inline-block', marginRight: '10px' }}>
                {entry.cards.map((card, j) => (
                  <div key={`${i}-${j}`} className="card played">
                    {entry.playerId === playerId || revealed ? card : <div className="back" />}
                  </div>
                ))}
                {/* Declared rank badge on right shorter edge */}
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
                  {entry.declaredRank}
                </div>
              </div>
            ))}
          </div>

          {/* Play & Skip buttons */}
          {canDeclareRank && <button className="play-btn" onClick={playCards}>Throw Selected Cards & Declare Rank</button>}
          {!canDeclareRank && canSkip && (
            <>
              <button className="play-btn" onClick={playCards}>Throw Selected Cards</button>
              <button className="skip-btn" onClick={skipTurn} style={{ marginLeft: '10px' }}>Skip</button>
            </>
          )}

          <button className="bluff-btn" onClick={callBluff} disabled={!lastPlayed || lastPlayed.playerId === playerId} style={{ marginLeft: '10px' }}>
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
