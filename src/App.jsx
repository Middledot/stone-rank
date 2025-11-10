import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";

import { triggerLogin, triggerResponse } from "./auth.jsx"
import "./App.css";

function App() {
  // let fileUrl = convertFileSrc(appDataDir()+"/excursions.jpg")

  const [imgSrc, setImgSrc] = useState("https://f4.bcbits.com/img/a0401863863_16.jpg")

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const check = async () => {
      try {
        // console.log("I got triggered!")
        await triggerResponse()
      } catch (err) {
        console.log(err)
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    check();
  }, []);

  if (loading) return <p>Loading data...</p>;
  if (error) return <p>Error?: {error.message} {error}</p>;

  return (
    <main className="higher-power">
      <div className="specific-header">
        <div className="general-header">
          <h1>StoneRank</h1>

          <button className="header-button" type="submit">Home</button>
          <button className="header-button" type="submit">Downloads</button>
          <button className="header-button" type="submit">Format</button>
          <button className="header-button" type="submit" onClick={triggerLogin}>Login</button>
        </div>
      </div>

      <div className="awe-tab">
        <div className="home">
          <div className="cover-display">
            <h2 className="cover-display-title">Album Cover</h2>
            <img
              className="cover-display-image"
              src={imgSrc}
            />
          </div>
          <div className="integrated-player">
            <h2 className="cover-display-title">Spotify Player</h2>
          </div>
          <div className="source-selector">
            <h2 className="cover-display-title">Player Picker</h2>
          </div>
          <div className="unranked-list">
            <h2 className="cover-display-title">Unranked List</h2>
            {/* 
              TODO:
               - Reusable list interface
            */}
          </div>
          <div className="ranked-list">
            <h2 className="cover-display-title">Ranked List</h2>
          </div>
          <div className="text-modifier">
            <h2 className="cover-display-title">Comment Editor</h2>
            {/* 
              TODO:
               - Text editor
            */}
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
