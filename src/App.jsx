import { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";

import { triggerLogin, triggerResponse, getProfile } from "./auth.jsx"
import "./App.css";

function App() {
  // let fileUrl = convertFileSrc(appDataDir()+"/excursions.jpg")
  const [albumThumbSrc, setAlbumThumbSrc] = useState("https://f4.bcbits.com/img/a0401863863_16.jpg")

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [username, setUsername] = useState('Jo Doe');
  const [pfp, setPfp] = useState('https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg');

  useEffect(() => {
    const check = async () => {
      try {
        // console.log("I got triggered!")
        await triggerResponse()
        let profile = await getProfile();
        setUsername(profile[0]);
        setPfp(profile[1]);
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
        <div className="login-display">
          <p>{username}</p>
          <img src={pfp} height="32" width="32" />
        </div>
      </div>

      <div className="awe-tab">
        <div className="home">
          <div className="cover-display">
            <h2 className="cover-display-title">Album Cover</h2>
            <img
              className="cover-display-image"
              src={albumThumbSrc}
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
