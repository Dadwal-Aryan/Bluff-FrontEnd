import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

// ✅ Updated to use your live backend
const socket = io('https://bluff-backend-jckf.onrender.com');

function App() {
  const [roomId] = useState('room-abc');
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [hand, setHand] = useState([]);
  const [selected, setSelected] = useState([]);
  const [tableCards, setTableCards] = useState([]);

  const handRef = useRef(null);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected with ID:', socket.id);
      setPlayerId(socket.id);
      socket.emit('join room', roomId);
    });

    socket.on('deal cards', (cards) => {
      console.log('Your hand:', cards);
      setHand(cards);
      setSelected([]); // clear selection on new hand
    });

    socket.on('turn', (playerSocketId) => {
      setCurrentTurn(playerSocketId);
      console.log('It is now', playerSocketId === socket.id ? 'your turn' : "opponent's turn");
    });

    socket.on('room state', (players) => {
      setPlayers(players);
      console.log('Players in room:', players);
    });

    socket.on('cards played', ({ playerId: whoPlayed, playedCards }) => {
      setTableCards((prev) => [...prev, ...playedCards]);
      // If current player played cards, remove them from hand and clear selection
      if (whoPlayed === socket.id) {
        setHand((prevHand) => prevHand.filter(card => !playedCards.includes(card)));
        setSelected([]);
      }
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

    // Send played cards to backend
    socket.emit('play cards', { roomId, playedCards: selectedCards });
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
