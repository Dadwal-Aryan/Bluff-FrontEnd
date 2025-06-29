import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const socket = io('https://bluff-backend-jckf.onrender.com');

function App() {
  const [roomId] = useState('room-abc');
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [hand, setHand] = useState([]);
  const [selected, setSelected] = useState([]);
  const [tableCards, setTableCards] = useState([]);
  const [message, setMessage] = useState(null);
  const [lastPlayed, setLastPlayed] = useState(null);

  const handRef = useRef(null);

  useEffect(() => {
    socket.on('connect', () => {
      setPlayerId(socket.id);
      socket.emit('join room', roomId);
    });

    socket.on('deal cards', (cards) => {
      setHand(cards);
      setSelected([]);
    });

    socket.on('turn', (playerSocketId) => {
      setCurrentTurn(playerSocketId);
      setMessage(null);
    });

    socket.on('room state', (players) => {
      setPlayers(players);
    });

    socket.on('cards played', ({ playerId: whoPlayed, playedCards }) => {
      setTableCards((prev) => [...prev, ...playedCards]);
      setLastPlayed({ playerId: whoPlayed, cards: playedCards });
      if (whoPlayed === socket.id) {
        setHand((prevHand) => prevHand.filter(card => !playedCards.includes(card)));
        setSelected([]);
      }
    });

    socket.on('update hands', (hands) => {
      setHand(hands[socket.id] || []);
    });

    socket.on('table cleared', () => {
      setTableCards([]);
      setLastPlayed(null);
    });

    socket.on('message', (msg) => {
      setMessage(msg);
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
      socket.off('error message');
    };
  }, [roomId]);

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

    // Ask user to declare rank (simplified - you can enhance UI later)
    let declaredRank = prompt("Declare the rank of your played cards (e.g., 2, 3, J, Q, K, A):");
    if (!declaredRank) return;
    declaredRank = declaredRank.toUpperCase();

    socket.emit('play cards', { roomId, playedCards: selectedCards, declaredRank });
  };

  const callBluff = () => {
    if (!lastPlayed || lastPlayed.playerId === playerId) {
      alert("You can only call bluff on your opponent's last play.");
      return;
    }
    socket.emit('call bluff', roomId);
  };

  const scrollLeft = () => {
    if (handRef.current) {
      handRef.current.scrollBy({ left: -150, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (handRef.current) {
      handRef.current.scrollBy({ left: 150, behavior: 'smooth' });
    }
  };

  return (
    <div className="game-container">
      <p>Players in room: {players.length}</p>
      <p>{currentTurn === playerId ? "Your turn" : "Opponent's turn"}</p>
      {message && <p className="message">{message}</p>}

      <div className="table">
        <div className="opponent">
          <p>Opponent</p>
          <div className="card-row opponent-row">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card back"></div>
            ))}
          </div>
        </div>

        <div className="center">
          <div className="pile">
            {tableCards.map((card, i) => (
              <div key={i} className="card played">{card}</div>
            ))}
          </div>
          <button className="play-btn" onClick={playCards}>Throw Selected Cards</button>
          <button className="bluff-btn" onClick={callBluff} disabled={!lastPlayed || lastPlayed.playerId === playerId}>
            Call Bluff
          </button>
        </div>

        <div className="player">
          <p>You</p>
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
